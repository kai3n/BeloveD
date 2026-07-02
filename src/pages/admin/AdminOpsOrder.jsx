import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BENCHMARK_SHAPES, MILESTONE_STAGES, ORDER_STATUSES, PR_TYPES } from "../../lib/ops.js";
import {
  addCadVersion,
  createProcurement, createQuote, getIntake, getOpsOrder, getOpsStyle, listAudit,
  listCandidates, listCadReviews, listCustomerActions, listMilestones, listOrderMessages, listProcurements, listQuotes,
  lockCandidate, markBalanceReceived, markDepositReceived, markOrderDelivered, publishCandidate,
  publishFinalMedia, recordActualWeight, reviewCandidate, sendQuote, submitDiamondSelection,
  toggleShortlist, updateQuoteProposal,
  setCandidateAvailability, unpublishCandidate, updateOpsOrder, upsertMilestone, getSettings,
  getDB, reviewReferenceMedia, createProxyDiamondCandidate, ORDER_MESSAGE_CHANNELS, sendOrderMessage, isShippingAddressComplete, getQuoteDiamondCandidate, listReviews, setReviewStatus,
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

function PrForm({ orderId, suppliers, t, onSaved, notice }) {
  const [f, setF] = useState({ type: "diamondCandidates", supplierId: suppliers[0]?.id || "", dueDate: "", batchValidUntil: "", brief: "" });
  return (
    <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createProcurement(orderId, f); onSaved?.(notice.procurementCreated); }}>
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

function QuoteBuilder({ order, settings, t, onSaved, notice }) {
  const dia = getQuoteDiamondCandidate(order.id);
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
      onSaved?.(notice.quoteCreated);
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

// 확정 제안 컴포저 카피 — 고객에게 보이는 제안 카드의 미디어/스펙/대체 안내를 어드민이 구성
const PROPOSAL_COMPOSER_COPY = {
  en: {
    title: "Final proposal (customer-facing)",
    help: "The customer sees these media, the stone spec, and the total only — the cost breakdown below stays admin-only.",
    media: "Proposal media (max 5 — diamond, setting, finished look)",
    spec: "Stone spec shown to the customer",
    igiNo: "IGI No.",
    subNote: "Substitution note (leave blank for the default policy text)",
    save: "Save proposal",
    reportedShort: "customer reported sent",
    autoSave: "Changes save automatically.",
    reportedAt: (when) => `Customer reported the deposit sent · ${when}`,
    useForProposal: "Use for proposal",
    proposalStone: "Proposal stone",
    stageProposal: "Send the final proposal",
    stageProduction: "Production — CAD & final piece",
    stagePayment: "Payment & shipping",
    groupInfo: "Order info & quote history",
    groupInternal: "Internal ops (milestones · vendors · audit)",
  },
  ko: {
    title: "확정 제안 (고객 노출)",
    help: "고객에게는 이 미디어·스톤 스펙·총액만 보입니다 — 아래 원가 breakdown은 어드민 전용입니다.",
    media: "제안 미디어 (최대 5 — 다이아·세팅·완성 예시)",
    spec: "고객에게 보여줄 스톤 스펙",
    igiNo: "IGI 번호",
    subNote: "대체 안내문 (비우면 기본 정책 문구 사용)",
    save: "제안 저장",
    reportedShort: "고객 송금 보고됨",
    autoSave: "변경하면 즉시 자동 저장됩니다.",
    reportedAt: (when) => `고객이 디파짓 송금을 보고했습니다 · ${when}`,
    useForProposal: "제안 스톤으로 지정",
    proposalStone: "제안 스톤",
    stageProposal: "확정 제안 보내기",
    stageProduction: "제작 진행 — CAD·완성품",
    stagePayment: "결제·배송",
    groupInfo: "주문 정보·견적 이력",
    groupInternal: "내부 관리 (마일스톤·벤더·감사)",
  },
  zh: {
    title: "最终方案（客户可见）",
    help: "客户只能看到这些媒体、钻石规格与总价 — 下方成本明细仅管理员可见。",
    media: "方案媒体（最多 5 个 — 钻石、镶嵌、成品示例）",
    spec: "向客户展示的钻石规格",
    igiNo: "IGI 编号",
    subNote: "替换说明（留空则使用默认政策文本）",
    save: "保存方案",
    reportedShort: "客户已报告转账",
    autoSave: "更改后自动保存。",
    reportedAt: (when) => `客户报告已转定金 · ${when}`,
    useForProposal: "用于最终方案",
    proposalStone: "方案钻石",
    stageProposal: "发送最终方案",
    stageProduction: "制作进行 — CAD·成品",
    stagePayment: "收款·发货",
    groupInfo: "订单信息·报价历史",
    groupInternal: "内部管理（里程碑·供应商·审计）",
  },
  es: {
    title: "Propuesta final (visible al cliente)",
    help: "El cliente solo ve estos medios, la especificación de la piedra y el total — el desglose de costos queda solo para admin.",
    media: "Medios de la propuesta (máx. 5 — diamante, montura, pieza terminada)",
    spec: "Especificación de la piedra mostrada al cliente",
    igiNo: "N.º IGI",
    subNote: "Nota de sustitución (vacío = texto de política por defecto)",
    save: "Guardar propuesta",
    reportedShort: "cliente reportó envío",
    autoSave: "Los cambios se guardan automáticamente.",
    reportedAt: (when) => `El cliente reportó el depósito enviado · ${when}`,
    useForProposal: "Usar en la propuesta",
    proposalStone: "Piedra de la propuesta",
    stageProposal: "Enviar la propuesta final",
    stageProduction: "Producción — CAD y pieza final",
    stagePayment: "Pago y envío",
    groupInfo: "Datos del pedido e historial",
    groupInternal: "Operación interna (hitos · proveedores · auditoría)",
  },
};

function proposalComposerCopy(locale) {
  return PROPOSAL_COMPOSER_COPY[locale] || PROPOSAL_COMPOSER_COPY.en;
}

function ProposalComposer({ quote, order, locale, onSaved }) {
  const c = proposalComposerCopy(locale);
  const dia = getQuoteDiamondCandidate(order.id);
  const [media, setMedia] = useState(quote.proposalMedia?.length ? quote.proposalMedia : (dia?.media || []));
  const [spec, setSpec] = useState(quote.stoneSpec || {
    shape: dia?.shape || "round", carat: dia?.carat || "", color: dia?.color || "E",
    clarity: dia?.clarity || "VS1", growth: dia?.growth || "CVD", lab: dia?.lab || "IGI", igiNo: dia?.igiNo || "",
  });
  const [subNote, setSubNote] = useState(quote.substitutionNote || "");
  const setS = (patch) => setSpec((s) => ({ ...s, ...patch }));
  function save() {
    updateQuoteProposal(quote.id, {
      proposalMedia: media,
      stoneSpec: { ...spec, carat: Number(spec.carat) || null },
      substitutionNote: subNote.trim(),
    });
    onSaved?.();
  }
  return (
    <div className="form-stack ops-proposal-composer">
      <p className="admin-kicker">{c.title} — {quote.id}</p>
      <p className="form-hint">{c.help}</p>
      <div className="field"><span>{c.media}</span>
        <MediaPicker value={media} onChange={setMedia} maxItems={5} showSamples={false} previewMode="list" />
      </div>
      <p className="form-hint">{c.spec}</p>
      <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <label className="field"><span>shape</span>
          <select value={spec.shape} onChange={(e) => setS({ shape: e.target.value })}>
            {BENCHMARK_SHAPES.map((sh) => <option key={sh} value={sh}>{sh}</option>)}
          </select></label>
        <label className="field"><span>carat</span>
          <input type="number" step="0.01" value={spec.carat} onChange={(e) => setS({ carat: e.target.value })} /></label>
        <label className="field"><span>color</span>
          <select value={spec.color} onChange={(e) => setS({ color: e.target.value })}>
            {DIAMOND_COLORS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field"><span>clarity</span>
          <select value={spec.clarity} onChange={(e) => setS({ clarity: e.target.value })}>
            {DIAMOND_CLARITIES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field"><span>growth</span>
          <select value={spec.growth} onChange={(e) => setS({ growth: e.target.value })}>
            {GROWTH_METHODS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field"><span>lab</span>
          <select value={spec.lab} onChange={(e) => setS({ lab: e.target.value })}>
            {LABS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select></label>
        <label className="field"><span>{c.igiNo}</span>
          <input value={spec.igiNo} onChange={(e) => setS({ igiNo: e.target.value })} /></label>
      </div>
      <label className="field"><span>{c.subNote}</span>
        <textarea rows={2} value={subNote} onChange={(e) => setSubNote(e.target.value)} /></label>
      <button className="button secondary small" type="button" onClick={save}>{c.save}</button>
    </div>
  );
}

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
  savedMedia: (n, max) => `${n}/${max} files published`,
};

const OPS_NOTICE_COPY = {
  en: {
    saved: "Update saved.",
    statusSaved: "Status saved.",
    customerNoteSaved: "Customer update saved.",
    customerSent: "Sent to customer portal.",
    customerHidden: "Removed from customer portal.",
    internalNoteSaved: "Internal note saved.",
    quoteSent: "Quote sent to the customer.",
    referenceUpdated: "Reference visibility updated.",
    candidateUpdated: "Diamond candidate updated.",
    weightReconciled: "Actual weight reconciled.",
    chatSent: "Message added to this order.",
    stageAdvanced: "Order stage updated.",
    procurementCreated: "Procurement request created.",
    quoteCreated: "Quote draft created.",
    stockConfirmed: "Stock confirmed. Final customer confirmation is now open.",
    stockSoldOut: "Candidate marked sold out. Customer must choose another diamond.",
  },
  ko: {
    saved: "업데이트가 저장됐습니다.",
    statusSaved: "상태가 저장됐습니다.",
    customerNoteSaved: "고객 업데이트가 저장됐습니다.",
    customerSent: "고객 포털로 전달됐습니다.",
    customerHidden: "고객 포털에서 숨겼습니다.",
    internalNoteSaved: "내부 메모가 저장됐습니다.",
    quoteSent: "견적이 고객에게 발송됐습니다.",
    referenceUpdated: "레퍼런스 공개 설정이 저장됐습니다.",
    candidateUpdated: "다이아 후보가 업데이트됐습니다.",
    weightReconciled: "실중량 정산이 저장됐습니다.",
    chatSent: "주문 대화에 메시지가 추가됐습니다.",
    stageAdvanced: "주문 단계가 업데이트됐습니다.",
    procurementCreated: "조달 요청이 생성됐습니다.",
    quoteCreated: "견적 초안이 생성됐습니다.",
    stockConfirmed: "재고 확인 완료. 고객 포털에 최종 확정 요청이 열렸습니다.",
    stockSoldOut: "품절 처리했습니다. 고객이 다른 다이아를 선택해야 합니다.",
  },
  zh: {
    saved: "更新已保存。",
    statusSaved: "状态已保存。",
    customerNoteSaved: "客户更新已保存。",
    customerSent: "已发送到客户门户。",
    customerHidden: "已从客户门户隐藏。",
    internalNoteSaved: "内部备注已保存。",
    quoteSent: "报价已发送给客户。",
    referenceUpdated: "参考资料可见性已更新。",
    candidateUpdated: "钻石候选已更新。",
    weightReconciled: "实际重量已记录。",
    chatSent: "消息已添加到订单。",
    stageAdvanced: "订单阶段已更新。",
    procurementCreated: "采购请求已创建。",
    quoteCreated: "报价草稿已创建。",
    stockConfirmed: "库存已确认。客户最终确认已开启。",
    stockSoldOut: "候选钻石已标记为售出。客户需要重新选择。",
  },
  es: {
    saved: "Actualización guardada.",
    statusSaved: "Estado guardado.",
    customerNoteSaved: "Actualización del cliente guardada.",
    customerSent: "Enviado al portal del cliente.",
    customerHidden: "Ocultado del portal del cliente.",
    internalNoteSaved: "Nota interna guardada.",
    quoteSent: "Cotización enviada al cliente.",
    referenceUpdated: "Visibilidad de referencia actualizada.",
    candidateUpdated: "Candidato actualizado.",
    weightReconciled: "Peso real conciliado.",
    chatSent: "Mensaje agregado al pedido.",
    stageAdvanced: "Etapa del pedido actualizada.",
    procurementCreated: "Solicitud de compra creada.",
    quoteCreated: "Borrador de cotización creado.",
    stockConfirmed: "Stock confirmado. La confirmación final del cliente ya está abierta.",
    stockSoldOut: "Candidato marcado como agotado. El cliente debe elegir otro diamante.",
  },
};

function noticeCopy(locale) {
  return OPS_NOTICE_COPY[locale] || OPS_NOTICE_COPY.en;
}

const PROXY_STAGE_COPY = {
  en: {
    open: "Waiting for customer",
    ready: "Ready to send",
    done: "Confirmed",
    rejected: "Rejected",
    notSent: "Not sent",
    sent: "sent",
    activeEdit: "Active upload",
    openActions: "open customer action",
    openActionsPlural: "open customer actions",
    noMedia: "No media yet",
    rejectionReason: "Rejection reason",
    customerAttachments: "Customer attachments",
    diamondMeta: "Customer selects one stone before quote/CAD.",
    designMeta: "Customer approves or requests a revision.",
    finalMeta: "Customer confirms the finished piece before balance.",
  },
  ko: {
    open: "고객 확인 대기",
    ready: "전송 준비",
    done: "컨펌 완료",
    rejected: "반려됨",
    notSent: "아직 미전송",
    sent: "개 공개",
    activeEdit: "현재 업로드",
    openActions: "고객 액션",
    openActionsPlural: "고객 액션",
    noMedia: "아직 미디어 없음",
    rejectionReason: "반려 사유",
    customerAttachments: "고객 첨부",
    diamondMeta: "견적/CAD 전에 고객이 스톤 하나를 선택합니다.",
    designMeta: "고객이 디자인을 승인하거나 수정 요청합니다.",
    finalMeta: "잔금 전에 고객이 완성품 실물을 컨펌합니다.",
  },
  zh: {
    open: "等待客户确认",
    ready: "准备发送",
    done: "已确认",
    rejected: "已驳回",
    notSent: "尚未发送",
    sent: "个已发布",
    activeEdit: "当前上传",
    openActions: "个客户任务",
    openActionsPlural: "个客户任务",
    noMedia: "暂无媒体",
    rejectionReason: "驳回原因",
    customerAttachments: "客户附件",
    diamondMeta: "报价/CAD 前客户选择一颗石头。",
    designMeta: "客户确认设计或提出修改。",
    finalMeta: "尾款前客户确认成品实物。",
  },
  es: {
    open: "Esperando cliente",
    ready: "Listo para enviar",
    done: "Confirmado",
    rejected: "Rechazado",
    notSent: "No enviado",
    sent: "publicados",
    activeEdit: "Carga activa",
    openActions: "acción cliente",
    openActionsPlural: "acciones cliente",
    noMedia: "Sin medios todavía",
    rejectionReason: "Motivo de rechazo",
    customerAttachments: "Adjuntos del cliente",
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

function isRejectedAction(action) {
  return action?.status === "rejected" || action?.decision === "rejected";
}

function ProxyMediaStrip({ media, emptyText }) {
  const items = media.slice(0, 3);
  if (!items.length) return <div className="ops-proxy-media-empty">{emptyText}</div>;
  return (
    <div className="ops-proxy-media-strip">
      {items.map((item, index) => (
        <MediaThumb key={`${item.src}-${index}`} media={item} alt="" ratio="1 / 1" fit="contain" />
      ))}
    </div>
  );
}

function ProxyStageCard({ active, done, rejected, title, status, meta, media, emptyText, rejectionReason, rejectionMedia, copy, onClick }) {
  return (
    <button
      className={`ops-proxy-stage-card ${active ? "is-active" : ""} ${done ? "is-done" : ""} ${rejected ? "is-rejected" : ""}`}
      type="button"
      onClick={onClick}
    >
      <div className="ops-proxy-stage-top">
        <span>{title}</span>
        <strong>{status}</strong>
      </div>
      <ProxyMediaStrip media={media} emptyText={emptyText} />
      <p>{meta}</p>
      {rejected && (
        <div className="ops-proxy-rejection">
          <span>{copy.rejectionReason}</span>
          {rejectionReason && <p>{rejectionReason}</p>}
          {rejectionMedia?.length > 0 && (
            <>
              <span>{copy.customerAttachments}</span>
              <ProxyMediaStrip media={rejectionMedia} emptyText={emptyText} />
            </>
          )}
        </div>
      )}
    </button>
  );
}

function defaultProxyStep(order, actions) {
  if (actions.some((action) => action.status === "open" && action.type === "finalConfirmation")) return "final";
  if (actions.some((action) => action.status === "open" && ["cadReview", "cadApproval"].includes(action.type))) return "design";
  if (actions.some((action) => action.status === "open" && action.type === "diamondSelection")) return "diamond";
  if (["QC", "BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status)) return "final";
  if (["CAD", "PRODUCTION"].includes(order.status)) return "design";
  return "diamond";
}

function OperatorProxyPanel({ order, t, p, locale }) {
  const copy = t.proxy || FALLBACK_PROXY_COPY;
  const stageCopy = proxyStageCopy(locale);
  const candidates = listCandidates({ orderId: order.id });
  const cads = listCadReviews(order.id);
  const actions = listCustomerActions(order.id);
  const [activeStep, setActiveStep] = useState(() => defaultProxyStep(order, actions));
  const publishedCandidates = candidates.filter((candidate) => candidate.published);
  const selectedCandidate = order.selectedDiamondId ? candidates.find((candidate) => candidate.id === order.selectedDiamondId) : null;
  const latestCad = cads[0] || null;
  const diamondAction = latestCustomerAction(actions, "diamondSelection");
  const designAction = latestCustomerAction(actions, "cadReview") || latestCustomerAction(actions, "cadApproval");
  const finalAction = latestCustomerAction(actions, "finalConfirmation");
  const diamondRejected = isRejectedAction(diamondAction);
  const designRejected = isRejectedAction(designAction) || latestCad?.decision === "minorRevision";
  const finalRejected = isRejectedAction(finalAction);
  const finalDone = finalAction?.status === "done" || ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status);
  const openCount = actions.filter((action) => action.status === "open").length;
  const steps = [
    {
      key: "diamond",
      title: copy.diamondTitle,
      status: diamondRejected ? stageCopy.rejected : selectedCandidate ? stageCopy.done : publishedCandidates.length ? `${publishedCandidates.length} ${stageCopy.sent}` : stageCopy.notSent,
      done: Boolean(selectedCandidate),
      rejected: diamondRejected,
      meta: stageCopy.diamondMeta,
      media: publishedCandidates.flatMap((candidate) => adminMediaList(candidate.media, candidate.image || candidate.video)).slice(0, 3),
      rejectionReason: diamondAction?.rejectionReason || "",
      rejectionMedia: adminMediaList(diamondAction?.responseAttachments),
    },
    {
      key: "design",
      title: copy.designTitle,
      status: designRejected ? stageCopy.rejected : latestCad?.decision === "approved" ? stageCopy.done : latestCad ? stageCopy.open : stageCopy.notSent,
      done: latestCad?.decision === "approved",
      rejected: designRejected,
      meta: stageCopy.designMeta,
      media: adminMediaList(latestCad?.media, latestCad?.fileUrl),
      rejectionReason: designAction?.rejectionReason || latestCad?.feedback?.join(" · ") || "",
      rejectionMedia: adminMediaList(designAction?.responseAttachments || latestCad?.responseAttachments),
    },
    {
      key: "final",
      title: copy.finalTitle,
      status: finalRejected ? stageCopy.rejected : finalDone ? stageCopy.done : finalAction ? stageCopy.open : stageCopy.notSent,
      done: finalDone,
      rejected: finalRejected,
      meta: stageCopy.finalMeta,
      media: adminMediaList(finalAction?.media, finalAction?.link),
      rejectionReason: finalAction?.rejectionReason || "",
      rejectionMedia: adminMediaList(finalAction?.responseAttachments),
    },
  ];
  const active = steps.find((step) => step.key === activeStep) || steps[0];

  return (
    <section className="panel ops-proxy-workbench">
      <div className="ops-proxy-head">
        <div>
          <p className="admin-kicker">{t.confirmationsTitle}</p>
          <h3>{copy.title}</h3>
          <p className="form-hint">{copy.sub}</p>
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
            rejected={step.rejected}
            title={step.title}
            status={step.status}
            meta={step.meta}
            media={step.media}
            emptyText={stageCopy.noMedia}
            rejectionReason={step.rejectionReason}
            rejectionMedia={step.rejectionMedia}
            copy={stageCopy}
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

function AdminConversationPanel({ orderId, messages, copy, onSaved, notice }) {
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
    onSaved?.(notice.chatSent);
  }

  return (
    <section className="panel conversation-panel admin-conversation-panel" data-testid="admin-order-chat">
      <div className="conversation-head">
        <div>
          <p className="admin-kicker">{copy.title}</p>
          <h3>{copy.directTitle || copy.title}</h3>
          <p className="form-hint">{copy.sub}</p>
        </div>
        <span className="channel-pill">{channelLabel(channel)}</span>
      </div>
      <div className="conversation-thread" aria-live="polite">
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
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={copy.placeholder} rows={2} />
        <div className="admin-conversation-actions">
          <details className="admin-conversation-log-options">
            <summary>{copy.logOptions || copy.channel}</summary>
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
          </details>
          <button className="button primary small" type="submit" disabled={!draft.trim()}>{copy.send}</button>
        </div>
      </form>
    </section>
  );
}

function ProxyDiamondForm({ orderId, copy, p }) {
  const [media, setMedia] = useState([]);
  const [saved, setSaved] = useState(false);
  const [savedMediaCount, setSavedMediaCount] = useState(0);
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
    setSavedMediaCount(0);
    setF((current) => ({ ...current, [key]: value }));
  }
  function submit(e) {
    e.preventDefault();
    const candidate = createProxyDiamondCandidate(orderId, { ...f, media }, "ops");
    setSaved(true);
    setSavedMediaCount(candidate?.media?.length || 0);
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
          <MediaPicker value={media} onChange={(items) => { setSaved(false); setSavedMediaCount(0); setMedia(items); }} maxItems={5} showSamples={false} previewMode="list" />
        </label>
      </div>
      <div className="ops-proxy-form-actions">
        <button className="button primary small" disabled={media.length === 0} type="submit">{copy.publishDiamond}</button>
        {saved && (
          <p className="form-hint" role="status">
            {copy.saved}{savedMediaCount ? ` · ${copy.savedMedia?.(savedMediaCount, 5) || `${savedMediaCount}/5 files published`}` : ""}
          </p>
        )}
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
        {saved && <p className="form-hint" role="status">{copy.saved}</p>}
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
        {saved && <p className="form-hint" role="status">{copy.saved}</p>}
      </div>
    </form>
  );
}

function customerActionLabel(action, t) {
  const labels = {
    diamondSelection: t.proxy?.diamondTitle,
    cadReview: t.proxy?.designTitle,
    cadApproval: t.proxy?.designTitle,
    finalConfirmation: t.proxy?.finalTitle,
  };
  return labels[action?.type] || action?.type || "";
}

const OPS_FLOW_COPY = {
  en: {
    kicker: "Client flow",
    title: "Move the order in three confirmations.",
    sub: "Use this as the operating map. Upload customer-facing media below, then update only the checkpoint that matters now.",
    stoneTitle: "1. Diamond choice",
    designTitle: "2. Design approval",
    finalTitle: "3. Finished piece",
    stoneHelp: "Send candidate stones and wait for the customer to choose one.",
    designHelp: "Send CAD, render, or design draft media for approval.",
    finalHelp: "Send final QC photos or videos before balance and shipping.",
    status: "Status",
    clientNote: "Message to customer",
    notePlaceholder: "Write the update to send to the customer portal",
    show: "Send to customer portal",
    hide: "Sent to customer portal",
    done: "Done",
    waiting: "Customer turn",
    current: "In progress",
    next: "Next",
    manualTitle: "Technical milestone summary",
    manualSub: "Use the three cards above for normal operation. These technical checkpoints are shown only for audit/debugging.",
  },
  ko: {
    kicker: "고객 진행 흐름",
    title: "주문은 3번의 고객 컨펌으로 진행됩니다.",
    sub: "운영자는 아래 컨펌 자료를 올리고, 지금 필요한 체크포인트만 업데이트하면 됩니다.",
    stoneTitle: "1. 다이아 선택",
    designTitle: "2. 디자인 승인",
    finalTitle: "3. 완성품 컨펌",
    stoneHelp: "다이아 후보를 공개하고 고객이 하나를 선택할 때까지 대기합니다.",
    designHelp: "CAD, 렌더, 디자인 시안을 올려 고객 승인을 받습니다.",
    finalHelp: "잔금·배송 전에 최종 QC 사진이나 영상을 공개합니다.",
    status: "상태",
    clientNote: "고객에게 보낼 메시지",
    notePlaceholder: "고객 포털에 보낼 업데이트를 입력하세요",
    show: "고객 포털로 보내기",
    hide: "고객에게 전달됨",
    done: "완료",
    waiting: "고객 확인",
    current: "진행중",
    next: "예정",
    manualTitle: "기술 마일스톤 요약",
    manualSub: "일반 운영은 위 3개 카드만 사용하세요. 아래는 감사/디버깅용 진행 요약입니다.",
  },
  zh: {
    kicker: "客户流程",
    title: "订单通过三次客户确认推进。",
    sub: "上传客户可见资料，然后只更新当前需要的确认节点。",
    stoneTitle: "1. 选钻",
    designTitle: "2. 设计确认",
    finalTitle: "3. 成品确认",
    stoneHelp: "发布候选钻石，等待客户选择。",
    designHelp: "发布 CAD、渲染图或设计草案供客户确认。",
    finalHelp: "尾款与发货前发布最终质检照片或视频。",
    status: "状态",
    clientNote: "发送给客户的消息",
    notePlaceholder: "填写要发送到客户门户的更新",
    show: "发送到客户门户",
    hide: "已发送到客户门户",
    done: "完成",
    waiting: "客户确认",
    current: "进行中",
    next: "下一步",
    manualTitle: "技术里程碑摘要",
    manualSub: "日常操作使用上方三个卡片；以下仅用于审计/排查。",
  },
  es: {
    kicker: "Flujo cliente",
    title: "El pedido avanza con tres confirmaciones.",
    sub: "Sube medios visibles para el cliente y actualiza solo el checkpoint activo.",
    stoneTitle: "1. Elección de diamante",
    designTitle: "2. Aprobación de diseño",
    finalTitle: "3. Pieza final",
    stoneHelp: "Envía candidatos de diamante y espera la elección del cliente.",
    designHelp: "Envía CAD, renders o bocetos para aprobación.",
    finalHelp: "Envía fotos o videos QC finales antes de saldo y envío.",
    status: "Estado",
    clientNote: "Mensaje para el cliente",
    notePlaceholder: "Escribe la actualización para enviar al portal del cliente",
    show: "Enviar al portal del cliente",
    hide: "Enviado al portal del cliente",
    done: "Listo",
    waiting: "Turno cliente",
    current: "En curso",
    next: "Siguiente",
    manualTitle: "Resumen técnico de hitos",
    manualSub: "Para operación normal usa las tres tarjetas superiores. Esto es solo auditoría/debug.",
  },
};

const OPS_FLOW_GROUPS = [
  {
    key: "stone",
    titleKey: "stoneTitle",
    helpKey: "stoneHelp",
    primaryStage: "diamondLocked",
    doneStage: "diamondLocked",
    stages: ["depositReceived", "diamondLocked"],
    actionTypes: ["diamondSelection", "quoteAcceptance"],
  },
  {
    key: "design",
    titleKey: "designTitle",
    helpKey: "designHelp",
    primaryStage: "cadIssued",
    doneStage: "cadApproved",
    stages: ["cadIssued", "cadApproved", "productionStarted"],
    actionTypes: ["cadReview", "cadApproval"],
  },
  {
    key: "final",
    titleKey: "finalTitle",
    helpKey: "finalHelp",
    primaryStage: "finalQcVideo",
    doneStage: "deliveredArchived",
    stages: ["finalQcVideo", "balanceReceived", "sentDomesticWarehouse", "oceanShipment", "deliveredArchived"],
    actionTypes: ["finalConfirmation"],
  },
];

function opsFlowCopy(locale) {
  return OPS_FLOW_COPY[locale] || OPS_FLOW_COPY.en;
}

function milestoneFor(milestones, stage) {
  return milestones.find((m) => m.stage === stage);
}

function flowGroupState(group, milestones, actions) {
  const openAction = actions.find((action) => action.status === "open" && group.actionTypes.includes(action.type));
  const done = milestoneFor(milestones, group.doneStage)?.status === "done";
  const relevant = group.stages.map((stage) => milestoneFor(milestones, stage)).filter(Boolean);
  if (done) return "done";
  if (openAction) return "waiting";
  if (relevant.some((m) => m.status === "blocked")) return "blocked";
  if (relevant.some((m) => m.status === "inProgress" || m.status === "waitingClient")) return "current";
  return "next";
}

function flowLabel(copy, state) {
  if (state === "done") return copy.done;
  if (state === "waiting") return copy.waiting;
  if (state === "current" || state === "blocked") return copy.current;
  return copy.next;
}

function CustomerFlowPanel({ order, milestones, actions, t, p, locale, onSaved }) {
  const copy = opsFlowCopy(locale);
  const notice = noticeCopy(locale);

  function saveFlow(stage, patch, message) {
    upsertMilestone(order.id, stage, patch);
    onSaved?.(message);
  }

  return (
    <section className="panel ops-customer-flow">
      <div className="ops-flow-head">
        <div>
          <p className="admin-kicker">{copy.kicker}</p>
          <h3>{copy.title}</h3>
          <p className="form-hint">{copy.sub}</p>
        </div>
        <Link className="button secondary small" to={`/track/${order.id}?code=${order.queryCode}`}>{t.openPortal || p.portal.title}</Link>
      </div>
      <div className="ops-flow-grid">
        {OPS_FLOW_GROUPS.map((group) => {
          const primary = milestoneFor(milestones, group.primaryStage);
          const state = flowGroupState(group, milestones, actions);
          return (
            <article className={`ops-flow-card ${state}`} key={group.key}>
              <div className="ops-flow-card-top">
                <div>
                  <h4>{copy[group.titleKey]}</h4>
                  <p>{copy[group.helpKey]}</p>
                </div>
                <span className={`status-badge mst-${state === "waiting" ? "waitingClient" : state === "current" ? "inProgress" : state === "next" ? "pending" : state}`}>{flowLabel(copy, state)}</span>
              </div>
              <div className="ops-flow-controls">
                <label className="field"><span>{copy.status}</span>
                  <select value={primary?.status || "pending"} onChange={(e) => saveFlow(group.primaryStage, { status: e.target.value }, notice.statusSaved)}>
                    {["pending", "inProgress", "waitingClient", "blocked", "done"].map((st) => <option key={st} value={st}>{p.msStatus[st]}</option>)}
                  </select>
                </label>
                <label className="field"><span>{copy.clientNote}</span>
                  <input defaultValue={primary?.clientUpdate || ""} key={`${group.primaryStage}-${primary?.clientUpdate}`} placeholder={copy.notePlaceholder}
                    onBlur={(e) => saveFlow(group.primaryStage, { clientUpdate: e.target.value }, notice.customerNoteSaved)} />
                </label>
              </div>
              <button className={`chip ops-flow-visibility ${primary?.publishToClient ? "is-active" : ""}`}
                onClick={() => saveFlow(
                  group.primaryStage,
                  { publishToClient: !primary?.publishToClient },
                  primary?.publishToClient ? notice.customerHidden : notice.customerSent,
                )}>
                {primary?.publishToClient ? copy.hide : copy.show}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CompactMilestoneSummary({ milestones, p, locale }) {
  const copy = opsFlowCopy(locale);
  return (
    <div className="panel ops-compact-milestones">
      <h3>{copy.manualTitle}</h3>
      <p className="form-hint">{copy.manualSub}</p>
      <div className="ops-compact-milestone-grid">
        {MILESTONE_STAGES.map((stage) => {
          const status = milestoneFor(milestones, stage)?.status || "pending";
          return (
            <span className={`ops-compact-milestone mst-${status}`} key={stage}>
              <strong>{p.msStages[stage]}</strong>
              <em>{p.msStatus[status]}</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function formatShippingAddress(address) {
  if (!address) return "";
  return [
    address.recipientName,
    address.phone,
    [address.addressLine1, address.addressLine2].filter(Boolean).join(" "),
    [address.city, address.region, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean).join(" · ");
}

function orderBriefRows({ order, intake, style, p, t, locale }) {
  const styleName = style ? pickI18n(style.name, locale) : p.intake.noStyle;
  const subcategory = style?.subcategory || intake?.subcategory;
  const rows = [
    { label: p.intake.name, value: order.customerName || "—" },
    { label: p.intake.contact, value: intake?.contact || "—" },
    { label: p.intake.style, value: styleName },
    { label: p.intake.category, value: intake ? p.opsCategories[intake.category] : "—" },
    ...(subcategory ? [{ label: p.intake.subcategory, value: p.opsSubcategories?.[subcategory] || subcategory }] : []),
    { label: p.intake.metal, value: intake ? p.opsMetals[intake.metal] : "—" },
    { label: t.required, value: order.requiredDate || intake?.requiredDate || "—" },
    { label: t.queryCode, value: order.queryCode || "—" },
  ];

  if (intake?.conditional) {
    Object.entries(intake.conditional).forEach(([key, value]) => {
      if (!value) return;
      rows.push({ label: p.intake[key] || key, value });
    });
  }
  if (intake?.budget) rows.push({ label: t.budgetLabel, value: usd(intake.budget) });
  const shippingAddress = formatShippingAddress(order.shippingAddress);
  if (shippingAddress) rows.push({ label: t.shippingAddressLabel, value: shippingAddress });
  else if (order.status === "QUOTATION") rows.push({ label: t.shippingAddressLabel, value: t.shippingAddressMissing });
  if (intake?.stonePrefs) {
    const s = intake.stonePrefs;
    rows.push({
      label: p.intake.stoneTitle,
      value: [s.shape, s.carat && `${s.carat}ct`, s.color, s.clarity, s.growth].filter(Boolean).join(" · "),
    });
  }
  if (intake?.multiSpec) {
    rows.push({ label: p.intake.multiTitle, value: [intake.multiSpec.meleeSpec, intake.multiSpec.overallDims, intake.multiSpec.standard].filter(Boolean).join(" · ") });
  }
  return rows;
}

function formatCandidateSummary(candidate, p) {
  if (!candidate) return "";
  const carat = Number.isFinite(Number(candidate.carat)) ? Number(candidate.carat).toFixed(2) : candidate.carat;
  const shape = p.shapes?.[candidate.shape] || candidate.shape || "";
  return [
    [shape, carat && `${carat}ct`].filter(Boolean).join(" "),
    [candidate.color, candidate.clarity, candidate.growth].filter(Boolean).join(" · "),
    candidate.igiNo,
  ].filter(Boolean).join(" · ");
}

function fillStepTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function NextActionPanel({ order, operatorStep, waitingStep, nextAction, openActions, t, p, onSaved, notice }) {
  const customerPortalHref = `/track/${order.id}?code=${order.queryCode}`;
  const hasOperatorStep = Boolean(operatorStep || nextAction);
  const isWaiting = !hasOperatorStep && (Boolean(waitingStep) || openActions.length > 0);
  const heading = operatorStep?.title || (nextAction ? nextAction.label : waitingStep?.title || (isWaiting ? t.customerWaitingSub : t.naNone));
  return (
    <section className={`panel ops-next-panel ${hasOperatorStep ? "is-operator" : isWaiting ? "is-waiting" : ""}`}>
      <div>
        <p className="admin-kicker">{hasOperatorStep ? t.operatorAction : isWaiting ? t.customerWaiting : t.naTitle}</p>
        <h2>{heading}</h2>
        {operatorStep?.body && <p className="form-hint ops-next-body">{operatorStep.body}</p>}
        {waitingStep?.body && <p className="form-hint ops-next-body">{waitingStep.body}</p>}
      </div>
      {openActions.length > 0 && (
        <div className="ops-open-action-list" aria-label={t.openActions}>
          {openActions.map((action) => (
            <span key={action.id}>{customerActionLabel(action, t)}</span>
          ))}
        </div>
      )}
      <div className="ops-next-actions">
        {operatorStep && (
          <>
            <button className="button primary" onClick={operatorStep.onPrimary}>{operatorStep.primaryLabel}</button>
            <button className="button secondary" onClick={operatorStep.onSecondary}>{operatorStep.secondaryLabel}</button>
          </>
        )}
        {!operatorStep && nextAction && <button className="button primary" onClick={() => { nextAction.fn(); onSaved?.(notice.stageAdvanced); }}>{nextAction.label}</button>}
        <Link className="button secondary" to={customerPortalHref}>{t.openPortal || p.portal.title}</Link>
      </div>
    </section>
  );
}

function OrderBriefPanel({ order, intake, style, p, t, locale }) {
  const rows = orderBriefRows({ order, intake, style, p, t, locale });
  return (
    <section className="panel ops-side-card">
      <p className="admin-kicker">{t.orderBrief}</p>
      <div className="ops-brief-list">
        {rows.map((row, index) => (
          <div className="ops-brief-row" key={`${row.label}-${index}`}>
            <span>{row.label}</span>
            <strong>{row.value || "—"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function InternalControlsPanel({ order, t, p, locale, onSaved, notice }) {
  return (
    <section className="panel ops-side-card ops-internal-card">
      <p className="admin-kicker">{t.internalControls}</p>
      <label className="field"><span>{t.statusSet}</span>
        <select value={order.status} onChange={(e) => { updateOpsOrder(order.id, { status: e.target.value }); onSaved?.(notice.statusSaved); }}>
          {ORDER_STATUSES.map((st) => <option key={st} value={st}>{p.orderStatus[st]}</option>)}
        </select>
      </label>
      <label className="field"><span>{t.internalNotes}</span>
        <textarea defaultValue={order.internalNotes} key={order.internalNotes} onBlur={(e) => { updateOpsOrder(order.id, { internalNotes: e.target.value }); onSaved?.(notice.internalNoteSaved); }} rows={4} />
      </label>
      <p className="form-hint">{proposalComposerCopy(locale).autoSave}</p>
    </section>
  );
}

function QuoteSnapshotPanel({ quotes, acceptedQuote, intake, t, p, locale, onSaved, notice }) {
  const latestQuote = acceptedQuote || quotes[0] || null;
  const c = proposalComposerCopy(locale);
  return (
    <section className="panel ops-side-card ops-quote-card">
      <p className="admin-kicker">{t.latestQuote}</p>
      {!latestQuote ? (
        <p className="form-hint">{t.noQuote}</p>
      ) : (
        <div className="ops-quote-summary">
          <strong>{usd(latestQuote.totalUsd)}</strong>
          <span>{latestQuote.status} · {p.portal.deposit} {usd(latestQuote.depositUsd)} / {p.portal.balance} {usd(latestQuote.balanceUsd)}</span>
          {intake?.budget && latestQuote.totalUsd > intake.budget && <em>{t.overBudget} · {t.budgetLabel} {usd(intake.budget)}</em>}
          {acceptedQuote?.depositReportedAt && (
            <em className="ops-deposit-reported">{c.reportedAt(new Date(acceptedQuote.depositReportedAt).toLocaleString())}</em>
          )}
        </div>
      )}
      {quotes.filter((q) => q.status === "draft").map((quote) => (
        <button key={quote.id} className="button secondary small" onClick={() => { sendQuote(quote.id); onSaved?.(notice.quoteSent); }}>{t.send} · {usd(quote.totalUsd)}</button>
      ))}
    </section>
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
  const [saveNotice, setSaveNotice] = useState("");

  if (!order) return <div className="page"><EmptyNote>—</EmptyNote></div>;

  const intake = getIntake(order.intakeId);
  const style = order.styleId ? getOpsStyle(order.styleId) : null;
  const candidates = listCandidates({ orderId });
  const quotes = listQuotes(orderId);
  const quoteDiamondCandidate = getQuoteDiamondCandidate(orderId);
  const milestones = listMilestones(orderId);
  const cads = listCadReviews(orderId);
  const actions = listCustomerActions(orderId);
  const messages = listOrderMessages(orderId);
  const procurements = listProcurements({ orderId });
  const auditRows = listAudit(orderId).slice(-8).reverse();
  const suppliers = getDB().users.filter((u) => u.role === "supplier");
  const acceptedQuote = quotes.find((q) => q.status === "accepted");
  const notice = noticeCopy(locale);

  function notify(message = notice.saved) {
    setSaveNotice(message);
  }

  // 어드민 터치포인트는 단 3개 — 지금 필요한 하나만 카드로 띄운다 (나머지는 자동 진행)
  const depositDone = milestones.some((m) => m.stage === "depositReceived" && m.status === "done");
  const balanceDone = milestones.some((m) => m.stage === "balanceReceived" && m.status === "done");
  const shippingAddressComplete = isShippingAddressComplete(order.shippingAddress);
  const waitingForShippingAddress = order.status === "QUOTATION" && acceptedQuote && !shippingAddressComplete;
  const nextAction = (order.status === "QUOTATION" && acceptedQuote && shippingAddressComplete)
    ? {
      fn: () => markDepositReceived(order.id),
      label: acceptedQuote.depositReportedAt
        ? `${t.markDeposit} · ${proposalComposerCopy(locale).reportedShort}`
        : t.markDeposit,
    }
    : (order.status === "BALANCE" && !balanceDone) ? { fn: () => markBalanceReceived(order.id), label: t.markBalance }
      : order.status === "SHIPPING" ? { fn: () => markOrderDelivered(order.id), label: t.markDelivered }
        : null;

  const openCustomerActions = actions.filter((action) => action.status === "open");
  const stageCopy = proposalComposerCopy(locale);
  // 워크플로우 페이즈 — 어떤 스테이지를 기본으로 펼칠지
  const proposalPhase = !depositDone && ["STYLE_SELECTION", "STONE_SELECTION", "QUOTATION"].includes(order.status);
  const productionPhase = ["CAD", "PRODUCTION", "QC"].includes(order.status);
  const paymentPhase = ["BALANCE", "SHIPPING"].includes(order.status);
  const waitingStep = waitingForShippingAddress ? {
    title: t.shippingAddressWaitingTitle,
    body: t.shippingAddressWaitingBody,
  } : null;
  return (
    <div className="page ops-order-page">
      <header className="ops-order-header">
        <div>
          <p className="admin-kicker">{t.commandTitle}</p>
          <h1>{order.id} <span className={`status-badge ost-${order.status}`}>{p.orderStatus[order.status]}</span></h1>
          <p>
            {order.customerName || "—"}
            {style && <> · {pickI18n(style.name, locale)}</>}
            {order.queryCode && <> · {t.queryCode}: {order.queryCode}</>}
          </p>
        </div>
        <Link className="button secondary" to="/admin/orders">← {t.title}</Link>
      </header>
      <p className={`admin-save-notice ops-page-notice ${saveNotice ? "is-saved" : ""}`} role="status" aria-live="polite">
        {saveNotice}
      </p>

      {/* 워크플로우 스테이지 — 지금 단계만 기본으로 펼친다 (상태 바뀌면 key로 초기화) */}
      <details className="ops-stage" key={`s1-${order.status}-${depositDone}`} open={proposalPhase}>
        <summary>
          <span className="ops-stage-no">{depositDone ? "✓" : "01"}</span>
          <span className="ops-stage-title">{stageCopy.stageProposal}</span>
          <span className={`status-badge ${proposalPhase ? "mst-waitingClient" : depositDone ? "mst-done" : "mst-pending"}`}>
            {proposalPhase ? p.visual.nowAction : depositDone ? p.visual.doneTag : p.visual.upcoming}
          </span>
        </summary>
        <div className="ops-stage-body">
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
                        <select value={c.internalReview || ""} onChange={(e) => { reviewCandidate(c.id, e.target.value); notify(notice.candidateUpdated); }}>
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
                            <button className="chip is-active" onClick={() => { unpublishCandidate(c.id); notify(notice.candidateUpdated); }}>{t.unpublish}</button>
                          </div>
                        ) : (
                          <input type="number" placeholder={t.pricePh} style={{ width: 132 }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); publishCandidate(c.id, Number(e.target.value)); notify(notice.candidateUpdated); } }} />
                        )}
                      </td>
                      <td>
                        <select value={c.availability} onChange={(e) => { setCandidateAvailability(c.id, e.target.value); notify(notice.candidateUpdated); }}>
                          {["available", "hold", "sold"].map((a) => <option key={a} value={a}>{p.portal.availability[a]}</option>)}
                        </select>
                      </td>
                      <td>
                        {c.locked ? <span className="status-badge cst-REPLACED">{t.locked}</span>
                          : c.clientSelection === "selected" ? (
                            depositDone
                              ? <button className="button primary small" onClick={() => { lockCandidate(c.id, "ops"); notify(notice.candidateUpdated); }}>{t.lock}</button>
                              : <span className="status-badge mst-inProgress">{stageCopy.proposalStone}</span>
                          )
                          : (c.published && c.availability === "available" && !order.selectedDiamondId
                            && !candidates.some((x) => x.clientSelection === "selected")) ? (
                              // 새 flow: 고객 후보 선택 대신 어드민이 제안 스톤을 지정 → 견적 자동 발송
                              <button className="button secondary small" onClick={() => {
                                toggleShortlist(c.id, "ops");
                                submitDiamondSelection(order.id, "ops");
                                notify(notice.candidateUpdated);
                              }}>{stageCopy.useForProposal}</button>
                            ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="panel form-stack">
            <h3>{t.quoteTitle}</h3>
            {quotes.map((q) => (
              <div key={q.id} className="feedback-note">
                <strong>{q.id}</strong> · {q.status} · {usd(q.totalUsd)} ({p.portal.deposit} {usd(q.depositUsd)} / {p.portal.balance} {usd(q.balanceUsd)})
                {intake?.budget && q.totalUsd > intake.budget && <span style={{ color: "#e08585", marginLeft: 6 }}>⚠ {t.overBudget} (${intake.budget})</span>}
                {q.actualWeightG && ` · actual ${q.actualWeightG}g`}
                {q.status === "draft" && <button className="button secondary small" style={{ marginLeft: 10 }} onClick={() => { sendQuote(q.id); notify(notice.quoteSent); }}>{t.send}</button>}
              </div>
            ))}
            {(() => {
              const editable = quotes.find((q) => q.status === "draft" || q.status === "sent");
              return editable
                ? <ProposalComposer key={editable.id} quote={editable} order={order} locale={locale} onSaved={() => notify()} />
                : null;
            })()}
            {quoteDiamondCandidate || intake?.productLine === "multi" ? <QuoteBuilder order={order} settings={settings} t={t} onSaved={notify} notice={notice} /> : null}
          </div>
        </div>
      </details>

      <details className="ops-stage" key={`s2-${order.status}`} open={productionPhase}>
        <summary>
          <span className="ops-stage-no">{["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status) ? "✓" : "02"}</span>
          <span className="ops-stage-title">{stageCopy.stageProduction}</span>
          <span className={`status-badge ${productionPhase ? "mst-waitingClient" : ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status) ? "mst-done" : "mst-pending"}`}>
            {productionPhase ? p.visual.nowAction : ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status) ? p.visual.doneTag : p.visual.upcoming}
          </span>
        </summary>
        <div className="ops-stage-body">
          <OperatorProxyPanel order={order} t={t} p={p} locale={locale} />
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
        </div>
      </details>

      <details className="ops-stage" key={`s3-${order.status}`} open={paymentPhase}>
        <summary>
          <span className="ops-stage-no">{["DELIVERED", "ARCHIVED"].includes(order.status) ? "✓" : "03"}</span>
          <span className="ops-stage-title">{stageCopy.stagePayment}</span>
          <span className={`status-badge ${paymentPhase ? "mst-waitingClient" : ["DELIVERED", "ARCHIVED"].includes(order.status) ? "mst-done" : "mst-pending"}`}>
            {paymentPhase ? p.visual.nowAction : ["DELIVERED", "ARCHIVED"].includes(order.status) ? p.visual.doneTag : p.visual.upcoming}
          </span>
        </summary>
        <div className="ops-stage-body">
          {acceptedQuote ? (
            <div className="panel form-stack">
              <h3>{t.actualWeight}</h3>
              <div className="row-actions">
                <input type="number" step="0.01" placeholder={t.actualWeight} value={actualW} onChange={(e) => setActualW(e.target.value)}
                  style={{ width: 150, background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "9px 10px" }} />
                <button className="button secondary small" disabled={!actualW} onClick={() => { recordActualWeight(order.id, Number(actualW)); setActualW(""); notify(notice.weightReconciled); }}>{t.reconcile}</button>
              </div>
            </div>
          ) : <p className="form-hint">—</p>}
        </div>
      </details>

      <AdminConversationPanel orderId={order.id} messages={messages} copy={t.chat} onSaved={notify} notice={notice} />

      {/* 참고용 그룹 — 필요할 때만 펼친다 */}
      <details className="ops-admin-details">
        <summary>{stageCopy.groupInfo}</summary>
        <div className="ops-stage-body">
          <OrderBriefPanel order={order} intake={intake} style={style} p={p} t={t} locale={locale} />
          <QuoteSnapshotPanel quotes={quotes} acceptedQuote={acceptedQuote} intake={intake} t={t} p={p} locale={locale} onSaved={notify} notice={notice} />
          {intake?.referenceMedia?.length > 0 && (
            <div className="panel form-stack">
              <h3>{p.visual.refReviewTitle}</h3>
              <div className="card-grid cols-3">
                {intake.referenceMedia.map((m) => (
                  <div key={m.id} className="item-card">
                    <MediaThumb media={m} alt={m.id} fit="contain" />
                    <div className="card-body">
                      <p className="spec">{m.id} · {p.visual.refStatus[m.status]}</p>
                      {m.annotations?.map((a) => (
                        <p key={a.pinId} className="form-hint"><span className="pin-tag">{a.pinId}</span>{formatAnnotation(a, getDB().chipCatalog, locale, p.visual.parts)}</p>
                      ))}
                      <div className="row-actions">
                        {m.status === "approved" ? (
                          <button className="button secondary small" onClick={() => { reviewReferenceMedia(intake.id, m.id, "hidden"); notify(notice.referenceUpdated); }}>{t.hideRef}</button>
                        ) : (
                          <button className="button primary small" onClick={() => { reviewReferenceMedia(intake.id, m.id, "approved"); notify(notice.referenceUpdated); }}>{t.showRef}</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>

      <details className="ops-admin-details">
        <summary>{stageCopy.groupInternal}</summary>
        <div className="ops-stage-body">
          <CustomerFlowPanel order={order} milestones={milestones} actions={actions} t={t} p={p} locale={locale} onSaved={notify} />
          <InternalControlsPanel order={order} t={t} p={p} locale={locale} onSaved={notify} notice={notice} />
          <div className="panel form-stack">
            <h3>{t.newPr}</h3>
            <PrForm orderId={order.id} suppliers={suppliers} t={t} onSaved={notify} notice={notice} />
            {procurements.map((pr) => (
              <p key={pr.id} className="form-hint">
                {pr.id} · {pr.type} · {suppliers.find((su) => su.id === pr.supplierId)?.name} · {pr.dueDate} · <span className={`status-badge prt-${pr.status}`}>{p.supplierP.status[pr.status]}</span>
                {pr.result && ` · ${prResultSummary(pr)}`}
              </p>
            ))}
          </div>
          <CompactMilestoneSummary milestones={milestones} p={p} locale={locale} />
          <div className="panel">
            <h3>{t.actionsTitle}</h3>
            {actions.length === 0 ? <p className="form-hint">—</p> : actions.map((a) => (
              <p key={a.id} className="form-hint">{a.id} · {a.type} · {a.status}{a.response && ` → ${a.response}`}</p>
            ))}
          </div>
          <div className="panel form-stack">
            <h3>Reviews</h3>
            {listReviews({ orderId: order.id }).length === 0 ? <p className="form-hint">—</p>
              : listReviews({ orderId: order.id }).map((r) => (
                <div key={r.id} className="feedback-note">
                  <strong>{r.id}</strong> · {"★".repeat(r.rating)} · “{r.quote}” · {r.name} · <span className={`status-badge ${r.status === "published" ? "mst-done" : r.status === "pending" ? "mst-inProgress" : "mst-pending"}`}>{r.status}</span>
                  {r.status !== "published" && <button className="button secondary small" style={{ marginLeft: 10 }} onClick={() => { setReviewStatus(r.id, "published"); notify(); }}>Publish</button>}
                  {r.status !== "hidden" && <button className="button secondary small" style={{ marginLeft: 6 }} onClick={() => { setReviewStatus(r.id, "hidden"); notify(); }}>Hide</button>}
                </div>
              ))}
          </div>
          <div className="panel">
            <h3>{t.auditTitle}</h3>
            {auditRows.map((a) => (
              <p key={a.id} className="form-hint">{a.at.slice(5, 16)} · {a.actor} · {a.field}: {String(a.before ?? "∅")} → {String(a.after ?? "∅")}</p>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
