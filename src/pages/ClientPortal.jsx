import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import {
  acceptQuote, confirmFinal, decideCad, listCustomerActions, portalView, rejectDiamondCandidates,
  rejectFinalConfirmation, respondCustomerAction, sendOrderMessage, toggleShortlist, requestStockConfirm, lockSelectedCandidate,
} from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb, usd } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

// 게스트 조회 입력 (Order ID + 쿼리코드)
export function TrackEntry() {
  const { p } = useLocale();
  const t = p.portal;
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="page page-narrow">
      <h1 className="page-title">{t.guestTitle}</h1>
      <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); navigate(`/orders/${orderId.trim().toUpperCase()}?code=${code.trim().toUpperCase()}`); }}>
        <label className="field"><span>{t.orderId}</span><input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="DM-000001" required /></label>
        <label className="field"><span>{t.code}</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" required /></label>
        <button className="button primary" type="submit">{t.open}</button>
      </form>
    </div>
  );
}

// 타임라인 체크포인트 래퍼 — done은 접고, active만 펼친다
function Checkpoint({ id, index, title, state, summary, children, badgeOverride }) {
  const { p } = useLocale();
  const t2 = p.visual;
  const badge = badgeOverride || (state === "done" ? t2.doneTag : state === "active" ? t2.nowAction : state === "waiting" ? p.portal.waitingBeloveD : t2.upcoming);
  const badgeClass = state === "active" ? "mst-waitingClient" : state === "waiting" ? "mst-inProgress" : state === "done" ? "mst-done" : "mst-pending";
  return (
    <section id={id} className={`panel checkpoint client-stage-section ${state}`}>
      <div className="client-stage-head">
        <span className="client-stage-number">{state === "done" ? "✓" : String(index).padStart(2, "0")}</span>
        <div>
          <h3>{title}</h3>
          {state === "done" && summary && <p>{summary}</p>}
        </div>
        <span className={`status-badge ${badgeClass}`}>{badge}</span>
      </div>
      {(state === "active" || state === "waiting") && children}
    </section>
  );
}

function ConfirmationRail({ steps }) {
  const { p } = useLocale();
  const copy = p.visual;
  const labelFor = (state) => state === "done" ? copy.doneTag : state === "active" ? copy.nowAction : copy.upcoming;
  return (
    <section className="client-confirm-rail" aria-label={p.portal.actionsTitle}>
      {steps.map((step, index) => (
        <article className={`client-confirm-step ${step.state}`} key={step.key}>
          <span className="client-confirm-index">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{step.title}</strong>
            <small>{labelFor(step.state)}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

const CUSTOMER_STATUS_COPY = {
  en: {
    kicker: "Current status",
    title: "Three checkpoints.",
    subtitle: "Your order moves through stone, design, and final confirmation.",
    stoneTitle: "Stone",
    stoneBody: "Review the diamond option when BeloveD sends it.",
    stonePendingBody: "BeloveD is preparing diamond options for this order. There is nothing to select yet.",
    stoneSubmittedBody: "BeloveD is checking the diamond you selected. You will see the next confirmation here when it is ready.",
    designTitle: "Design",
    designBody: "Approve CAD/design media before production.",
    finalTitle: "Final piece",
    finalBody: "Confirm the finished media before delivery.",
    done: "Done",
    current: "In progress",
    waiting: "Your turn",
    next: "Next",
  },
  ko: {
    kicker: "현재 진행 상황",
    title: "핵심 3단계만 확인하세요.",
    subtitle: "스톤, 디자인, 완성품 확인 순서로 주문이 진행됩니다.",
    stoneTitle: "스톤",
    stoneBody: "BeloveD가 보낸 다이아 후보를 확인합니다.",
    stonePendingBody: "BeloveD가 이 주문에 맞는 다이아 후보를 준비 중입니다. 아직 선택할 항목은 없습니다.",
    stoneSubmittedBody: "선택하신 다이아몬드를 BeloveD가 확인 중입니다. 준비되면 다음 확인 단계가 이 화면에 표시됩니다.",
    designTitle: "디자인",
    designBody: "제작 전 CAD/디자인 자료를 승인합니다.",
    finalTitle: "완성품",
    finalBody: "배송 전 실제 완성품 사진·영상을 확인합니다.",
    done: "완료",
    current: "진행중",
    waiting: "확인 필요",
    next: "예정",
  },
  zh: {
    kicker: "当前状态",
    title: "只看三个关键节点。",
    subtitle: "订单按选石、设计确认、成品确认推进。",
    stoneTitle: "石头",
    stoneBody: "查看 BeloveD 发送的钻石候选。",
    stonePendingBody: "BeloveD 正在为此订单准备钻石候选，目前无需选择。",
    stoneSubmittedBody: "BeloveD 正在确认您选择的钻石。准备好后，下一步确认会显示在这里。",
    designTitle: "设计",
    designBody: "生产前确认 CAD / 设计资料。",
    finalTitle: "成品",
    finalBody: "发货前确认成品照片或视频。",
    done: "完成",
    current: "进行中",
    waiting: "需确认",
    next: "下一步",
  },
  es: {
    kicker: "Estado actual",
    title: "Solo tres puntos clave.",
    subtitle: "Tu pedido avanza por piedra, diseño y confirmación final.",
    stoneTitle: "Piedra",
    stoneBody: "Revisa la opción de diamante cuando BeloveD la envíe.",
    stonePendingBody: "BeloveD está preparando opciones de diamante para este pedido. Aún no hay nada que seleccionar.",
    stoneSubmittedBody: "BeloveD está verificando el diamante que elegiste. Verás la siguiente confirmación aquí cuando esté lista.",
    designTitle: "Diseño",
    designBody: "Aprueba CAD o medios de diseño antes de producción.",
    finalTitle: "Pieza final",
    finalBody: "Confirma fotos o video final antes del envío.",
    done: "Listo",
    current: "En curso",
    waiting: "Tu turno",
    next: "Siguiente",
  },
};

function customerStatusCopy(locale) {
  return CUSTOMER_STATUS_COPY[locale] || CUSTOMER_STATUS_COPY.en;
}

const CUSTOMER_WORKSPACE_COPY = {
  en: {
    nextKicker: "Your next step",
    statusKicker: "Current status",
    titleReady: "One thing to do now.",
    titleWaiting: "BeloveD is working on it.",
    order: "Order",
    orderBrief: "Order brief",
    advisor: "Owner",
    currentStatus: "Status",
    due: "Due",
    openActions: "Open actions",
    goToAction: "Review now",
    chat: "Ask BeloveD",
    noDue: "Not set",
    style: "Style",
    category: "Category",
    subcategory: "Subcategory",
    metal: "Metal",
    size: "Size",
    chainStyle: "Chain",
    chainLength: "Length",
    clasp: "Clasp",
    pairSetup: "Pair setup",
    budget: "Budget",
    requiredDate: "Requested date",
    stone: "Stone",
    references: "References",
    quote: "Quote",
    none: "None yet",
    detailsToggle: "Show order details",
    referenceCount: (n) => `${n} file${n === 1 ? "" : "s"}`,
    orderLine: (id) => `Order ${id}`,
    stonePreparingBadge: "BeloveD preparing",
    stonePreparingTitle: "Diamond options are being prepared.",
    stonePreparingBody: "No action is needed yet. When BeloveD publishes candidate stones, you will select one here.",
  },
  ko: {
    nextKicker: "지금 할 일",
    statusKicker: "진행 상태",
    titleReady: "지금은 이것만 확인하면 됩니다.",
    titleWaiting: "BeloveD가 다음 단계를 준비 중입니다.",
    order: "주문",
    orderBrief: "주문 요약",
    advisor: "확인 주체",
    currentStatus: "상태",
    due: "기한",
    openActions: "확인 필요",
    goToAction: "바로 확인",
    chat: "상담하기",
    noDue: "미정",
    style: "스타일",
    category: "카테고리",
    subcategory: "서브카테고리",
    metal: "메탈",
    size: "사이즈",
    chainStyle: "체인",
    chainLength: "길이",
    clasp: "클라스프",
    pairSetup: "페어 옵션",
    budget: "예산",
    requiredDate: "희망일",
    stone: "스톤",
    references: "레퍼런스",
    quote: "견적",
    none: "아직 없음",
    detailsToggle: "주문 세부정보 보기",
    referenceCount: (n) => `${n}개 첨부`,
    orderLine: (id) => `주문 ${id}`,
    stonePreparingBadge: "BeloveD 준비 중",
    stonePreparingTitle: "다이아 후보를 준비 중입니다.",
    stonePreparingBody: "아직 고객님이 선택할 항목은 없습니다. BeloveD가 후보를 공개하면 이 화면에서 바로 선택할 수 있어요.",
  },
  zh: {
    nextKicker: "当前待办",
    statusKicker: "当前状态",
    titleReady: "现在只需确认这一项。",
    titleWaiting: "BeloveD 正在准备下一步。",
    order: "订单",
    orderBrief: "订单摘要",
    advisor: "处理方",
    currentStatus: "状态",
    due: "期限",
    openActions: "待确认",
    goToAction: "立即查看",
    chat: "咨询 BeloveD",
    noDue: "未定",
    style: "款式",
    category: "品类",
    subcategory: "子类",
    metal: "金属",
    size: "尺寸",
    chainStyle: "链条",
    chainLength: "长度",
    clasp: "搭扣",
    pairSetup: "配对",
    budget: "预算",
    requiredDate: "期望日期",
    stone: "钻石",
    references: "参考图",
    quote: "报价",
    none: "暂无",
    detailsToggle: "查看订单详情",
    referenceCount: (n) => `${n} 个文件`,
    orderLine: (id) => `订单 ${id}`,
    stonePreparingBadge: "BeloveD 准备中",
    stonePreparingTitle: "钻石候选正在准备中。",
    stonePreparingBody: "目前无需操作。BeloveD 发布候选钻石后，您可以在这里选择。",
  },
  es: {
    nextKicker: "Tu siguiente paso",
    statusKicker: "Estado actual",
    titleReady: "Solo confirma esto ahora.",
    titleWaiting: "BeloveD está preparando el siguiente paso.",
    order: "Pedido",
    orderBrief: "Resumen del pedido",
    advisor: "Responsable",
    currentStatus: "Estado",
    due: "Fecha",
    openActions: "Acciones abiertas",
    goToAction: "Revisar ahora",
    chat: "Consultar",
    noDue: "Sin fecha",
    style: "Estilo",
    category: "Categoría",
    subcategory: "Subcategoría",
    metal: "Metal",
    size: "Talla",
    chainStyle: "Cadena",
    chainLength: "Largo",
    clasp: "Broche",
    pairSetup: "Par",
    budget: "Presupuesto",
    requiredDate: "Fecha solicitada",
    stone: "Piedra",
    references: "Referencias",
    quote: "Cotización",
    none: "Aún no",
    detailsToggle: "Ver detalles del pedido",
    referenceCount: (n) => `${n} archivo${n === 1 ? "" : "s"}`,
    orderLine: (id) => `Pedido ${id}`,
    stonePreparingBadge: "BeloveD preparando",
    stonePreparingTitle: "Estamos preparando las opciones de diamante.",
    stonePreparingBody: "Aún no necesitas hacer nada. Cuando BeloveD publique los diamantes candidatos, podrás elegir uno aquí.",
  },
};

function customerWorkspaceCopy(locale) {
  return CUSTOMER_WORKSPACE_COPY[locale] || CUSTOMER_WORKSPACE_COPY.en;
}

function chainLengthLabel(value) {
  const inches = String(value || "").replace("in", "");
  const cm = { 16: "40 cm", 18: "45 cm", 20: "50 cm", 22: "55 cm" }[inches];
  return cm ? `${value} / ${cm}` : value;
}

function optionLabel(intakeText, group, value) {
  if (!value) return "";
  return intakeText.optionLabels?.[group]?.[value] || value;
}

function compactStoneSummary({ selected, intake, p }) {
  if (selected) {
    return `${p.shapes[selected.shape] || selected.shape} ${selected.carat?.toFixed?.(2) || selected.carat}ct · ${selected.color}/${selected.clarity}`;
  }
  const prefs = intake?.stonePrefs;
  if (prefs) {
    return `${p.shapes[prefs.shape] || prefs.shape} ${prefs.carat}ct · ${prefs.color}/${prefs.clarity}`;
  }
  const spec = intake?.multiSpec;
  if (spec?.meleeSpec || spec?.overallDims) {
    return [spec.meleeSpec, spec.overallDims].filter(Boolean).join(" · ");
  }
  return "";
}

function buildOrderBriefRows({ order, intake, style, selected, quote, p, locale, copy }) {
  const intakeText = p.intake;
  const cond = intake?.conditional || {};
  const rows = [
    { label: copy.style, value: style ? pickI18n(style.name, locale) : "" },
    { label: copy.category, value: p.opsCategories?.[intake?.category] || intake?.category },
    { label: copy.subcategory, value: p.opsSubcategories?.[style?.subcategory || intake?.subcategory] || style?.subcategory || intake?.subcategory },
    { label: copy.metal, value: p.opsMetals?.[intake?.metal] || intake?.metal },
    ...(intake?.category === "ring" ? [{ label: copy.size, value: cond.ringSize || "" }] : []),
    ...(intake?.category === "necklace" ? [
      { label: copy.chainStyle, value: optionLabel(intakeText, "chainStyles", cond.chainStyle) },
      { label: copy.chainLength, value: chainLengthLabel(cond.chainLength) },
      { label: copy.clasp, value: optionLabel(intakeText, "clasps", cond.clasp) },
    ] : []),
    ...(intake?.category === "bangle" ? [{ label: copy.size, value: optionLabel(intakeText, "braceletWrist", cond.wristSize) }] : []),
    ...(intake?.category === "earrings" ? [{ label: copy.pairSetup, value: optionLabel(intakeText, "earringPairing", cond.earringDetails) }] : []),
    { label: copy.stone, value: compactStoneSummary({ selected, intake, p }) },
    { label: copy.references, value: copy.referenceCount((intake?.referenceMedia || []).filter((m) => m.status !== "hidden").length) },
    { label: copy.requiredDate, value: order.requiredDate || intake?.requiredDate || "" },
    { label: copy.budget, value: intake?.budget ? usd(intake.budget) : "" },
    { label: copy.quote, value: quote ? usd(quote.totalUsd) : "" },
  ];
  return rows.filter((row) => row.value);
}

function ClientOrderBrief({ rows, order, waitingOn, due, statusLabel, copy }) {
  return (
    <aside className="client-order-brief">
      <div className="client-brief-top">
        <p className="section-label">{copy.orderBrief}</p>
        <strong>{order.id}</strong>
      </div>
      <div className="client-brief-status">
        <div><span>{copy.advisor}</span><strong>{waitingOn}</strong></div>
        <div><span>{copy.currentStatus}</span><strong>{statusLabel}</strong></div>
        <div><span>{copy.due}</span><strong>{due}</strong></div>
      </div>
      <dl className="client-brief-list client-brief-list-desktop">
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <details className="client-brief-mobile-details">
        <summary>{copy.detailsToggle}</summary>
        <dl className="client-brief-list">
          {rows.map((row) => (
            <div key={`${row.label}-${row.value}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </aside>
  );
}

function CustomerStatusOverview({ order, showStone, stoneState, designState, finalState, actions, milestones = [], hasDiamondCandidates = false, diamondSelectionSubmitted = false }) {
  const { locale } = useLocale();
  const copy = customerStatusCopy(locale);
  const openAction = actions?.find((action) => action.status === "open");
  const actionType = openAction?.type === "diamondSelection" && (!hasDiamondCandidates || diamondSelectionSubmitted) ? null : openAction?.type;
  const updateFor = (stage, fallback) => {
    const milestone = milestones.find((item) => item.stage === stage);
    return milestone?.publishToClient && milestone?.clientUpdate ? milestone.clientUpdate : fallback;
  };
  const toStepState = (key, fallbackState) => {
    const waiting =
      (key === "stone" && actionType === "diamondSelection") ||
      (key === "design" && ["cadReview", "cadApproval"].includes(actionType)) ||
      (key === "final" && actionType === "finalConfirmation");
    if (waiting) return "waiting";
    if (fallbackState === "done") return "done";
    if (fallbackState === "active" || fallbackState === "waiting") return "current";
    return "next";
  };
  const stoneFallback = showStone ? stoneState : order.status === "STYLE_SELECTION" ? "active" : "done";
  const stoneBody = showStone && order.status === "STONE_SELECTION" && stoneState !== "done"
    ? diamondSelectionSubmitted ? copy.stoneSubmittedBody : !hasDiamondCandidates ? copy.stonePendingBody : copy.stoneBody
    : copy.stoneBody;
  const steps = [
    { key: "stone", title: copy.stoneTitle, body: updateFor("diamondLocked", stoneBody), state: toStepState("stone", stoneFallback) },
    { key: "design", title: copy.designTitle, body: updateFor("cadIssued", copy.designBody), state: toStepState("design", designState) },
    { key: "final", title: copy.finalTitle, body: updateFor("finalQcVideo", copy.finalBody), state: toStepState("final", finalState) },
  ];
  const activeStep = steps.find((step) => step.state === "waiting") ||
    steps.find((step) => step.state === "current") ||
    steps.find((step) => step.state !== "done") ||
    steps[steps.length - 1];
  const labelFor = (state) => state === "done" ? copy.done : state === "waiting" ? copy.waiting : state === "current" ? copy.current : copy.next;

  return (
    <section className="panel customer-status-overview" aria-label={copy.kicker}>
      <div className="customer-status-copy">
        <p className="section-label">{copy.kicker}</p>
        <h3>{copy.title}</h3>
        <p>{activeStep?.body || copy.subtitle}</p>
      </div>
      <div className="customer-status-steps">
        {steps.map((step, index) => (
          <article className={`customer-status-step ${step.state}`} key={step.key}>
            <span className="customer-status-index">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{labelFor(step.state)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function mediaFrom(src) {
  if (!src) return null;
  return { kind: /\.(mp4|webm|mov)(\?|#|$)/i.test(src) ? "video" : "image", src };
}

function mediaList(media, fallbackSrc = "") {
  const items = Array.isArray(media) ? media.filter((m) => m?.src) : [];
  return items.length ? items : [mediaFrom(fallbackSrc)].filter(Boolean);
}

function ClientMediaCarousel({ media, alt = "", ratio = "1 / 1" }) {
  const items = (Array.isArray(media) ? media : []).filter((item) => item?.src);
  const [activeIndex, setActiveIndex] = useState(0);
  if (!items.length) return null;
  const safeIndex = activeIndex % items.length;
  const active = items[safeIndex];
  const canNavigate = items.length > 1;
  function move(delta, event) {
    event?.preventDefault();
    event?.stopPropagation();
    setActiveIndex((current) => (current + delta + items.length) % items.length);
  }
  return (
    <div className="client-media-carousel">
      <MediaThumb media={active} alt={alt} ratio={ratio} />
      {canNavigate && (
        <>
          <button className="client-media-arrow is-left" type="button" aria-label="Previous media" onClick={(event) => move(-1, event)}>
            <ChevronLeft size={24} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button className="client-media-arrow is-right" type="button" aria-label="Next media" onClick={(event) => move(1, event)}>
            <ChevronRight size={24} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <span className="client-media-counter">{safeIndex + 1} / {items.length}</span>
        </>
      )}
    </div>
  );
}

function formatMessageTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ConversationPanel({ messages, draft, setDraft, onSend, t }) {
  const copy = t.chat;
  return (
    <section className="panel conversation-panel">
      <div className="conversation-head">
        <div>
          <p className="section-label">{copy.title}</p>
          <p className="form-hint">{copy.sub}</p>
        </div>
        <span className="channel-pill">{copy.channels.web}</span>
      </div>
      <div className="conversation-thread" aria-live="polite">
        {messages.length === 0 ? (
          <p className="form-hint">{copy.empty}</p>
        ) : messages.map((message) => {
          const isCustomer = message.actorRole === "customer";
          return (
            <article className={`conversation-message ${isCustomer ? "is-customer" : "is-ops"}`} key={message.id}>
              <div className="conversation-meta">
                <span>{isCustomer ? copy.customer : copy.advisor}</span>
                <span>{copy.channels[message.channel] || message.channel}</span>
                <span>{formatMessageTime(message.createdAt)}</span>
              </div>
              {message.body && <p className="conversation-body">{message.body}</p>}
            </article>
          );
        })}
      </div>
      <form className="conversation-form" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={copy.placeholder} rows={2} />
        <button className="button primary small" type="submit" disabled={!draft.trim()}>{copy.send}</button>
      </form>
    </section>
  );
}

function CustomerDecisionPanel({
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
  approveDisabled = false,
  rejectDisabled = false,
}) {
  const { p } = useLocale();
  const t = p.portal;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");

  function submitReject() {
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError(t.rejectRequired);
      return;
    }
    onReject?.({ reason: cleanReason, attachments });
    setRejecting(false);
    setReason("");
    setAttachments([]);
    setError("");
  }

  return (
    <div className="customer-decision-panel">
      <div className="customer-decision-actions">
        <button className="button primary" type="button" disabled={approveDisabled} onClick={onApprove}>{approveLabel || t.confirm}</button>
        <button
          className="button secondary"
          type="button"
          disabled={rejectDisabled}
          onClick={() => { setRejecting((v) => !v); setError(""); }}
        >
          {rejectLabel || t.reject}
        </button>
      </div>
      {rejecting && (
        <div className="customer-reject-box">
          <label className="field">
            <span>{t.rejectReason}</span>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(""); }}
              placeholder={t.rejectReasonPh}
            />
          </label>
          <div className="field">
            <span>{t.rejectMedia}</span>
            <MediaPicker value={attachments} onChange={setAttachments} maxItems={5} showSamples={false} previewMode="list" />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary small" type="button" onClick={submitReject}>{t.sendRejection}</button>
        </div>
      )}
    </div>
  );
}

// 체크포인트 ② 디자인 — 비교 뷰 + 핀 수정요청. 자유 텍스트 입력 없음.
function DesignCard({ cad, mineMedia, orderId, actor, revisionsLeft, feeUsd, defaultMeasure, onNotice }) {
  const { p } = useLocale();
  const t = p.portal;
  const t2 = p.visual;
  const [measure, setMeasure] = useState(defaultMeasure || ""); // 인테이크에서 받은 사이즈로 프리필 — 재입력 불필요
  const cadMedia = mediaList(cad.media, cad.fileUrl);

  function approveDesign() {
    decideCad(cad.id, {
      decision: "approved",
      confirmedMeasurements: measure,
    }, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "cadReview");
    if (ca) respondCustomerAction(ca.id, { decision: "approved", value: `CAD V${cad.version} approved` }, actor);
    onNotice?.(t.noticeDesignApproved);
  }

  function rejectDesign({ reason, attachments }) {
    decideCad(cad.id, {
      decision: "minorRevision",
      feedback: [reason],
      confirmedMeasurements: measure,
      attachments,
    }, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "cadReview");
    if (ca) respondCustomerAction(ca.id, { decision: "rejected", reason, attachments }, actor);
    onNotice?.(t.noticeRejectionSent);
  }

  return (
    <>
      <div className="split-compare">
        <div>
          <p className="label">{t2.compareMine}</p>
          <MediaThumb media={mineMedia} ratio="4 / 3" alt={t2.compareMine} />
        </div>
        <div>
          <p className="label">{t2.compareVendor} — {t.cadVersion(cad.version)}</p>
          <MediaThumb media={cadMedia[0]} ratio="4 / 3" alt={t.cadTitle} />
        </div>
      </div>
      {cadMedia.length > 1 && (
        <div className="card-grid cols-3 client-cad-media-grid" style={{ marginTop: 10 }}>
          {cadMedia.map((m, i) => (
            <div key={`${m.src}-${i}`}>
              <p className="label">{t2.slots[m.slot] || m.slot}</p>
              <MediaThumb media={m} alt={m.slot} />
            </div>
          ))}
        </div>
      )}
      {cad.clientNote && <p className="feedback-note">{cad.clientNote}</p>}
      {!cad.decision && (
        <div className="form-stack" style={{ marginTop: 14 }}>
          <label className="field"><span>{t.cadMeasure}</span>
            <input value={measure} onChange={(e) => setMeasure(e.target.value)} /></label>
          <p className="form-hint">{revisionsLeft > 0 ? t2.revisionsLeft(revisionsLeft) : t2.feeNote(feeUsd)}</p>
          <CustomerDecisionPanel
            approveLabel={t2.approveCta || t.cadApprove}
            rejectLabel={t.rejectDesign || t2.reviseCta || t.cadRevise}
            onApprove={approveDesign}
            onReject={rejectDesign}
          />
        </div>
      )}
      {cad.decision === "minorRevision" && <p className="form-hint" style={{ marginTop: 10 }}>{t.cadDecided.minorRevision}</p>}
    </>
  );
}

export default function ClientPortal() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.portal;
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const code = params.get("code") || "";
  const actor = user?.id || `guest:${orderId}`;
  const [chatDraft, setChatDraft] = useState("");
  const [notice, setNotice] = useState("");

  const view = portalView(orderId, { customerId: user?.id, userRole: user?.role, queryCode: code });
  if (!view) {
    return <div className="page"><EmptyNote>{t.notFound}</EmptyNote></div>;
  }
  const { order, intake, style, candidates, selected, quote, milestones, cad, freeRevisionsLeft, designChangeFeeUsd, finalAction, actions, messages = [] } = view;
  const workspaceCopy = customerWorkspaceCopy(locale);
  const showStone = intake?.productLine === "solitaire";
  const hasDiamondCandidates = candidates.length > 0;
  const waitingForDiamondCandidates = showStone && !order.selectedDiamondId && order.status === "STONE_SELECTION" && !hasDiamondCandidates;
  const pendingDiamondSelection = candidates.find((c) => c.clientSelection === "selected" && !c.stockConfirmed);
  const diamondSelectionSubmitted = Boolean(pendingDiamondSelection?.selectionSubmittedAt);
  const rawActiveAction = actions?.[0] || null;
  const suppressDiamondAction = rawActiveAction?.type === "diamondSelection" && (waitingForDiamondCandidates || diamondSelectionSubmitted);
  const activeAction = suppressDiamondAction ? null : rawActiveAction;

  function notify(message) {
    setNotice(message);
  }

  function chooseDiamond(diaId) {
    if (diamondSelectionSubmitted) {
      notify(t.noticeSelectionAlreadySubmitted);
      return;
    }
    if (order.selectedDiamondId) {
      notify(t.noticeDiamondAlreadyConfirmed);
      return;
    }
    const target = candidates.find((c) => c.id === diaId);
    if (!target) return;
    if (target.availability === "sold") {
      notify(t.noticeSoldOut);
      return;
    }
    if (target.stockConfirmed) {
      notify(t.noticeDiamondAlreadyConfirmed);
      return;
    }
    if (target.clientSelection === "selected") {
      notify(t.noticeDiamondSelected);
      return;
    }
    candidates
      .filter((c) => c.clientSelection === "selected" && c.id !== diaId)
      .forEach((c) => toggleShortlist(c.id, actor));
    toggleShortlist(diaId, actor);
    notify(t.noticeDiamondSelected);
  }
  function reqStock() {
    if (!pendingDiamondSelection) {
      notify(t.noticeSelectFirst);
      return;
    }
    if (diamondSelectionSubmitted) {
      notify(t.noticeSelectionAlreadySubmitted);
      return;
    }
    requestStockConfirm(orderId, actor);
    notify(t.noticeSelectionSubmitted);
  }
  function lockOne(diaId) {
    lockSelectedCandidate(diaId, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "diamondSelection");
    if (ca) respondCustomerAction(ca.id, { decision: "approved", value: diaId }, actor);
    notify(t.noticeDiamondConfirmed);
  }
  function accept() {
    acceptQuote(quote.id, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "quoteAcceptance");
    if (ca) respondCustomerAction(ca.id, quote.id, actor);
    notify(t.noticeQuoteAccepted);
  }
  function sendChat() {
    const body = chatDraft.trim();
    if (!body) return;
    sendOrderMessage(orderId, { body, channel: "web", actorRole: "customer", actorId: actor });
    setChatDraft("");
    notify(t.noticeMessageSent);
  }
  function rejectDiamonds(payload) {
    if (diamondSelectionSubmitted) {
      notify(t.noticeSelectionAlreadySubmitted);
      return;
    }
    rejectDiamondCandidates(orderId, payload, actor);
    notify(t.noticeRejectionSent);
  }
  function rejectFinal(payload) {
    rejectFinalConfirmation(orderId, payload, actor);
    notify(t.noticeRejectionSent);
  }
  function confirmFinishedPiece() {
    confirmFinal(orderId, actor);
    notify(t.noticeFinalConfirmed);
  }

  const anySelected = selected || candidates.some((c) => c.clientSelection === "selected");
  const lockableDiamond = candidates.find((c) => c.clientSelection === "selected" && c.stockConfirmed && c.availability === "available");

  // 타임라인 체크포인트 상태 — 스톤(솔리테어만) → 디자인 → 최종 실물
  // 선택했지만 아직 벤더 재고 확인(자동 락) 전이면 "확인 중" 상태로 유지
  const stoneState = order.selectedDiamondId ? "done"
    : waitingForDiamondCandidates || diamondSelectionSubmitted ? "waiting"
      : order.status === "STONE_SELECTION" ? "active" : "upcoming";
  const stockChecking = !order.selectedDiamondId && anySelected;
  const designState = cad?.decision === "approved" ? "done" : cad && !cad.decision ? "active" : "upcoming";
  const finalState = finalAction ? "active"
    : ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status) ? "done" : "upcoming";
  const approvedRef = intake?.referenceMedia?.find((m) => m.status === "approved");
  const mineMedia = approvedRef
    ? { kind: approvedRef.kind, src: approvedRef.src }
    : style ? { kind: "image", src: style.coverImage } : null;
  // 인테이크에서 이미 받은 치수 — CAD 승인 화면 "치수 확인"을 프리필해 재입력을 없앤다
  const cond = intake?.conditional || {};
  const defaultMeasure = cond.ringSize || cond.chainLength || cond.wristSize || cond.earringDetails || "";

  // 고객용 "다음 단계" 한 줄 — 어드민의 next-step 카드를 고객에게도 (문의 감소)
  const nextMsg = waitingForDiamondCandidates ? workspaceCopy.stonePreparingBody
    : diamondSelectionSubmitted ? t.selectionSubmittedHelp
    : (order.status === "QUOTATION" && quote?.status === "accepted") ? t.nextDeposit
    : (order.status === "CAD" && cad && !cad.decision) ? t.nextCadReview
      : t.nextStep?.[order.status] || "";
  const waitingOn = waitingForDiamondCandidates || diamondSelectionSubmitted ? t.waitingBeloveD
    : activeAction ? t.waitingYou
      : ["PRODUCTION", "QC", "SHIPPING"].includes(order.status) ? t.waitingAtelier : t.waitingBeloveD;
  const activeActionText = waitingForDiamondCandidates ? workspaceCopy.stonePreparingBody
    : diamondSelectionSubmitted ? t.selectionSubmittedHelp
    : activeAction
    ? (t.todo?.[activeAction.type] || activeAction.prompt || nextMsg || t.reviewUpdates)
    : (nextMsg || t.reviewUpdates);
  const finalMedia = mediaList(finalAction?.media, finalAction?.link);
  const statusLabel = t.statusLabel?.[order.status] || p.orderStatus[order.status] || order.status;
  const dueLabel = activeAction?.dueDate || order.requiredDate || workspaceCopy.noDue;
  const activeAnchor = waitingForDiamondCandidates || diamondSelectionSubmitted ? "#conversation"
    : activeAction?.type === "diamondSelection" ? "#stone-stage"
    : ["cadReview", "cadApproval"].includes(activeAction?.type) ? "#design-stage"
      : activeAction?.type === "finalConfirmation" ? "#final-stage"
        : "#conversation";
  const briefRows = buildOrderBriefRows({ order, intake, style, selected, quote, p, locale, copy: workspaceCopy });

  return (
    <div className="page client-portal-page">
      <section className="client-workspace-hero">
        <div className="client-next-card">
          <p className="section-label">{activeAction ? workspaceCopy.nextKicker : workspaceCopy.statusKicker}</p>
          <h1>{activeAction ? workspaceCopy.titleReady : workspaceCopy.titleWaiting}</h1>
          <p className="client-next-copy">{activeActionText}</p>
          <div className="client-next-meta">
            <span>{workspaceCopy.orderLine(order.id)}</span>
            <span className={`status-badge ost-${order.status}`}>{statusLabel}</span>
            <span>{workspaceCopy.due}: {dueLabel}</span>
          </div>
          <div className="row-actions client-next-actions">
            {waitingForDiamondCandidates || diamondSelectionSubmitted ? (
              <a className="button primary" href="#conversation">{workspaceCopy.chat}</a>
            ) : (
              <>
                <a className="button primary" href={activeAnchor}>{workspaceCopy.goToAction}</a>
                <a className="button secondary" href="#conversation">{workspaceCopy.chat}</a>
              </>
            )}
          </div>
        </div>
        <ClientOrderBrief
          rows={briefRows}
          order={order}
          waitingOn={waitingOn}
          due={dueLabel}
          statusLabel={statusLabel}
          copy={workspaceCopy}
        />
      </section>

      {notice && (
        <p className="client-action-notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      <CustomerStatusOverview
        order={order}
        showStone={showStone}
        stoneState={stoneState}
        designState={designState}
        finalState={finalState}
        actions={actions}
        milestones={milestones}
        hasDiamondCandidates={hasDiamondCandidates}
        diamondSelectionSubmitted={diamondSelectionSubmitted}
      />

      {/* 체크포인트 ① 스톤 (published 후보만) */}
      {showStone && (
        <Checkpoint id="stone-stage" index={1} title={waitingForDiamondCandidates ? workspaceCopy.stonePreparingTitle : p.visual.checkpoint.stone} state={stoneState}
          badgeOverride={waitingForDiamondCandidates ? workspaceCopy.stonePreparingBadge : undefined}
          summary={selected && `${p.shapes[selected.shape] || selected.shape} ${selected.carat?.toFixed(2)}ct · ${selected.igiNo}`}>
          {stockChecking && <p className="warn-note" style={{ marginBottom: 14 }}>{p.visual.stockChecking}</p>}
          {waitingForDiamondCandidates && (
            <div className="client-empty-stage">
              <p className="section-label">{workspaceCopy.stonePreparingBadge}</p>
              <h4>{workspaceCopy.stonePreparingTitle}</h4>
              <p>{workspaceCopy.stonePreparingBody}</p>
              <a className="button secondary small" href="#conversation">{workspaceCopy.chat}</a>
            </div>
          )}
          {candidates.length > 0 && (
            <>
              <div className="diamond-selection-note">
                <p className="section-label">{t.optionsLabel(candidates.length)}</p>
                <h3>
                  {selected ? t.confirmedStone
                    : diamondSelectionSubmitted ? t.selectionSubmittedKicker
                      : pendingDiamondSelection ? `${p.shapes[pendingDiamondSelection.shape] || pendingDiamondSelection.shape} ${pendingDiamondSelection.carat.toFixed(2)}ct`
                      : t.selectOneTitle}
                </h3>
                <p>{selected ? `${p.shapes[selected.shape] || selected.shape} ${selected.carat?.toFixed(2)}ct · ${selected.igiNo}`
                  : diamondSelectionSubmitted ? t.selectionSubmittedHelp
                    : pendingDiamondSelection ? t.submitSelectionHelp
                      : `${t.selectOneHelp} ${t.batchNote}`}</p>
              </div>
              <div className="card-grid cols-3">
                {candidates.map((c) => {
                  const candidateMedia = mediaList(c.media, c.video || c.image);
                  const isFinalSelected = selected?.id === c.id;
                  const isPendingSelected = pendingDiamondSelection?.id === c.id;
                  const canChoose = !order.selectedDiamondId && order.status === "STONE_SELECTION" && !diamondSelectionSubmitted && c.availability !== "sold" && !c.stockConfirmed;
                  const showSelectionBadge = (isPendingSelected || isFinalSelected) && !(diamondSelectionSubmitted && !isFinalSelected);
                  return (
                    <div className={`item-card diamond-choice-card ${isPendingSelected || isFinalSelected ? "select-card is-selected" : ""}`} key={c.id}>
                      <ClientMediaCarousel media={candidateMedia} alt={c.id} />
                      <div className="card-body">
                        <div className="diamond-card-head">
                          {showSelectionBadge && (
                            <span className="status-badge mst-done">
                              {isFinalSelected ? t.confirmedStone : diamondSelectionSubmitted ? t.submittedSelection : t.shortlisted}
                            </span>
                          )}
                          {c.availability === "sold" && <span className="status-badge cst-REJECTED">{t.soldOut}</span>}
                        </div>
                        <h3>{p.shapes[c.shape] || c.shape} {c.carat.toFixed(2)}ct</h3>
                        <p className="spec">{c.color} / {c.clarity} · {p.portal.growth[c.growth] || c.growth} · {c.lab}</p>
                        <p className="spec">{t.igi} {c.igiNo} · {t.treated}</p>
                        {c.proportions?.faceUp && <p className="spec">T{c.proportions.table} · D{c.proportions.depth} · {c.proportions.faceUp}</p>}
                        {c.clientNote && <p className="form-hint">{c.clientNote}</p>}
                        <p className="price">{usd(c.customerPriceUsd)}</p>
                        {isFinalSelected ? null : !diamondSelectionSubmitted && !order.selectedDiamondId && order.status === "STONE_SELECTION" ? (
                          c.stockConfirmed && c.clientSelection === "selected" ? (
                            <div className="row-actions diamond-card-actions">
                              <span className="status-badge mst-done">{t.inStock}</span>
                              <button className="button primary small" onClick={() => lockOne(c.id)}>{t.lockThis}</button>
                            </div>
                          ) : (
                            <button
                              className={`button small diamond-select-button ${isPendingSelected ? "primary is-active" : "secondary"}`}
                              disabled={!canChoose && !isPendingSelected}
                              onClick={() => chooseDiamond(c.id)}
                            >
                              {isPendingSelected ? (diamondSelectionSubmitted ? t.submittedSelection : t.shortlisted) : t.shortlist}
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!order.selectedDiamondId && order.status === "STONE_SELECTION" && !diamondSelectionSubmitted && (
                <div className="diamond-submit-panel">
                  <div>
                    <p className="section-label">{lockableDiamond ? t.inStock : pendingDiamondSelection ? t.selectedKicker : t.actionsTitle}</p>
                    <h3>{lockableDiamond ? `${p.shapes[lockableDiamond.shape] || lockableDiamond.shape} ${lockableDiamond.carat.toFixed(2)}ct` : pendingDiamondSelection ? `${p.shapes[pendingDiamondSelection.shape] || pendingDiamondSelection.shape} ${pendingDiamondSelection.carat.toFixed(2)}ct` : t.selectOneTitle}</h3>
                    <p>{lockableDiamond ? t.lockThis : pendingDiamondSelection ? t.submitSelectionHelp : t.selectOneHelp}</p>
                  </div>
                  <CustomerDecisionPanel
                    approveLabel={lockableDiamond ? t.lockThis : t.requestStock}
                    rejectLabel={t.rejectDiamonds}
                    approveDisabled={lockableDiamond ? false : !pendingDiamondSelection}
                    onApprove={() => (lockableDiamond ? lockOne(lockableDiamond.id) : reqStock())}
                    onReject={rejectDiamonds}
                  />
                </div>
              )}
            </>
          )}
        </Checkpoint>
      )}

      {/* 견적 */}
      {quote && (
        <div className="panel pay-panel">
          <div className="proposal-head">
            <h3 style={{ margin: 0 }}>{t.quoteTitle} — {quote.id}</h3>
            {quote.status === "accepted" && <span className="status-badge cst-REPLACED">{t.accepted}</span>}
          </div>
          <table className="data-table"><tbody>
            {quote.diamondAmountUsd > 0 && <tr><th>{t.diamondAmount}</th><td>{usd(quote.diamondAmountUsd)}</td></tr>}
            <tr><th>{t.metalAmount}</th><td>{usd(quote.metalAmountUsd)} <span className="form-hint">({quote.estWeightG}g)</span></td></tr>
            <tr><th>{t.packageAmount}</th><td>{usd(quote.nonMetalUsd)}</td></tr>
            <tr><th>{t.total}</th><td className="price">{usd(quote.totalUsd)}</td></tr>
            <tr><th>{t.deposit}</th><td>{usd(quote.depositUsd)}</td></tr>
            <tr><th>{t.balance}</th><td>{usd(quote.balanceUsd)}</td></tr>
            <tr><th>{t.validUntil}</th><td>{quote.validUntil} · {t.lead(quote.leadDays)}</td></tr>
          </tbody></table>
          {quote.status === "sent" && (
            <button className="button primary" style={{ marginTop: 16 }} onClick={accept}>{t.accept}</button>
          )}
        </div>
      )}

      {/* 체크포인트 ② 디자인 */}
      <Checkpoint id="design-stage" index={2} title={p.visual.checkpoint.design} state={designState}
        summary={cad?.decision === "approved" ? `${t.cadVersion(cad.version)} ✓` : null}>
        {cad && <DesignCard cad={cad} mineMedia={mineMedia} orderId={orderId} actor={actor}
          revisionsLeft={freeRevisionsLeft} feeUsd={designChangeFeeUsd} defaultMeasure={defaultMeasure} onNotice={notify} />}
      </Checkpoint>

      {/* 체크포인트 ③ 최종 실물 컨펌 */}
      <Checkpoint id="final-stage" index={3} title={p.visual.checkpoint.final} state={finalState}
        summary={finalState === "done" ? p.visual.finalConfirmed : null}>
        {finalAction && (
          <div className="form-stack">
            <h3 style={{ margin: 0 }}>{p.visual.finalTitle}</h3>
            {finalMedia.length > 0 && <ClientMediaCarousel media={finalMedia} ratio="16 / 9" alt={p.visual.finalTitle} />}
            {finalAction.note && <p className="feedback-note">{finalAction.note}</p>}
            <p className="warn-note">{p.visual.finalNotice}</p>
            <CustomerDecisionPanel
              approveLabel={p.visual.finalConfirm}
              rejectLabel={t.rejectFinal}
              onApprove={confirmFinishedPiece}
              onReject={rejectFinal}
            />
          </div>
        )}
      </Checkpoint>

      <div id="conversation">
        <ConversationPanel messages={messages} draft={chatDraft} setDraft={setChatDraft} onSend={sendChat} t={t} />
      </div>

    </div>
  );
}
