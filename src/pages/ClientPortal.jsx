import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import {
  acceptQuote, confirmFinal, getSettings, listCustomerActions, listReviews, portalView,
  rejectFinalConfirmation, reportDepositSent, respondCustomerAction, sendOrderMessage,
  updateShippingAddress, isShippingAddressComplete,
} from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaPicker, MediaThumb, usd } from "../components/ui.jsx";
import ReviewForm from "../components/ReviewForm.jsx";
import ServerOrderPortal from "./ServerOrderPortal.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";
import { formatCaratRange, formatGradeRange } from "../lib/gradeScale.js";
import RequestedSpecCard from "../components/RequestedSpecCard.jsx";
import { PROPOSAL_FLOW_COPY } from "../lib/proposalFlowCopy.js";

// 게스트 조회 입력 (Order ID + 쿼리코드)
export function TrackEntry() {
  const { p } = useLocale();
  const t = p.portal;
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [code, setCode] = useState("");
  // 실주문(BD-)은 이메일 로그인으로 열린다 — 조회 코드는 구 데모(DM-) 주문 전용 레거시
  const isLegacy = /^\s*dm-/i.test(orderId);
  function open(e) {
    e.preventDefault();
    const id = orderId.trim().toUpperCase();
    navigate(isLegacy ? `/orders/${id}?code=${code.trim().toUpperCase()}` : `/orders/${id}`);
  }
  return (
    <div className="page page-narrow">
      <h1 className="page-title">{t.guestTitle}</h1>
      <form className="panel form-stack" onSubmit={open}>
        <label className="field"><span>{t.orderId}</span><input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="BD-100001" required /></label>
        {isLegacy && (
          <label className="field"><span>{t.code}</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" required /></label>
        )}
        <p className="form-hint" style={{ margin: 0 }}>{t.trackHint}</p>
        <button className="button primary" type="submit">{t.open}</button>
      </form>
    </div>
  );
}

// 타임라인 체크포인트 래퍼 — done은 접고, active만 펼친다 (실서버 포털도 재사용)
export function Checkpoint({ id, index, title, state, summary, children, badgeOverride }) {
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

// (구 ConfirmationRail은 미사용 데드코드였음 — 레일 마크업은 ServerOrderPortal이 직접 렌더)


const REVIEW_COPY = {
  en: { title: "Leave a review", done: "Thank you — your review is being curated before it goes live.", published: "Your review is live on our homepage. Thank you!", rating: "Rating", quoteLbl: "One line", quotePh: "She said yes.", bodyLbl: "Your story (optional)", mediaLbl: "Photos & video first (max 5)", submit: "Submit review", note: "Verified with your order number. Curated before publishing." },
  ko: { title: "리뷰 남기기", done: "감사합니다 — 검수 후 홈페이지에 게시됩니다.", published: "리뷰가 홈페이지에 게시되었습니다. 감사합니다!", rating: "별점", quoteLbl: "한 줄 소감", quotePh: "She said yes.", bodyLbl: "이야기 (선택)", mediaLbl: "사진·영상 먼저 (최대 5)", submit: "리뷰 제출", note: "주문번호로 자동 인증됩니다. 검수 후 게시돼요." },
  zh: { title: "留下评价", done: "谢谢 — 审核后将展示在首页。", published: "您的评价已在首页展示，谢谢！", rating: "评分", quoteLbl: "一句话", quotePh: "She said yes.", bodyLbl: "您的故事（可选）", mediaLbl: "照片·视频优先（最多 5）", submit: "提交评价", note: "通过订单号自动认证，审核后发布。" },
  es: { title: "Deja una reseña", done: "Gracias — tu reseña se curará antes de publicarse.", published: "Tu reseña está en nuestra página. ¡Gracias!", rating: "Calificación", quoteLbl: "Una línea", quotePh: "She said yes.", bodyLbl: "Tu historia (opcional)", mediaLbl: "Fotos y video primero (máx. 5)", submit: "Enviar reseña", note: "Verificada con tu número de pedido. Se cura antes de publicar." },
};

function proposalFlowCopy(locale) {
  return PROPOSAL_FLOW_COPY[locale] || PROPOSAL_FLOW_COPY.en;
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
    // 캐럿·등급 range 라벨 우선, 레거시 단일값 폴백
    const caratLbl = formatCaratRange(prefs.caratRange) || `${prefs.carat}ct`;
    const colorLbl = formatGradeRange(prefs.colorRange) || prefs.color;
    const clarityLbl = formatGradeRange(prefs.clarityRange) || prefs.clarity;
    return `${p.shapes[prefs.shape] || prefs.shape} ${caratLbl} · ${colorLbl}/${clarityLbl}`;
  }
  const spec = intake?.multiSpec;
  if (spec?.totalCaratRange || spec?.totalCarat || spec?.meleeSpec || spec?.overallDims) {
    const totalLbl = formatCaratRange(spec.totalCaratRange)
      ? `${formatCaratRange(spec.totalCaratRange)} total`
      : (spec.totalCarat && `${spec.totalCarat}ct total`);
    return [totalLbl, spec.standard, spec.meleeSpec, spec.overallDims].filter(Boolean).join(" · ");
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
    { label: intakeText.gflow?.engravingLbl || "Engraving", value: (intake?.engraving || "").trim() },
    { label: intakeText.gflow?.couponTitle || "Coupon", value: (intake?.couponCode || "").trim() },
    { label: copy.stone, value: compactStoneSummary({ selected, intake, p }) },
    { label: copy.references, value: copy.referenceCount((intake?.referenceMedia || []).filter((m) => m.status !== "hidden").length) },
    { label: copy.requiredDate, value: order.requiredDate || intake?.requiredDate || "" },
    { label: copy.budget, value: intake?.budget ? usd(intake.budget) : "" },
    { label: copy.quote, value: quote ? usd(quote.totalUsd) : "" },
  ];
  return rows.filter((row) => row.value);
}


// 카테고리 조건부 사이즈 요약 (제안 카드 Setting 라인)
function conditionalSizeSummary(intake, t) {
  const cond = intake?.conditional || {};
  // 시드/구버전 데이터는 "6 US"처럼 단위를 이미 포함할 수 있다 — "US 6 US" 중복 방지
  if (cond.ringSize) return /us/i.test(cond.ringSize) ? cond.ringSize : `US ${cond.ringSize}`;
  if (cond.chainLength) return chainLengthLabel(cond.chainLength);
  if (cond.wristSize) return optionLabel(t, "braceletWrist", cond.wristSize);
  if (cond.earringDetails) return optionLabel(t, "earringPairing", cond.earringDetails);
  return "";
}

// 확정 제안 카드 — 미디어 캐러셀 + 스펙 + 총액(총액만) + 동급 대체 안내 + 컨펌
// 제품 초안 카드 — 스톤은 부품 중 하나. 디자인 미디어를 히어로로, 세팅·메탈·스톤·
// 타임라인을 오더 시트처럼 정리하고 가격(총액·디파짓/잔금)을 옆에 붙인다.
function ProposalCard({ quote, intake, style, fc, t, p, locale, shippingProps, onConfirm, confirmDisabled }) {
  const spec = quote.stoneSpec;
  const media = quote.proposalMedia?.length
    ? quote.proposalMedia
    : mediaList(style?.media, style?.coverImage);
  const sizeSummary = conditionalSizeSummary(intake, p.intake);
  const settingSummary = quote.settingSummary || [
    style ? pickI18n(style.name, locale) : (p.opsCategories?.[intake?.category] || ""),
    sizeSummary,
  ].filter(Boolean).join(" · ");
  const metalSummary = [
    p.opsMetals?.[intake?.metal] || "",
    quote.estWeightG ? fc.weightApprox(quote.estWeightG) : "",
  ].filter(Boolean).join(" · ");
  const confirmed = quote.status === "accepted";
  // 스테이지(Checkpoint) 안에 들어가는 콘텐츠 전용 — 헤더/배지는 스테이지가 담당
  return (
    <div className="proposal-card">
      <div className="proposal-hero">
        {/* cover — 제품 사진이 프레임을 꽉 채운다 (contain은 아이보리 레터박스가 생김) */}
        <ClientMediaCarousel media={media} alt={quote.id} ratio="16 / 10" fit="cover" />
      </div>
      <div className="proposal-card-body">
        <div className="proposal-piece">
          <p className="section-label">{fc.pieceTitle}</p>
          <dl className="proposal-spec">
            {settingSummary && <div><dt>{fc.specSetting}</dt><dd>{settingSummary}</dd></div>}
            {quote.settingNote && (
              <div className="is-design-note"><dt>{fc.designNote}</dt><dd>{quote.settingNote}</dd></div>
            )}
            {metalSummary && <div><dt>{fc.specMetal}</dt><dd>{metalSummary}</dd></div>}
            {spec && (
              <>
                {/* 캐럿은 확정 전 범위 표기 (1.50–1.55ct) — 등급은 보장값으로 고정 표기 */}
                <div><dt>{fc.specStone}</dt><dd>
                  {p.shapes[spec.shape] || spec.shape} · {Number(spec.carat).toFixed(2)}
                  {Number(spec.caratMax) > Number(spec.carat) ? `–${Number(spec.caratMax).toFixed(2)}` : ""}ct
                </dd></div>
                <div><dt>{fc.specGrade}</dt><dd>{[spec.color, spec.clarity, spec.growth].filter(Boolean).join(" · ")}</dd></div>
                {spec.igiNo && <div><dt>{fc.specCert}</dt><dd>{spec.lab || "IGI"} {spec.igiNo}</dd></div>}
              </>
            )}
            <div><dt>{fc.specLead}</dt><dd>{t.lead(quote.leadDays)}</dd></div>
          </dl>
        </div>
        <aside className="proposal-pricing">
          <p className="section-label">{fc.priceTitle}</p>
          <div className="proposal-total">
            <span className="proposal-total-label">{fc.totalLabel}</span>
            <div className="proposal-amount">{usd(quote.totalUsd)}</div>
            <p className="form-hint">{fc.totalMeta}</p>
          </div>
          <div className="proposal-split">
            <div><span>{fc.depositToday}</span><strong>{usd(quote.depositUsd)}</strong></div>
            <div><span>{fc.balanceShip}</span><strong>{usd(quote.balanceUsd)}</strong></div>
          </div>
          <p className="proposal-validity">{t.validUntil}: {quote.validUntil}</p>
        </aside>
      </div>
      <p className="proposal-sub-note"><strong>{fc.subTitle}.</strong> {quote.substitutionNote || fc.subBody}</p>
      <ShippingAddressPanel {...shippingProps} />
      {!confirmed && (
        <button className="button primary proposal-confirm" type="button" disabled={confirmDisabled} onClick={onConfirm}>
          {fc.confirmCta}
        </button>
      )}
    </div>
  );
}

// Zelle/Venmo 결제 내용 — 디파짓·잔금 공용. 스테이지 안 콘텐츠 전용 (reported면 안내문, 아니면 셀프리포트 버튼)
// memoText: 송금 앱 메모에 그대로 붙여넣는 완성 메시지 (예: "BeloveD DM-000009 · Deposit")
// 실서버 포털(ServerOrderPortal)도 재사용 — 결제 핸들·QR은 시드 settings에서
export function PaymentCard({ amountUsd, amountLabel = "", amountContext = "", memoText, reported, fc, sentCta, reportedNote, onReport, reportDisabled = false, reportHint = "" }) {
  const payment = getSettings().payment || {};
  const [copiedKey, setCopiedKey] = useState("");
  const methods = [
    { key: "zelle", name: "Zelle", handle: payment.zelle, hint: fc.zelleHint, qr: "/assets/payment/zelle-qr.jpeg" },
    { key: "venmo", name: "Venmo", handle: payment.venmo, hint: fc.venmoHint, qr: "/assets/payment/venmo-qr.jpeg" },
  ].filter((m) => m.handle);
  function copyHandle(key, value) {
    try { navigator.clipboard?.writeText(value); } catch { /* 클립보드 미지원 브라우저 */ }
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1600);
  }
  return (
    <div className="payment-card">
      <div className="payment-hero">
        {amountLabel && <span className="payment-amount-label">{amountLabel}</span>}
        <div className="payment-amount">{usd(amountUsd)}</div>
        {amountContext && <p className="payment-amount-context">{amountContext}</p>}
      </div>

      {/* 1 · 보내기 — QR 스캔 또는 받는 계정 복사 (핸들 원문은 노출하지 않는다) */}
      <div className="payment-step"><span className="payment-step-no">1</span><p>{fc.payStep1}</p></div>
      <div className="payment-methods">
        {methods.map((m) => (
          <div className="payment-method" key={m.key}>
            <div className="payment-method-head">
              <h4>{m.name}</h4>
              <small>{m.hint}</small>
            </div>
            {/* QR은 스캔 대비를 위해 다크 모드에서도 흰 바탕 유지 */}
            <img className="payment-qr" src={m.qr} alt={`${m.name} QR`} loading="lazy" />
            <button
              className={`payment-handle ${copiedKey === m.key ? "is-copied" : ""}`}
              type="button"
              onClick={() => copyHandle(m.key, m.handle)}
            >
              {copiedKey === m.key ? fc.copiedBtn : fc.copyRecipient}
            </button>
          </div>
        ))}
      </div>
      {/* 파일럿 안내 — 지금은 Zelle/Venmo, 카드 결제는 곧 추가 */}
      {fc.pilotNote && <p className="payment-pilot-note">{fc.pilotNote}</p>}

      {/* 2 · 메모 — 주문번호가 있어야만 입금 매칭이 가능하다는 걸 강조 */}
      <div className="payment-step"><span className="payment-step-no">2</span><p>{fc.payStep2}</p></div>
      <div className="payment-memo-block">
        <span className="payment-memo-label">{fc.memoLabel} · {fc.memoRequired}</span>
        <button
          className={`payment-memo-pill ${copiedKey === "memo" ? "is-copied" : ""}`}
          type="button"
          onClick={() => copyHandle("memo", memoText)}
        >
          <strong>{memoText}</strong>
          <em>{copiedKey === "memo" ? fc.copiedBtn : fc.copyBtn}</em>
        </button>
      </div>

      {/* 3 · 보고 — 셀프 리포트 버튼 */}
      <div className="payment-step"><span className="payment-step-no">3</span><p>{fc.payStep3}</p></div>
      {payment.note && <p className="form-hint">{payment.note}</p>}
      {reported
        ? <p className="payment-reported" role="status">{reportedNote}</p>
        : (
          <>
            {reportDisabled && reportHint && <p className="form-error" style={{ textAlign: "center" }}>{reportHint}</p>}
            <button className="button primary payment-sent" type="button" disabled={reportDisabled} onClick={onReport}>{sentCta}</button>
          </>
        )}
      <p className="payment-sent-help">{fc.sentHelp}</p>
    </div>
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

function ClientMediaCarousel({ media, alt = "", ratio = "1 / 1", fit = "cover" }) {
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
      <MediaThumb media={active} alt={alt} ratio={ratio} fit={fit} />
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

function initialShippingAddress(order, intake) {
  const saved = order?.shippingAddress || {};
  const contact = intake?.contact || "";
  const phone = saved.phone || (/@/.test(contact) ? "" : contact);
  return {
    recipientName: saved.recipientName || order?.customerName || intake?.name || "",
    phone,
    addressLine1: saved.addressLine1 || "",
    addressLine2: saved.addressLine2 || "",
    city: saved.city || "",
    region: saved.region || "",
    postalCode: saved.postalCode || "",
    country: saved.country || intake?.country || "",
    notes: saved.notes || "",
  };
}

export function ShippingAddressPanel({ value, onChange, t, locked = false, onSave = null, canSave = false }) {
  const complete = isShippingAddressComplete(value);
  function setField(key, nextValue) {
    onChange((current) => ({ ...value, ...(current || {}), [key]: nextValue }));
  }
  return (
    <section className="shipping-address-card">
      <div className="shipping-address-head">
        <div>
          <p className="section-label">{t.shippingKicker}</p>
          <h4>{t.shippingTitle}</h4>
          <p className="form-hint">{t.shippingHelp}</p>
        </div>
        {locked && complete && <span className="status-badge cst-REPLACED">{t.shippingConfirmed}</span>}
      </div>
      <div className="filter-grid shipping-address-grid">
        <label className="field"><span>{t.shippingRecipient}</span>
          <input value={value.recipientName} onChange={(e) => setField("recipientName", e.target.value)} disabled={locked} required />
        </label>
        <label className="field"><span>{t.shippingPhone}</span>
          <input value={value.phone} onChange={(e) => setField("phone", e.target.value)} disabled={locked} required />
        </label>
        <label className="field shipping-address-wide"><span>{t.shippingLine1}</span>
          <input value={value.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} disabled={locked} required />
        </label>
        <label className="field shipping-address-wide"><span>{t.shippingLine2}</span>
          <input value={value.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} disabled={locked} />
        </label>
        <label className="field"><span>{t.shippingCity}</span>
          <input value={value.city} onChange={(e) => setField("city", e.target.value)} disabled={locked} required />
        </label>
        <label className="field"><span>{t.shippingRegion}</span>
          <input value={value.region} onChange={(e) => setField("region", e.target.value)} disabled={locked} required />
        </label>
        <label className="field"><span>{t.shippingPostal}</span>
          <input value={value.postalCode} onChange={(e) => setField("postalCode", e.target.value)} disabled={locked} required />
        </label>
        <label className="field"><span>{t.shippingCountry}</span>
          <input value={value.country} onChange={(e) => setField("country", e.target.value)} disabled={locked} required />
        </label>
        <label className="field shipping-address-wide"><span>{t.shippingNotes}</span>
          <input value={value.notes} onChange={(e) => setField("notes", e.target.value)} disabled={locked} />
        </label>
      </div>
      {!locked && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 6 }}>
          <p className="form-hint" style={{ margin: 0 }}>{complete ? "" : t.shippingRequired}</p>
          {canSave && onSave && (
            <button className="button primary small" type="button" disabled={!complete} onClick={onSave}>{t.shippingSave}</button>
          )}
        </div>
      )}
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

// 라우트 진입점 — 실서버 주문(BD-)은 Postgres 포털로, 데모 주문(DM-)은 로컬 스토어 포털로.
// 훅 순서가 orderId에 따라 달라지지 않도록 분기는 래퍼에서 한다.
export default function ClientPortalRoute() {
  const { orderId } = useParams();
  if (/^BD-/i.test(orderId || "")) return <ServerOrderPortal orderCode={orderId.toUpperCase()} />;
  return <ClientPortal />;
}

function ClientPortal() {
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
  const [shippingAddress, setShippingAddress] = useState(null);
  const [codeDraft, setCodeDraft] = useState("");
  const navigate = useNavigate();

  const view = portalView(orderId, { customerId: user?.id, userRole: user?.role, queryCode: code });
  if (!view) {
    // 코드가 없거나 틀림 — 빈 문구 대신 바로 코드 입력으로 안내
    return (
      <div className="page page-narrow">
        <h1 className="page-title">{t.guestTitle}</h1>
        <form
          className="panel form-stack"
          onSubmit={(e) => { e.preventDefault(); navigate(`/orders/${orderId}?code=${codeDraft.trim().toUpperCase()}`); }}
        >
          <p className="form-hint">{t.notFound}</p>
          <label className="field"><span>{t.orderId}</span><input value={orderId} readOnly /></label>
          <label className="field"><span>{t.code}</span>
            <input value={codeDraft} onChange={(e) => setCodeDraft(e.target.value)} placeholder="XXXX-XXXX" required autoFocus />
          </label>
          <button className="button primary" type="submit">{t.open}</button>
        </form>
      </div>
    );
  }
  const { order, intake, style, selected, quote, milestones, finalAction, actions, messages = [] } = view;
  const shippingAddressDraft = shippingAddress || initialShippingAddress(order, intake);
  const shippingAddressComplete = isShippingAddressComplete(shippingAddressDraft);
  const shippingAddressSaved = isShippingAddressComplete(order.shippingAddress);
  const workspaceCopy = customerWorkspaceCopy(locale);
  const fc = proposalFlowCopy(locale);
  // 디파짓 확인 여부: 마일스톤 done 또는 이미 제작 단계 진입
  const depositMilestone = milestones.find((m) => m.stage === "depositReceived");
  const depositDone = depositMilestone?.status === "done"
    || ["CAD", "PRODUCTION", "QC", "BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status);
  const proposalPreparing = !quote;
  const depositReported = Boolean(quote?.depositReportedAt);
  const activeAction = actions?.[0] || null;

  function notify(message) {
    setNotice(message);
  }

  function accept() {
    if (!shippingAddressComplete) {
      notify(t.noticeShippingAddressRequired);
      return;
    }
    updateShippingAddress(orderId, shippingAddressDraft, actor);
    acceptQuote(quote.id, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "quoteAcceptance");
    if (ca) respondCustomerAction(ca.id, quote.id, actor);
    notify(t.noticeQuoteAccepted);
  }
  function saveShippingAddress() {
    if (!shippingAddressComplete) {
      notify(t.noticeShippingAddressRequired);
      return;
    }
    updateShippingAddress(orderId, shippingAddressDraft, actor);
    notify(t.noticeShippingAddressSaved);
  }
  function sendChat() {
    const body = chatDraft.trim();
    if (!body) return;
    sendOrderMessage(orderId, { body, channel: "web", actorRole: "customer", actorId: actor });
    setChatDraft("");
    notify(t.noticeMessageSent);
  }
  function reportDeposit() {
    reportDepositSent(quote.id, actor);
    notify(fc.reportedNote);
  }
  function reportBalance() {
    sendOrderMessage(orderId, { body: `${fc.balanceSentCta} — ${order.id}`, channel: "web", actorRole: "customer", actorId: actor });
    notify(fc.balanceReportedNote);
  }
  function rejectFinal(payload) {
    rejectFinalConfirmation(orderId, payload, actor);
    notify(t.noticeRejectionSent);
  }
  function confirmFinishedPiece() {
    confirmFinal(orderId, actor);
    notify(t.noticeFinalConfirmed);
  }

  // 제작 체크포인트 상태 — 디자인 승인은 제품 초안(확정 제안) 수락에 포함되어 별도 스테이지 없음
  const finalState = finalAction ? "active"
    : ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status) ? "done" : "upcoming";

  // 디파짓 카드 상태: 컨펌 전 잠금 → 송금 안내 → 확인 중 → 완료
  const depositCardState = depositDone ? "done"
    : quote?.status === "accepted" ? (depositReported ? "reported" : "active")
      : "locked";
  const depositTurn = depositCardState === "active"; // 액션은 없지만 고객 차례

  // 고객용 "다음 단계" 한 줄 — 어드민의 next-step 카드를 고객에게도 (문의 감소)
  const nextMsg = proposalPreparing ? fc.preparingBody
    : quote.status === "sent" ? fc.nextConfirm
    : depositCardState === "active" ? t.nextDeposit
    : depositCardState === "reported" ? fc.confirmingDeposit
    : order.status === "BALANCE" ? fc.nextBalance
      : t.nextStep?.[order.status] || "";
  const activeActionText = proposalPreparing ? fc.preparingBody
    : activeAction
    ? (t.todo?.[activeAction.type] || activeAction.prompt || nextMsg || t.reviewUpdates)
    : (nextMsg || t.reviewUpdates);
  const heroReady = Boolean(activeAction) || depositTurn || order.status === "BALANCE";
  const finalMedia = mediaList(finalAction?.media, finalAction?.link);
  // 고를 후보도 견적도 없으면 배지도 '준비 중' — "Choosing diamond"는 아직 고를 게 없는 고객을 헷갈리게 한다
  const statusLabel = proposalPreparing && !activeAction
    ? workspaceCopy.stonePreparingBadge
    : t.statusLabel?.[order.status] || p.orderStatus[order.status] || order.status;
  const dueValue = activeAction?.dueDate || order.requiredDate || null;
  const activeAnchor = proposalPreparing ? "#conversation"
    : activeAction?.type === "quoteAcceptance" ? "#proposal-stage"
    : depositTurn || depositCardState === "reported" ? "#pay-stage"
    : activeAction?.type === "finalConfirmation" ? "#final-stage"
      : order.status === "BALANCE" ? "#balance-stage"
      : "#conversation";
  const briefRows = buildOrderBriefRows({ order, intake, style, selected, quote, p, locale, copy: workspaceCopy });

  // 스테이지 상태 매핑 — 한 페이지 = 한 타임라인, 지금 할 일만 펼친다
  const proposalStageState = quote?.status === "accepted" ? "done"
    : quote?.status === "sent" ? "active"
      : "waiting"; // 준비 중 — BeloveD 차례
  const depositStageState = depositCardState === "done" ? "done"
    : depositCardState === "reported" ? "waiting"
      : depositCardState === "active" ? "active"
        : "upcoming";
  const balanceDoneStates = ["SHIPPING", "DELIVERED", "ARCHIVED"];
  const balanceStageState = balanceDoneStates.includes(order.status) ? "done"
    : order.status === "BALANCE" ? "active"
      : "upcoming";

  // 리뷰: 배송 완료 주문만
  const rc = REVIEW_COPY[locale] || REVIEW_COPY.en;
  const reviewEligible = ["DELIVERED", "ARCHIVED"].includes(order.status);
  const myReview = reviewEligible ? listReviews({ orderId }).find((r) => r.status !== "hidden") : null;

  return (
    <div className="page client-portal-page">
      {/* 슬림 액션바 — 지금 할 일 한 줄 + 주문 메타 (큰 히어로/사이드 브리프 제거) */}
      <section className="client-actionbar">
        <div className="client-actionbar-copy">
          <p className="section-label">{heroReady ? workspaceCopy.nextKicker : workspaceCopy.statusKicker}</p>
          <strong>{activeActionText}</strong>
        </div>
        <div className="client-actionbar-meta">
          <span>{order.id}</span>
          <span className={`status-badge ost-${order.status}`}>{statusLabel}</span>
          {/* 희망일 미설정이면 내부 필드 같은 "Due: Not set"을 노출하지 않는다 */}
          {dueValue && <span>{workspaceCopy.due}: {dueValue}</span>}
          <a className="button primary small" href={proposalPreparing ? "#conversation" : activeAnchor}>
            {proposalPreparing ? workspaceCopy.chat : workspaceCopy.goToAction}
          </a>
        </div>
      </section>

      {notice && (
        <p className="client-action-notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      {/* 스테이지 01 — 확정 제안 */}
      <Checkpoint id="proposal-stage" index={1} title={fc.proposalKicker} state={proposalStageState}
        badgeOverride={proposalPreparing ? fc.journeyProposalSubPrep : undefined}
        summary={quote?.status === "accepted" ? `${usd(quote.totalUsd)} · ${fc.confirmedBadge}` : null}>
        {proposalPreparing ? (
          <div className="client-empty-stage">
            <h4>{fc.preparingTitle}</h4>
            <p>{fc.preparingBody}</p>
            <a className="button secondary small" href="#conversation">{workspaceCopy.chat}</a>
          </div>
        ) : (
          <ProposalCard
            quote={quote}
            intake={intake}
            style={style}
            fc={fc}
            t={t}
            p={p}
            locale={locale}
            shippingProps={{
              value: shippingAddressDraft,
              onChange: setShippingAddress,
              t,
              locked: quote.status === "accepted" && shippingAddressSaved,
              canSave: quote.status === "accepted" && !shippingAddressSaved,
              onSave: saveShippingAddress,
            }}
            onConfirm={accept}
            confirmDisabled={!shippingAddressComplete}
          />
        )}
      </Checkpoint>

      {/* 스테이지 02 — 디파짓 */}
      <Checkpoint id="pay-stage" index={2} title={fc.payTitle} state={depositStageState}
        badgeOverride={depositStageState === "waiting" ? fc.reportedBadge : undefined}
        summary={depositStageState === "done" && quote ? `${usd(quote.depositUsd)} · ${fc.doneBadge}` : null}>
        {quote && (
          <PaymentCard
            amountUsd={quote.depositUsd}
            amountLabel={fc.depositToday}
            amountContext={`${fc.totalLabel} ${usd(quote.totalUsd)} · ${fc.balanceShip} ${usd(quote.balanceUsd)}`}
            memoText={`BeloveD ${order.id} Deposit`}
            reported={depositCardState === "reported"}
            fc={fc}
            sentCta={fc.depositSentCta}
            reportedNote={fc.reportedNote}
            onReport={reportDeposit}
          />
        )}
      </Checkpoint>

      {/* 디자인 승인 스테이지 없음 — 제품 초안(확정 제안) 수락이 디자인 승인을 겸한다.
          고객 여정: 폼 → 제품 초안 → 디파짓 → 완성품 컨펌 → 잔금 → 배송 */}

      {/* 스테이지 03 — 완성품 컨펌 */}
      <Checkpoint id="final-stage" index={3} title={p.visual.checkpoint.final} state={finalState}
        summary={finalState === "done" ? p.visual.finalConfirmed : null}>
        {finalAction && (
          <div className="form-stack">
            <h3 style={{ margin: 0 }}>{p.visual.finalTitle}</h3>
            {finalMedia.length > 0 && <ClientMediaCarousel media={finalMedia} ratio="16 / 9" alt={p.visual.finalTitle} fit="contain" />}
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

      {/* 스테이지 04 — 잔금 & 배송 */}
      <Checkpoint id="balance-stage" index={4} title={fc.balanceTitle} state={balanceStageState}
        summary={balanceStageState === "done" ? statusLabel : null}>
        {order.status === "BALANCE" && quote && (
          <PaymentCard
            amountUsd={quote.balanceUsd}
            amountLabel={fc.balanceShip}
            amountContext={`${fc.totalLabel} ${usd(quote.totalUsd)}`}
            memoText={`BeloveD ${order.id} Balance`}
            reported={false}
            fc={fc}
            sentCta={fc.balanceSentCta}
            reportedNote={fc.balanceReportedNote}
            onReport={reportBalance}
          />
        )}
      </Checkpoint>

      {/* 리뷰 — 배송 완료 후 인증샷과 함께 */}
      {reviewEligible && (
        <Checkpoint id="review-stage" index={5} title={rc.title} state={myReview ? "done" : "active"}
          summary={myReview ? (myReview.status === "published" ? rc.published : rc.done) : null}>
          {!myReview && <ReviewForm orderId={orderId} rc={rc} onDone={() => notify(rc.done)} />}
        </Checkpoint>
      )}

      {/* 주문 요약 — 필요할 때만 펼쳐 보는 아코디언 */}
      <details className="client-brief-details">
        <summary>{workspaceCopy.orderBrief} · {order.id}</summary>
        <dl className="client-brief-list">
          {briefRows.map((row) => (
            <div key={`${row.label}-${row.value}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        {/* 요청 퀄리티 range — 위저드와 동일한 range 비주얼 (읽기전용) */}
        {(intake?.stonePrefs || intake?.multiSpec) && (
          <div style={{ marginTop: 16 }}>
            <RequestedSpecCard spec={{ stonePrefs: intake?.stonePrefs, multiSpec: intake?.multiSpec }} p={p} />
          </div>
        )}
      </details>

      <div id="conversation">
        <ConversationPanel messages={messages} draft={chatDraft} setDraft={setChatDraft} onSend={sendChat} t={t} />
      </div>

    </div>
  );
}
