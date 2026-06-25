import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BENCHMARK_SHAPES, MILESTONE_STAGES, ORDER_STATUSES, PR_TYPES } from "../../lib/ops.js";
import {
  addCadVersion,
  createProcurement, createQuote, getCandidate, getIntake, getOpsOrder, getOpsStyle, listAudit,
  listCandidates, listCadReviews, listCustomerActions, listMilestones, listOrderMessages, listProcurements, listQuotes,
  lockCandidate, markBalanceReceived, markDepositReceived, markOrderDelivered, publishCandidate,
  publishFinalMedia, recordActualWeight, reviewCandidate, sendQuote,
  setCandidateAvailability, unpublishCandidate, updateOpsOrder, upsertMilestone, getSettings,
  getDB, reviewReferenceMedia, createProxyDiamondCandidate, ORDER_MESSAGE_CHANNELS, sendOrderMessage,
} from "../../lib/store.js";
import { formatAnnotation } from "../../lib/chips.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

// 조달요청 결과를 raw JSON 대신 사람이 읽을 요약으로 (어드민 가독성)
function prResultSummary(pr) {
  const r = pr.result;
  if (!r) return "";
  if (pr.type === "stockConfirm") return r.available ? "in stock" : "sold out";
  if (pr.type === "ship") return [r.trackingNo, r.shippedAt].filter(Boolean).join(" · ");
  if (pr.type === "qc") return [r.actualWeightG && `${r.actualWeightG}g`, r.video && "video", r.cert && "cert"].filter(Boolean).join(" · ");
  if (pr.type === "weightLabor") return [r.estWeightG && `${r.estWeightG}g`, r.laborUsd && `labor $${r.laborUsd}`, r.leadDays && `${r.leadDays}d`].filter(Boolean).join(" · ");
  return "submitted";
}

function PrForm({ orderId, suppliers, t }) {
  const [f, setF] = useState({ type: "diamondCandidates", supplierId: suppliers[0]?.id || "", dueDate: "", batchValidUntil: "", brief: "" });
  return (
    <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createProcurement(orderId, f); }}>
      <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <label className="field"><span>{t.prType}</span>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {PR_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
          </select></label>
        <label className="field"><span>{t.supplier}</span>
          <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
            {suppliers.map((su) => <option key={su.id} value={su.id}>{su.name}</option>)}
          </select></label>
        <label className="field"><span>{t.due}</span><input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} required /></label>
        <label className="field"><span>{t.batchUntil}</span><input type="date" value={f.batchValidUntil} onChange={(e) => setF({ ...f, batchValidUntil: e.target.value })} /></label>
      </div>
      <label className="field"><span>{t.brief}</span><input value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} /></label>
      <button className="button secondary small" type="submit">{t.newPr}</button>
    </form>
  );
}

function QuoteBuilder({ order, settings, t }) {
  const dia = order.selectedDiamondId ? getCandidate(order.selectedDiamondId) : null;
  const intakeMetal = getIntake(order.intakeId)?.metal || "18kw";
  const [f, setF] = useState({
    estWeightG: order.styleId ? getOpsStyle(order.styleId)?.estWeightG || "" : "",
    metalRefUsdPerG: settings.metalRefUsdPerG[intakeMetal] || 85,
    lossRatePct: settings.defaultLossRatePct, nonMetalUsd: "",
    diamondCostUsd: dia?.procurementCostUsd || 0, laborUsd: "", extrasUsd: "", riskUsd: "", multiplier: settings.opsMultiplier,
  });
  return (
    <form className="form-stack" onSubmit={(e) => {
      e.preventDefault();
      createQuote(order.id, {
        estWeightG: Number(f.estWeightG), metalRefUsdPerG: Number(f.metalRefUsdPerG), lossRatePct: Number(f.lossRatePct),
        nonMetalUsd: Number(f.nonMetalUsd),
        internal: { diamondCostUsd: Number(f.diamondCostUsd), laborUsd: Number(f.laborUsd) || 0, extrasUsd: Number(f.extrasUsd) || 0, riskUsd: Number(f.riskUsd) || 0, multiplier: Number(f.multiplier) },
      });
    }}>
      <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <label className="field"><span>{t.estWeight}</span><input type="number" step="0.1" value={f.estWeightG} onChange={(e) => setF({ ...f, estWeightG: e.target.value })} required /></label>
        <label className="field"><span>{t.metalRef}</span><input type="number" step="0.5" value={f.metalRefUsdPerG} onChange={(e) => setF({ ...f, metalRefUsdPerG: e.target.value })} /></label>
        <label className="field"><span>{t.lossRate}</span><input type="number" step="0.5" value={f.lossRatePct} onChange={(e) => setF({ ...f, lossRatePct: e.target.value })} /></label>
        <label className="field"><span>{t.nonMetal}</span><input type="number" value={f.nonMetalUsd} onChange={(e) => setF({ ...f, nonMetalUsd: e.target.value })} required /></label>
      </div>
      <p className="form-hint">{t.internalCost}</p>
      <div className="filter-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {["diamondCostUsd", "laborUsd", "extrasUsd", "riskUsd", "multiplier"].map((k) => (
          <label className="field" key={k}><span>{k}</span>
            <input type="number" step="0.1" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
      </div>
      <button className="button secondary small" type="submit">{t.createQuote}</button>
    </form>
  );
}

const DIAMOND_COLORS = ["D", "E", "F", "G", "H", "I", "J"];
const DIAMOND_CLARITIES = ["VVS1", "VVS2", "VS1", "VS2", "SI1"];
const GROWTH_METHODS = ["CVD", "HPHT"];
const LABS = ["IGI", "GIA", "GCAL"];

const FALLBACK_PROXY_COPY = {
  title: "Operator proxy uploads",
  sub: "Upload vendor-sourced stones, design media, or finished-piece QC directly to this order.",
  diamondTitle: "Diamond candidates",
  designTitle: "Design approval media",
  finalTitle: "Finished-piece confirmation",
  diamondHelp: "Published candidates appear in the customer workspace for confirmation.",
  designHelp: "Send CAD renders, photos, or videos for customer design approval.",
  finalHelp: "Send final QC photos or videos for customer confirmation.",
  note: "Customer note",
  notePh: "Short note shown to the customer",
  media: "Photos or videos (max 5)",
  igi: "IGI / report no.",
  price: "Customer price ($)",
  cost: "Internal cost ($)",
  cert: "Certificate / report note",
  actualWeight: "Actual weight (g)",
  publishDiamond: "Publish diamond candidate",
  issueDesign: "Send design for approval",
  issueFinal: "Send finished piece for confirmation",
  saved: "Uploaded to order workspace",
};

const PROXY_STAGE_COPY = {
  en: {
    open: "Waiting for customer",
    ready: "Ready to send",
    done: "Confirmed",
    notSent: "Not sent",
    sent: "sent",
    activeEdit: "Active upload",
    openActions: "open customer action",
    openActionsPlural: "open customer actions",
    noMedia: "No media yet",
    diamondMeta: "Customer selects one stone before quote/CAD.",
    designMeta: "Customer approves or requests a revision.",
    finalMeta: "Customer confirms the finished piece before balance.",
  },
  ko: {
    open: "고객 확인 대기",
    ready: "전송 준비",
    done: "컨펌 완료",
    notSent: "아직 미전송",
    sent: "개 공개",
    activeEdit: "현재 업로드",
    openActions: "고객 액션",
    openActionsPlural: "고객 액션",
    noMedia: "아직 미디어 없음",
    diamondMeta: "견적/CAD 전에 고객이 스톤 하나를 선택합니다.",
    designMeta: "고객이 디자인을 승인하거나 수정 요청합니다.",
    finalMeta: "잔금 전에 고객이 완성품 실물을 컨펌합니다.",
  },
  zh: {
    open: "等待客户确认",
    ready: "准备发送",
    done: "已确认",
    notSent: "尚未发送",
    sent: "个已发布",
    activeEdit: "当前上传",
    openActions: "个客户任务",
    openActionsPlural: "个客户任务",
    noMedia: "暂无媒体",
    diamondMeta: "报价/CAD 前客户选择一颗石头。",
    designMeta: "客户确认设计或提出修改。",
    finalMeta: "尾款前客户确认成品实物。",
  },
  es: {
    open: "Esperando cliente",
    ready: "Listo para enviar",
    done: "Confirmado",
    notSent: "No enviado",
    sent: "publicados",
    activeEdit: "Carga activa",
    openActions: "acción cliente",
    openActionsPlural: "acciones cliente",
    noMedia: "Sin medios todavía",
    diamondMeta: "El cliente elige una piedra antes de cotización/CAD.",
    designMeta: "El cliente aprueba o pide una revisión.",
    finalMeta: "El cliente confirma la pieza final antes del saldo.",
  },
};

function proxyStageCopy(locale) {
  return PROXY_STAGE_COPY[locale] || PROXY_STAGE_COPY.en;
}

function adminMediaList(media, fallbackSrc = "") {
  if (Array.isArray(media) && media.length) return media.filter((m) => m?.src);
  if (!fallbackSrc) return [];
  const clean = String(fallbackSrc).split("?")[0].toLowerCase();
  const kind = /\.(mp4|webm|mov|m4v)$/.test(clean) ? "video" : "image";
  return [{ id: fallbackSrc, kind, src: fallbackSrc }];
}

function latestCustomerAction(actions, type) {
  return [...actions].reverse().find((action) => action.type === type) || null;
}

function ProxyMediaStrip({ media, emptyText }) {
  const items = media.slice(0, 3);
  if (!items.length) return <div className="ops-proxy-media-empty">{emptyText}</div>;
  return (
    <div className="ops-proxy-media-strip">
      {items.map((item, index) => (
        <MediaThumb key={`${item.src}-${index}`} media={item} alt="" ratio="1 / 1" />
      ))}
    </div>
  );
}

function ProxyStageCard({ active, done, title, status, meta, media, emptyText, onClick }) {
  return (
    <button
      className={`ops-proxy-stage-card ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}
      type="button"
      onClick={onClick}
    >
      <div className="ops-proxy-stage-top">
        <span>{title}</span>
        <strong>{status}</strong>
      </div>
      <ProxyMediaStrip media={media} emptyText={emptyText} />
      <p>{meta}</p>
    </button>
  );
}

function OperatorProxyPanel({ order, t, p, locale }) {
  const copy = t.proxy || FALLBACK_PROXY_COPY;
  const stageCopy = proxyStageCopy(locale);
  const [activeStep, setActiveStep] = useState("diamond");
  const candidates = listCandidates({ orderId: order.id });
  const cads = listCadReviews(order.id);
  const actions = listCustomerActions(order.id);
  const publishedCandidates = candidates.filter((candidate) => candidate.published);
  const selectedCandidate = order.selectedDiamondId ? candidates.find((candidate) => candidate.id === order.selectedDiamondId) : null;
  const latestCad = cads[0] || null;
  const finalAction = latestCustomerAction(actions, "finalConfirmation");
  const finalDone = finalAction?.status === "done" || ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status);
  const openCount = actions.filter((action) => action.status === "open").length;
  const steps = [
    {
      key: "diamond",
      title: copy.diamondTitle,
      status: selectedCandidate ? stageCopy.done : publishedCandidates.length ? `${publishedCandidates.length} ${stageCopy.sent}` : stageCopy.notSent,
      done: Boolean(selectedCandidate),
      meta: stageCopy.diamondMeta,
      media: publishedCandidates.flatMap((candidate) => adminMediaList(candidate.media, candidate.image || candidate.video)).slice(0, 3),
    },
    {
      key: "design",
      title: copy.designTitle,
      status: latestCad?.decision ? stageCopy.done : latestCad ? stageCopy.open : stageCopy.notSent,
      done: Boolean(latestCad?.decision),
      meta: stageCopy.designMeta,
      media: adminMediaList(latestCad?.media, latestCad?.fileUrl),
    },
    {
      key: "final",
      title: copy.finalTitle,
      status: finalDone ? stageCopy.done : finalAction ? stageCopy.open : stageCopy.notSent,
      done: finalDone,
      meta: stageCopy.finalMeta,
      media: adminMediaList(finalAction?.media, finalAction?.link),
    },
  ];
  const active = steps.find((step) => step.key === activeStep) || steps[0];

  return (
    <section className="panel ops-proxy-workbench">
      <div className="ops-proxy-head">
        <div>
          <p className="form-hint" style={{ margin: 0, letterSpacing: 1 }}>{copy.title}</p>
          <h3 style={{ marginTop: 8 }}>{copy.sub}</h3>
        </div>
        <span className="ops-proxy-action-count">
          {openCount} {openCount === 1 ? stageCopy.openActions : stageCopy.openActionsPlural}
        </span>
      </div>
      <div className="ops-proxy-stage-grid">
        {steps.map((step) => (
          <ProxyStageCard
            key={step.key}
            active={activeStep === step.key}
            done={step.done}
            title={step.title}
            status={step.status}
            meta={step.meta}
            media={step.media}
            emptyText={stageCopy.noMedia}
            onClick={() => setActiveStep(step.key)}
          />
        ))}
      </div>
      <div className="ops-proxy-editor">
        <div className="ops-proxy-editor-head">
          <span>{stageCopy.activeEdit}</span>
          <strong>{active.title}</strong>
        </div>
        {activeStep === "diamond" && <ProxyDiamondForm orderId={order.id} copy={copy} p={p} />}
        {activeStep === "design" && <ProxyDesignForm orderId={order.id} copy={copy} />}
        {activeStep === "final" && <ProxyFinalForm orderId={order.id} copy={copy} />}
      </div>
    </section>
  );
}

function AdminConversationPanel({ orderId, messages, copy }) {
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState("web");
  const [actorRole, setActorRole] = useState("ops");
  const channelLabel = (key) => copy.channels?.[key] || key;

  function submit(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    sendOrderMessage(orderId, {
      body,
      channel,
      actorRole,
      actorId: actorRole === "ops" ? "ops" : `external:${channel}`,
      sourceLabel: channelLabel(channel),
    });
    setDraft("");
  }

  return (
    <section className="panel conversation-panel admin-conversation-panel">
      <div className="conversation-head">
        <div>
          <p className="form-hint" style={{ margin: 0, letterSpacing: 1 }}>{copy.title}</p>
          <h3 style={{ margin: "8px 0 0" }}>{copy.sub}</h3>
        </div>
      </div>
      <div className="conversation-thread">
        {messages.length === 0 ? (
          <p className="form-hint">{copy.empty}</p>
        ) : messages.map((message) => (
          <article className={`conversation-message ${message.actorRole === "ops" ? "is-ops" : "is-customer"}`} key={message.id}>
            <div className="conversation-meta">
              <span>{message.actorRole === "ops" ? copy.roleOps : message.actorRole === "system" ? copy.roleSystem : copy.roleCustomer}</span>
              <span>{channelLabel(message.channel)}</span>
              <span>{message.createdAt?.slice(5, 16)}</span>
            </div>
            {message.body && <p className="conversation-body">{message.body}</p>}
          </article>
        ))}
      </div>
      <form className="conversation-form admin-conversation-form" onSubmit={submit}>
        <div className="admin-conversation-controls">
          <label className="field"><span>{copy.channel}</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {ORDER_MESSAGE_CHANNELS.map((key) => <option key={key} value={key}>{channelLabel(key)}</option>)}
            </select>
          </label>
          <label className="field"><span>{copy.role}</span>
            <select value={actorRole} onChange={(e) => setActorRole(e.target.value)}>
              <option value="ops">{copy.roleOps}</option>
              <option value="customer">{copy.roleCustomer}</option>
            </select>
          </label>
        </div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={copy.placeholder} rows={2} />
        <button className="button primary small" type="submit" disabled={!draft.trim()}>{copy.send}</button>
      </form>
    </section>
  );
}

function ProxyDiamondForm({ orderId, copy, p }) {
  const [media, setMedia] = useState([]);
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    shape: "round",
    carat: "1",
    color: "E",
    clarity: "VS1",
    growth: "CVD",
    lab: "IGI",
    igiNo: "",
    customerPriceUsd: "390",
    procurementCostUsd: "",
    clientNote: "",
  });
  function set(key, value) {
    setSaved(false);
    setF((current) => ({ ...current, [key]: value }));
  }
  function submit(e) {
    e.preventDefault();
    createProxyDiamondCandidate(orderId, { ...f, media }, "ops");
    setSaved(true);
    setMedia([]);
    setF((current) => ({ ...current, igiNo: "", clientNote: "" }));
  }
  return (
    <form className="form-stack ops-proxy-form-card proxy-form" onSubmit={submit}>
      <div className="ops-proxy-form-head">
        <div>
          <h3>{copy.diamondTitle}</h3>
          <p className="form-hint">{copy.diamondHelp}</p>
        </div>
      </div>
      <div className="ops-proxy-form-body">
        <div className="filter-grid proxy-field-grid">
          <label className="field"><span>{p.stoneEdu.shape.title}</span>
            <select value={f.shape} onChange={(e) => set("shape", e.target.value)}>
              {BENCHMARK_SHAPES.map((shape) => <option key={shape} value={shape}>{p.shapes?.[shape] || shape}</option>)}
            </select>
          </label>
          <label className="field"><span>{p.stoneEdu.carat.title}</span>
            <input type="number" min="0.1" step="0.01" value={f.carat} onChange={(e) => set("carat", e.target.value)} required />
          </label>
          <label className="field"><span>{p.stoneEdu.color.title}</span>
            <select value={f.color} onChange={(e) => set("color", e.target.value)}>
              {DIAMOND_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
            </select>
          </label>
          <label className="field"><span>{p.stoneEdu.clarity.title}</span>
            <select value={f.clarity} onChange={(e) => set("clarity", e.target.value)}>
              {DIAMOND_CLARITIES.map((clarity) => <option key={clarity} value={clarity}>{clarity}</option>)}
            </select>
          </label>
          <label className="field"><span>{p.stoneEdu.growth.title}</span>
            <select value={f.growth} onChange={(e) => set("growth", e.target.value)}>
              {GROWTH_METHODS.map((growth) => <option key={growth} value={growth}>{growth}</option>)}
            </select>
          </label>
          <label className="field"><span>{p.stoneEdu.lab.title}</span>
            <select value={f.lab} onChange={(e) => set("lab", e.target.value)}>
              {LABS.map((lab) => <option key={lab} value={lab}>{lab}</option>)}
            </select>
          </label>
          <label className="field"><span>{copy.igi}</span>
            <input value={f.igiNo} onChange={(e) => set("igiNo", e.target.value)} />
          </label>
          <label className="field"><span>{copy.price}</span>
            <input type="number" min="0" value={f.customerPriceUsd} onChange={(e) => set("customerPriceUsd", e.target.value)} required />
          </label>
          <label className="field"><span>{copy.cost}</span>
            <input type="number" min="0" value={f.procurementCostUsd} onChange={(e) => set("procurementCostUsd", e.target.value)} />
          </label>
        </div>
        <label className="field"><span>{copy.note}</span>
          <textarea value={f.clientNote} onChange={(e) => set("clientNote", e.target.value)} placeholder={copy.notePh} />
        </label>
        <label className="field"><span>{copy.media}</span>
          <MediaPicker value={media} onChange={(items) => { setSaved(false); setMedia(items); }} maxItems={5} showSamples={false} previewMode="list" />
        </label>
      </div>
      <div className="ops-proxy-form-actions">
        <button className="button primary small" disabled={media.length === 0} type="submit">{copy.publishDiamond}</button>
        {saved && <p className="form-hint">{copy.saved}</p>}
      </div>
    </form>
  );
}

function ProxyDesignForm({ orderId, copy }) {
  const [media, setMedia] = useState([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  function submit(e) {
    e.preventDefault();
    addCadVersion(orderId, { media, note, supplierId: "ops-proxy" });
    setMedia([]);
    setNote("");
    setSaved(true);
  }
  return (
    <form className="form-stack ops-proxy-form-card proxy-form" onSubmit={submit}>
      <div className="ops-proxy-form-head">
        <div>
          <h3>{copy.designTitle}</h3>
          <p className="form-hint">{copy.designHelp}</p>
        </div>
      </div>
      <div className="ops-proxy-form-body">
        <label className="field"><span>{copy.media}</span>
          <MediaPicker value={media} onChange={(items) => { setSaved(false); setMedia(items); }} maxItems={5} showSamples={false} previewMode="list" />
        </label>
        <label className="field"><span>{copy.note}</span>
          <textarea value={note} onChange={(e) => { setSaved(false); setNote(e.target.value); }} placeholder={copy.notePh} />
        </label>
      </div>
      <div className="ops-proxy-form-actions">
        <button className="button primary small" disabled={media.length === 0} type="submit">{copy.issueDesign}</button>
        {saved && <p className="form-hint">{copy.saved}</p>}
      </div>
    </form>
  );
}

function ProxyFinalForm({ orderId, copy }) {
  const [media, setMedia] = useState([]);
  const [f, setF] = useState({ note: "", cert: "", actualWeightG: "" });
  const [saved, setSaved] = useState(false);
  function set(key, value) {
    setSaved(false);
    setF((current) => ({ ...current, [key]: value }));
  }
  function submit(e) {
    e.preventDefault();
    publishFinalMedia(orderId, { ...f, media }, "ops");
    setMedia([]);
    setF({ note: "", cert: "", actualWeightG: "" });
    setSaved(true);
  }
  return (
    <form className="form-stack ops-proxy-form-card proxy-form" onSubmit={submit}>
      <div className="ops-proxy-form-head">
        <div>
          <h3>{copy.finalTitle}</h3>
          <p className="form-hint">{copy.finalHelp}</p>
        </div>
      </div>
      <div className="ops-proxy-form-body">
        <label className="field"><span>{copy.media}</span>
          <MediaPicker value={media} onChange={(items) => { setSaved(false); setMedia(items); }} maxItems={5} showSamples={false} previewMode="list" />
        </label>
        <label className="field"><span>{copy.note}</span>
          <textarea value={f.note} onChange={(e) => set("note", e.target.value)} placeholder={copy.notePh} />
        </label>
        <div className="filter-grid proxy-field-grid">
          <label className="field"><span>{copy.cert}</span>
            <input value={f.cert} onChange={(e) => set("cert", e.target.value)} />
          </label>
          <label className="field"><span>{copy.actualWeight}</span>
            <input type="number" min="0" step="0.01" value={f.actualWeightG} onChange={(e) => set("actualWeightG", e.target.value)} />
          </label>
        </div>
      </div>
      <div className="ops-proxy-form-actions">
        <button className="button primary small" disabled={media.length === 0} type="submit">{copy.issueFinal}</button>
        {saved && <p className="form-hint">{copy.saved}</p>}
      </div>
    </form>
  );
}

export default function AdminOpsOrder() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.opsA.orders;
  const { orderId } = useParams();
  const order = getOpsOrder(orderId);
  const settings = getSettings();
  const [actualW, setActualW] = useState("");

  if (!order) return <div className="page"><EmptyNote>—</EmptyNote></div>;

  const intake = getIntake(order.intakeId);
  const style = order.styleId ? getOpsStyle(order.styleId) : null;
  const candidates = listCandidates({ orderId });
  const quotes = listQuotes(orderId);
  const milestones = listMilestones(orderId);
  const cads = listCadReviews(orderId);
  const actions = listCustomerActions(orderId);
  const messages = listOrderMessages(orderId);
  const auditRows = listAudit(orderId).slice(-8).reverse();
  const suppliers = getDB().users.filter((u) => u.role === "supplier");
  const acceptedQuote = quotes.find((q) => q.status === "accepted");

  // 어드민 터치포인트는 단 3개 — 지금 필요한 하나만 카드로 띄운다 (나머지는 자동 진행)
  const balanceDone = milestones.some((m) => m.stage === "balanceReceived" && m.status === "done");
  const nextAction = (order.status === "QUOTATION" && acceptedQuote) ? { fn: () => markDepositReceived(order.id), label: t.markDeposit }
    : (order.status === "BALANCE" && !balanceDone) ? { fn: () => markBalanceReceived(order.id), label: t.markBalance }
      : order.status === "SHIPPING" ? { fn: () => markOrderDelivered(order.id), label: t.markDelivered }
        : null;

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <h1 className="page-title" style={{ fontSize: 34 }}>{order.id} <span className={`status-badge ost-${order.status}`}>{p.orderStatus[order.status]}</span></h1>
      <p className="page-sub">
        {order.customerName} · {style && <>{style.id} {pickI18n(style.name, locale)} · </>}
        {t.queryCode}: {order.queryCode} · <Link className="text-link" to={`/track/${order.id}?code=${order.queryCode}`}>{p.portal.title} ↗</Link>
      </p>

      {/* 지금 할 일 — 운영자 개입은 디파짓·잔금·수령 3개뿐. 해당 단계에서만 버튼 노출 */}
      <div className="panel" style={nextAction ? { borderColor: "rgba(214,197,160,0.6)", background: "rgba(214,197,160,0.05)" } : undefined}>
        <p className="form-hint" style={{ margin: 0, letterSpacing: 1 }}>{t.naTitle}</p>
        {nextAction
          ? <button className="button primary" style={{ marginTop: 12 }} onClick={nextAction.fn}>{nextAction.label}</button>
          : <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{t.naNone}</p>}
      </div>

      {/* 상태/노트 */}
      <div className="panel form-stack">
        <div className="row-actions">
          <label className="field" style={{ minWidth: 220 }}><span>{t.statusSet}</span>
            <select value={order.status} onChange={(e) => updateOpsOrder(order.id, { status: e.target.value })}>
              {ORDER_STATUSES.map((st) => <option key={st} value={st}>{p.orderStatus[st]}</option>)}
            </select></label>
          <label className="field" style={{ flex: 1 }}><span>{t.internalNotes}</span>
            <input defaultValue={order.internalNotes} key={order.internalNotes} onBlur={(e) => updateOpsOrder(order.id, { internalNotes: e.target.value })} /></label>
        </div>
        {intake && (
          <p className="form-hint">
            {t.intake}: {p.productLines[intake.productLine]} · {p.opsCategories[intake.category]} · {p.opsMetals[intake.metal]}
            {intake.conditional && Object.entries(intake.conditional).map(([k, v]) => ` · ${k}: ${v}`)}
            {intake.stonePrefs && ` · ${intake.stonePrefs.shape} ${intake.stonePrefs.carat}ct ${intake.stonePrefs.color}/${intake.stonePrefs.clarity} ${intake.stonePrefs.growth}`}
            {intake.multiSpec && ` · melee: ${intake.multiSpec.meleeSpec} · ${intake.multiSpec.overallDims} · ${intake.multiSpec.standard}`}
            {intake.budget && ` · $${intake.budget}`} · {intake.contact}
          </p>
        )}
      </div>

      <AdminConversationPanel orderId={order.id} messages={messages} copy={t.chat} />

      {/* 레퍼런스 검수 — 승인분만 벤더 브리프로 나간다 */}
      {intake?.referenceMedia?.length > 0 && (
        <div className="panel form-stack">
          <h3>{p.visual.refReviewTitle}</h3>
          <div className="card-grid cols-3">
            {intake.referenceMedia.map((m) => (
              <div key={m.id} className="item-card">
                <MediaThumb media={m} alt={m.id} />
                <div className="card-body">
                  <p className="spec">{m.id} · {p.visual.refStatus[m.status]}</p>
                  {m.annotations?.map((a) => (
                    <p key={a.pinId} className="form-hint"><span className="pin-tag">{a.pinId}</span>{formatAnnotation(a, getDB().chipCatalog, locale, p.visual.parts)}</p>
                  ))}
                  {/* 즉시 전달 정책 — 어드민은 사후 숨김/복원만 */}
                  <div className="row-actions">
                    {m.status === "approved" ? (
                      <button className="button secondary small" onClick={() => reviewReferenceMedia(intake.id, m.id, "hidden")}>{t.hideRef}</button>
                    ) : (
                      <button className="button primary small" onClick={() => reviewReferenceMedia(intake.id, m.id, "approved")}>{t.showRef}</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 운영자 프록시 — 벤더에게 받은 자료를 order workspace에 직접 공개 */}
      <OperatorProxyPanel order={order} t={t} p={p} locale={locale} />

      {/* 견적 */}
      <div className="panel form-stack">
        <h3>{t.quoteTitle}</h3>
        {quotes.map((q) => (
          <div key={q.id} className="feedback-note">
            <strong>{q.id}</strong> · {q.status} · {usd(q.totalUsd)} ({p.portal.deposit} {usd(q.depositUsd)} / {p.portal.balance} {usd(q.balanceUsd)})
            {intake?.budget && q.totalUsd > intake.budget && <span style={{ color: "#e08585", marginLeft: 6 }}>⚠ {t.overBudget} (${intake.budget})</span>}
            {q.actualWeightG && ` · actual ${q.actualWeightG}g`}
            {q.status === "draft" && <button className="button secondary small" style={{ marginLeft: 10 }} onClick={() => sendQuote(q.id)}>{t.send}</button>}
          </div>
        ))}
        {/* 수동 견적 빌더·정산 — 자동 견적이 대부분 처리하므로 접어둔다 */}
        {(order.selectedDiamondId || intake?.productLine === "multi" || acceptedQuote) && (
          <details>
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12.5, padding: "2px 0" }}>{t.advanced}</summary>
            <div style={{ marginTop: 12 }}>
              {order.selectedDiamondId || intake?.productLine === "multi" ? <QuoteBuilder order={order} settings={settings} t={t} /> : null}
              {acceptedQuote && (
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <input type="number" step="0.01" placeholder={t.actualWeight} value={actualW} onChange={(e) => setActualW(e.target.value)}
                    style={{ width: 150, background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "9px 10px" }} />
                  <button className="button secondary small" disabled={!actualW} onClick={() => { recordActualWeight(order.id, Number(actualW)); setActualW(""); }}>{t.reconcile}</button>
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* 고급 — 마일스톤·CAD 이력·고객 액션·감사 로그 (평소엔 접어둔다) */}
      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", padding: "12px 2px", color: "var(--muted)", fontWeight: 600, letterSpacing: 1 }}>{t.advanced}</summary>

      {/* 조달 요청 */}
      <div className="panel form-stack" style={{ marginTop: 14 }}>
        <h3>{t.newPr}</h3>
        <PrForm orderId={order.id} suppliers={suppliers} t={t} />
        {listProcurements({ orderId }).map((pr) => (
          <p key={pr.id} className="form-hint">
            {pr.id} · {pr.type} · {suppliers.find((su) => su.id === pr.supplierId)?.name} · {pr.dueDate} · <span className={`status-badge prt-${pr.status}`}>{p.supplierP.status[pr.status]}</span>
            {pr.result && ` · ${prResultSummary(pr)}`}
          </p>
        ))}
      </div>

      {/* 다이아 후보 검수/공개 */}
      {candidates.length > 0 && (
        <div className="panel" style={{ overflowX: "auto" }}>
          <h3>{t.candidates} ({candidates.length})</h3>
          <table className="data-table">
            <thead><tr><th>ID</th><th>4C</th><th>{t.cost}</th><th>{t.review}</th><th>{t.custPrice}</th><th>{p.portal.availability.available}</th><th /></tr></thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} style={c.locked ? { background: "rgba(214,197,160,0.06)" } : undefined}>
                  <td style={{ whiteSpace: "nowrap" }}>{c.id}<br /><span className="form-hint">{c.igiNo}</span></td>
                  <td>{c.shape} {c.carat}ct {c.color}/{c.clarity} {c.growth}</td>
                  <td>{usd(c.procurementCostUsd)}</td>
                  <td>
                    <select value={c.internalReview || ""} onChange={(e) => reviewCandidate(c.id, e.target.value)}>
                      <option value="" disabled>—</option>
                      {["recommended", "alternate", "excluded"].map((r) => <option key={r} value={r}>{t.reviews[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    {c.published ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {usd(c.customerPriceUsd)}
                          {intake?.budget && c.customerPriceUsd > intake.budget && <span style={{ color: "#e08585", marginLeft: 6 }} title={`${t.budgetLabel} $${intake.budget}`}>⚠ {t.overBudget}</span>}
                        </span>
                        <button className="chip is-active" onClick={() => unpublishCandidate(c.id)}>{t.unpublish}</button>
                      </div>
                    ) : (
                      <input type="number" placeholder={t.pricePh} style={{ width: 132 }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); publishCandidate(c.id, Number(e.target.value)); } }} />
                    )}
                  </td>
                  <td>
                    <select value={c.availability} onChange={(e) => setCandidateAvailability(c.id, e.target.value)}>
                      {["available", "hold", "sold"].map((a) => <option key={a} value={a}>{p.portal.availability[a]}</option>)}
                    </select>
                  </td>
                  <td>
                    {c.locked ? <span className="status-badge cst-REPLACED">{t.locked}</span> :
                      c.clientSelection === "selected" && <button className="button primary small" onClick={() => lockCandidate(c.id)}>{t.lock}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 마일스톤 보드 */}
      <div className="panel" style={{ overflowX: "auto", marginTop: 14 }}>
        <h3>{t.msTitle}</h3>
        <table className="data-table">
          <tbody>
            {MILESTONE_STAGES.map((stage) => {
              const m = milestones.find((x) => x.stage === stage);
              return (
                <tr key={stage}>
                  <th>{p.msStages[stage]}</th>
                  <td>
                    <select value={m?.status || "pending"} onChange={(e) => upsertMilestone(order.id, stage, { status: e.target.value })}>
                      {["pending", "inProgress", "waitingClient", "blocked", "done"].map((st) => <option key={st} value={st}>{p.msStatus[st]}</option>)}
                    </select>
                  </td>
                  <td>
                    <input defaultValue={m?.clientUpdate || ""} key={`${stage}-${m?.clientUpdate}`} placeholder="Client update"
                      onBlur={(e) => upsertMilestone(order.id, stage, { clientUpdate: e.target.value })} />
                  </td>
                  <td>
                    <button className={`chip ${m?.publishToClient ? "is-active" : ""}`}
                      onClick={() => upsertMilestone(order.id, stage, { publishToClient: !m?.publishToClient })}>
                      {t.publishClient}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CAD 리뷰 이력 */}
      {cads.length > 0 && (
        <div className="panel">
          <h3>{t.cadTitle}</h3>
          {cads.map((c) => (
            <div key={c.id} className="feedback-note">
              V{c.version} · {c.decision ? p.portal.cadDecided[c.decision] : p.msStatus.waitingClient}
              {c.feedback.length > 0 && ` · ${c.feedback.join(" / ")}`}
              {c.annotations?.length > 0 && c.annotations.map((a) => (
                <span key={a.pinId}> · <span className="pin-tag">{a.pinId}</span>{formatAnnotation(a, getDB().chipCatalog, locale, p.visual.parts)}</span>
              ))}
              {c.feeAppliedUsd > 0 && <span> · fee {usd(c.feeAppliedUsd)}</span>}
              {c.confirmedMeasurements && ` · ${c.confirmedMeasurements}`}
            </div>
          ))}
        </div>
      )}

      {/* 고객 액션 + 감사 로그 */}
      <div className="panel">
        <h3>{t.actionsTitle}</h3>
        {actions.length === 0 ? <p className="form-hint">—</p> : actions.map((a) => (
          <p key={a.id} className="form-hint">{a.id} · {a.type} · {a.status}{a.response && ` → ${a.response}`}</p>
        ))}
      </div>
      <div className="panel">
        <h3>{t.auditTitle}</h3>
        {auditRows.map((a) => (
          <p key={a.id} className="form-hint">{a.at.slice(5, 16)} · {a.actor} · {a.field}: {String(a.before ?? "∅")} → {String(a.after ?? "∅")}</p>
        ))}
      </div>
      </details>
    </div>
  );
}
