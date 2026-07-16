// 실주문(BD-) 콘솔 — Postgres 주문을 목록/상세로 운영한다.
// 이벤트 버튼 하나 = stage 전이 + (선택) 아티팩트/고객 컨펌 발행 + 상태 메일(고객 언어) 발송.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../../lib/api.js";
import { MediaPicker, MediaThumb, usd } from "../../components/ui.jsx";
import { findCoupon, getOpsStyle, getSettings, isShippingAddressComplete } from "../../lib/store.js";
import { estimateProposalQuote } from "../../lib/proposalEstimate.js";
import { applyCoupon } from "../../lib/coupons.js";
import { pickI18n, useLocale } from "../../i18n.jsx";
import { ConsoleHead, Pager, StatStrip } from "./console.jsx";
import { formatGradeRange, formatCaratRange } from "../../lib/gradeScale.js";

// 견적 컴포저 셀렉트 옵션 · 메탈 코드 → 라벨 (인테이크 프리필용)
const SHAPES = ["round", "oval", "cushion", "princess", "emerald", "pear", "marquise", "radiant", "asscher", "heart"];
const COLORS = ["D", "E", "F", "G", "H", "I"];
const CLARITIES = ["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2"];
const METAL_LABELS = {
  "18kw": "18K White Gold", "18ky": "18K Yellow Gold", "18kr": "18K Rose Gold",
  "14kw": "14K White Gold", "14ky": "14K Yellow Gold", "14kr": "14K Rose Gold",
  pt950: "Platinum 950",
};

const COPY = {
  en: {
    title: "Live orders", kicker: "REAL-SERVER ORDERS",
    liveSection: "Live orders", pastSection: "Past orders", totalCol: "Total",
    emptyPast: "No delivered orders yet — completed orders and revenue land here.",
    statOpen: "Open orders", statRevenue: "Total revenue", statDelivered: "Delivered", statAvg: "Average order", statPipeline: "Pipeline (quoted)",
    empty: "No live orders yet — they appear the moment a customer submits the wizard.",
    needAuth: "This console needs a server admin session. Sign in again through the admin gate.",
    unavailable: "API unreachable — run the local API server or check the deployment.",
    customer: "Customer", stage: "Stage", waiting: "Waiting on", updated: "Updated", category: "Category",
    back: "← Live orders", intake: "Request", budget: "Budget", requiredDate: "Requested date", refNotes: "In their words",
    consultBadge: "Consult", consultOpenBrief: "✦ Open brief — advisor needs to propose styles",
    referenceMedia: "Customer references", console: "Move the order forward",
    consoleHint: "Each step advances the stage and emails the customer in their language.",
    artifacts: "Published to customer", actions: "Customer confirmations", timeline: "Timeline", shippingAddr: "Shipping address",
    note: "Customer note", total: "Total ($)", igi: "IGI No.", tracking: "Tracking no.",
    stoneSpec: "Stone spec", metalSpec: "Metal spec",
    settingSummary: "Setting & design summary", estWeight: "Est. metal weight (g)", leadDays: "Production lead (business days)",
    designNote: "Design adjustment note", centerStone: "Center stone (one component of the piece)",
    shape: "shape", caratMin: "carat (min)", caratMax: "carat (max)", color: "color", clarity: "clarity", growth: "growth", lab: "lab",
    subNote: "Stone substitution note (blank = default policy text)", deposit: "Deposit ($, blank = configured rate)",
    media: "Media (published to the portal)",
    fire: "Send", done: "Done", current: "Current", sentLabel: "Sent ✓",
    resend: "Send revised proposal", changesRequested: "Customer requested changes",
    waitingOn: { CUSTOMER: "Customer", BELOVEDIAMOND: "BeloveD", EXTERNAL: "Carrier", NONE: "—" },
    steps: {
      proposal_sent: "Send the proposal", deposit_confirmed: "Deposit received",
      diamond_locked: "Diamond secured", production_started: "Production started",
      qc_ready: "Send finished-piece QC", balance_requested: "Request the balance",
      balance_confirmed: "Balance received",
      shipped: "Shipped", delivered: "Delivered",
    },
    sent: "Event sent — the customer has been emailed.",
    cancelOrderBtn: "Cancel order", refundNoteLbl: "Refund/payment resolution note", refundNoteRequired: "Document how the reported or confirmed transfer was resolved before cancelling.",
    cancelConfirmBtn: "Confirm cancellation", cancelKeepBtn: "Back",
    cancelRequestedBanner: "Customer requested cancellation",
  },
  ko: {
    title: "실주문", kicker: "실서버 주문",
    liveSection: "진행 중 주문", pastSection: "지난 주문", totalCol: "총액",
    emptyPast: "완료된 주문이 아직 없습니다 — 배송 완료된 주문과 매출이 여기에 쌓입니다.",
    statOpen: "진행 중", statRevenue: "총 매출", statDelivered: "완료 주문", statAvg: "평균 주문액", statPipeline: "견적 파이프라인",
    empty: "아직 실주문이 없습니다 — 고객이 위저드를 제출하면 바로 나타납니다.",
    needAuth: "이 콘솔은 서버 어드민 세션이 필요합니다. 어드민 게이트에서 다시 로그인해 주세요.",
    unavailable: "API에 연결할 수 없습니다 — 로컬 API 서버를 켜거나 배포 상태를 확인하세요.",
    customer: "고객", stage: "단계", waiting: "대기", updated: "업데이트", category: "카테고리",
    back: "← 실주문 목록", intake: "요청 내용", budget: "예산", requiredDate: "희망일", refNotes: "고객 요청 메모",
    consultBadge: "상담", consultOpenBrief: "✦ 오픈 브리프 — 어드바이저 스타일 제안 필요",
    referenceMedia: "고객 레퍼런스", console: "주문 진행",
    consoleHint: "각 단계는 stage를 전이시키고 고객 언어로 상태 메일을 보냅니다.",
    artifacts: "고객에게 발행됨", actions: "고객 컨펌", timeline: "타임라인", shippingAddr: "배송지",
    note: "고객 노트", total: "총액 ($)", igi: "IGI 번호", tracking: "운송장 번호",
    stoneSpec: "스톤 스펙", metalSpec: "메탈 스펙",
    settingSummary: "세팅·디자인 요약", estWeight: "예상 메탈 중량 (g)", leadDays: "제작 기간 (영업일)",
    designNote: "디자인 조정 노트", centerStone: "센터 스톤 (제품 구성 요소)",
    shape: "셰이프", caratMin: "캐럿 (min)", caratMax: "캐럿 (max)", color: "컬러", clarity: "클래리티", growth: "성장", lab: "감정기관",
    subNote: "스톤 대체 안내 (비우면 기본 문구)", deposit: "디파짓 ($, 비우면 설정 비율)",
    media: "미디어 (포털에 공개)",
    fire: "보내기", done: "완료", current: "현재", sentLabel: "보냄 ✓",
    resend: "수정 제안 보내기", changesRequested: "고객이 수정을 요청했습니다",
    waitingOn: { CUSTOMER: "고객", BELOVEDIAMOND: "BeloveD", EXTERNAL: "운송사", NONE: "—" },
    steps: {
      proposal_sent: "제안 발송", deposit_confirmed: "디파짓 수령",
      diamond_locked: "다이아 확보", production_started: "제작 시작",
      qc_ready: "완성품 QC 발송", balance_requested: "잔금 요청",
      balance_confirmed: "잔금 수령",
      shipped: "발송됨", delivered: "수령 완료",
    },
    sent: "이벤트가 반영됐습니다 — 고객에게 메일이 발송됩니다.",
    cancelOrderBtn: "주문 취소", refundNoteLbl: "환불·송금 처리 기록", refundNoteRequired: "취소 전에 보고되거나 확인된 송금을 어떻게 처리했는지 기록해 주세요.",
    cancelConfirmBtn: "취소 확정", cancelKeepBtn: "뒤로",
    cancelRequestedBanner: "고객이 취소를 요청했습니다",
  },
  zh: {
    title: "实时订单", kicker: "真实服务器订单",
    liveSection: "进行中订单", pastSection: "历史订单", totalCol: "总价",
    emptyPast: "暂无已完成订单 — 已交付订单与收入将显示在这里。",
    statOpen: "进行中", statRevenue: "总收入", statDelivered: "已完成", statAvg: "平均订单额", statPipeline: "报价管道",
    empty: "暂无实时订单 — 客户提交向导后会立即出现。",
    needAuth: "此控制台需要服务器管理员会话，请通过管理入口重新登录。",
    unavailable: "无法连接 API — 请启动本地 API 服务器或检查部署。",
    customer: "客户", stage: "阶段", waiting: "等待方", updated: "更新", category: "类别",
    back: "← 实时订单", intake: "请求内容", budget: "预算", requiredDate: "期望日期", refNotes: "客户留言",
    consultBadge: "咨询", consultOpenBrief: "✦ 开放式需求 — 需顾问提案款式",
    referenceMedia: "客户参考图", console: "推进订单",
    consoleHint: "每一步都会推进阶段，并以客户语言发送状态邮件。",
    artifacts: "已向客户发布", actions: "客户确认", timeline: "时间线", shippingAddr: "收货地址",
    note: "客户备注", total: "总价 ($)", igi: "IGI 编号", tracking: "运单号",
    stoneSpec: "钻石规格", metalSpec: "金属规格",
    settingSummary: "镶嵌·设计摘要", estWeight: "预估金属重量 (g)", leadDays: "制作周期（工作日）",
    designNote: "设计调整备注", centerStone: "中心钻石（作品部件之一）",
    shape: "形状", caratMin: "克拉 (min)", caratMax: "克拉 (max)", color: "颜色", clarity: "净度", growth: "生长方式", lab: "鉴定机构",
    subNote: "替代说明（留空用默认文案）", deposit: "定金（$，留空按已配置比例）",
    media: "媒体（发布到订单页面）",
    fire: "发送", done: "完成", current: "当前", sentLabel: "已发送 ✓",
    resend: "发送修改后的方案", changesRequested: "客户请求修改",
    waitingOn: { CUSTOMER: "客户", BELOVEDIAMOND: "BeloveD", EXTERNAL: "承运商", NONE: "—" },
    steps: {
      proposal_sent: "发送方案", deposit_confirmed: "已收定金",
      diamond_locked: "钻石已锁定", production_started: "开始制作",
      qc_ready: "发送成品质检", balance_requested: "请求尾款",
      balance_confirmed: "已收尾款",
      shipped: "已发货", delivered: "已送达",
    },
    sent: "事件已生效 — 已向客户发送邮件。",
    cancelOrderBtn: "取消订单", refundNoteLbl: "退款／转账处理记录", refundNoteRequired: "取消前请记录已报告或已确认转账的处理结果。",
    cancelConfirmBtn: "确认取消", cancelKeepBtn: "返回",
    cancelRequestedBanner: "客户已申请取消",
  },
  es: {
    title: "Pedidos en vivo", kicker: "PEDIDOS DEL SERVIDOR",
    liveSection: "Pedidos activos", pastSection: "Pedidos pasados", totalCol: "Total",
    emptyPast: "Aún no hay pedidos entregados — los completados y los ingresos aparecerán aquí.",
    statOpen: "Activos", statRevenue: "Ingresos totales", statDelivered: "Entregados", statAvg: "Pedido promedio", statPipeline: "Pipeline (cotizado)",
    empty: "Aún no hay pedidos en vivo — aparecen cuando un cliente envía el asistente.",
    needAuth: "Esta consola requiere sesión de administrador del servidor. Inicia sesión de nuevo por la puerta admin.",
    unavailable: "API inalcanzable — inicia el servidor local o revisa el despliegue.",
    customer: "Cliente", stage: "Etapa", waiting: "Esperando a", updated: "Actualizado", category: "Categoría",
    back: "← Pedidos en vivo", intake: "Solicitud", budget: "Presupuesto", requiredDate: "Fecha deseada", refNotes: "En sus palabras",
    consultBadge: "Consulta", consultOpenBrief: "✦ Brief abierto — el asesor debe proponer estilos",
    referenceMedia: "Referencias del cliente", console: "Avanzar el pedido",
    consoleHint: "Cada paso avanza la etapa y envía un correo al cliente en su idioma.",
    artifacts: "Publicado al cliente", actions: "Confirmaciones del cliente", timeline: "Cronología", shippingAddr: "Dirección de envío",
    note: "Nota al cliente", total: "Total ($)", igi: "N.º IGI", tracking: "N.º de guía",
    stoneSpec: "Especif. de piedra", metalSpec: "Especif. de metal",
    settingSummary: "Resumen de engaste y diseño", estWeight: "Peso est. del metal (g)", leadDays: "Plazo de producción (días hábiles)",
    designNote: "Nota de ajuste de diseño", centerStone: "Piedra central (componente de la pieza)",
    shape: "forma", caratMin: "quilates (min)", caratMax: "quilates (max)", color: "color", clarity: "claridad", growth: "crecimiento", lab: "laboratorio",
    subNote: "Nota de sustitución (vacío = texto por defecto)", deposit: "Depósito ($, vacío = porcentaje configurado)",
    media: "Medios (publicados al portal)",
    fire: "Enviar", done: "Hecho", current: "Actual", sentLabel: "Enviado ✓",
    resend: "Enviar propuesta revisada", changesRequested: "El cliente pidió cambios",
    waitingOn: { CUSTOMER: "Cliente", BELOVEDIAMOND: "BeloveD", EXTERNAL: "Transportista", NONE: "—" },
    steps: {
      proposal_sent: "Enviar la propuesta", deposit_confirmed: "Depósito recibido",
      diamond_locked: "Diamante asegurado", production_started: "Producción iniciada",
      qc_ready: "Enviar QC de la pieza", balance_requested: "Solicitar el saldo",
      balance_confirmed: "Saldo recibido",
      shipped: "Enviado", delivered: "Entregado",
    },
    sent: "Evento aplicado — se envió el correo al cliente.",
    cancelOrderBtn: "Cancelar pedido", refundNoteLbl: "Registro de resolución del reembolso o transferencia", refundNoteRequired: "Documenta cómo se resolvió la transferencia reportada o confirmada antes de cancelar.",
    cancelConfirmBtn: "Confirmar cancelación", cancelKeepBtn: "Atrás",
    cancelRequestedBanner: "El cliente solicitó la cancelación",
  },
};

const FLOW_GUARD_COPY = {
  en: {
    blockedPrevious: "Complete the preceding step first.",
    waitQuoteApproval: "Waiting for the customer to approve the latest proposal.",
    waitDepositReport: "Waiting for the customer to report the deposit transfer.",
    waitQcApproval: "Waiting for the customer to confirm the finished piece.",
    waitBalanceReport: "Waiting for the customer to report the balance transfer.",
    addressRequired: "A complete saved shipping address is required before shipping.",
    totalRequired: "Enter a proposal total greater than $0.",
    depositInvalid: "Deposit must be greater than $0 and no more than the proposal total.",
    estLabel: "Auto estimate", estApply: "Use estimate", estDiamond: "diamond", estMetal: "metal", estLabor: "labor",
    depositAuto: (pct, amt) => `Leave blank → ${pct}% deposit (${amt})`,
    couponLabel: "Coupon", couponListLabel: "List", couponFinalLabel: "Customer pays",
    igiRequired: "Enter the certificate number before securing the diamond.",
    qcRequired: "Upload at least one finished-piece photo or video before sending QC.",
    uploadBusy: "Wait for every upload to finish before sending.",
    trackingRequired: "Enter a tracking number before marking the order shipped.",
    confirmFire: (action) => `${action}? This updates the order and emails the customer.`,
    working: "Updating…", cancelFailed: "Cancellation failed. The note is still here — please try again.",
    refreshFailed: "The event was accepted, but this page could not refresh. Reload before taking another action.",
    cta: {
      proposal_sent: "Send proposal to customer", deposit_confirmed: "Confirm deposit received",
      diamond_locked: "Confirm diamond secured", production_started: "Start production",
      qc_ready: "Send finished-piece QC", balance_requested: "Request balance payment",
      balance_confirmed: "Confirm balance received", shipped: "Confirm shipment and email tracking",
      delivered: "Mark order delivered",
    },
  },
  ko: {
    blockedPrevious: "먼저 이전 단계를 완료해 주세요.",
    waitQuoteApproval: "고객의 최신 제안 승인을 기다리고 있습니다.",
    waitDepositReport: "고객의 디파짓 송금 보고를 기다리고 있습니다.",
    waitQcApproval: "고객의 완성품 컨펌을 기다리고 있습니다.",
    waitBalanceReport: "고객의 잔금 송금 보고를 기다리고 있습니다.",
    addressRequired: "발송 전에 저장된 전체 배송지가 필요합니다.",
    totalRequired: "$0보다 큰 제안 총액을 입력해 주세요.",
    depositInvalid: "디파짓은 $0보다 크고 제안 총액 이하여야 합니다.",
    estLabel: "자동 추정가", estApply: "추정가 적용", estDiamond: "다이아", estMetal: "메탈", estLabor: "공임",
    depositAuto: (pct, amt) => `비우면 자동 ${pct}% (${amt})`,
    couponLabel: "쿠폰", couponListLabel: "정가", couponFinalLabel: "고객 결제가",
    igiRequired: "다이아 확보 전에 감정서 번호를 입력해 주세요.",
    qcRequired: "QC를 보내기 전에 완성품 사진이나 영상을 하나 이상 업로드해 주세요.",
    uploadBusy: "모든 업로드가 끝난 뒤 보내주세요.",
    trackingRequired: "발송 처리 전에 운송장 번호를 입력해 주세요.",
    confirmFire: (action) => `${action}할까요? 주문이 변경되고 고객에게 이메일이 발송됩니다.`,
    working: "반영 중…", cancelFailed: "주문 취소에 실패했습니다. 안내 문구는 그대로 있으니 다시 시도해 주세요.",
    refreshFailed: "이벤트는 반영됐지만 화면을 새로 불러오지 못했습니다. 다른 작업 전에 페이지를 새로고침해 주세요.",
    cta: {
      proposal_sent: "고객에게 제안 발송", deposit_confirmed: "디파짓 수령 확정",
      diamond_locked: "다이아 확보 확정", production_started: "제작 시작",
      qc_ready: "완성품 QC 발송", balance_requested: "잔금 결제 요청",
      balance_confirmed: "잔금 수령 확정", shipped: "발송 확정 및 운송장 안내",
      delivered: "배송 완료 처리",
    },
  },
  zh: {
    blockedPrevious: "请先完成上一步。", waitQuoteApproval: "正在等待客户批准最新方案。",
    waitDepositReport: "正在等待客户报告定金转账。", waitQcApproval: "正在等待客户确认成品。",
    waitBalanceReport: "正在等待客户报告尾款转账。", addressRequired: "发货前需要完整且已保存的收货地址。",
    totalRequired: "请输入大于 $0 的方案总价。", depositInvalid: "定金必须大于 $0 且不超过方案总价。",
    estLabel: "自动预估", estApply: "应用预估", estDiamond: "钻石", estMetal: "金属", estLabor: "工费",
    depositAuto: (pct, amt) => `留空 → ${pct}% 定金（${amt}）`,
    couponLabel: "优惠券", couponListLabel: "原价", couponFinalLabel: "客户支付",
    igiRequired: "锁定钻石前请输入证书编号。", qcRequired: "发送质检前请至少上传一张成品照片或视频。",
    uploadBusy: "请等待所有上传完成后再发送。", trackingRequired: "标记发货前请输入运单号。",
    confirmFire: (action) => `确认${action}？订单将更新并向客户发送邮件。`,
    working: "更新中…", cancelFailed: "取消失败。说明仍保留，请重试。",
    refreshFailed: "事件已提交，但页面无法刷新。请先重新加载页面再继续操作。",
    cta: {
      proposal_sent: "向客户发送方案", deposit_confirmed: "确认已收定金", diamond_locked: "确认钻石已锁定",
      production_started: "开始制作", qc_ready: "发送成品质检", balance_requested: "请求支付尾款",
      balance_confirmed: "确认已收尾款", shipped: "确认发货并发送运单", delivered: "标记为已送达",
    },
  },
  es: {
    blockedPrevious: "Completa primero el paso anterior.", waitQuoteApproval: "Esperando la aprobación de la última propuesta.",
    waitDepositReport: "Esperando que el cliente reporte el depósito.", waitQcApproval: "Esperando que el cliente confirme la pieza terminada.",
    waitBalanceReport: "Esperando que el cliente reporte el saldo.", addressRequired: "Se requiere una dirección completa y guardada antes del envío.",
    totalRequired: "Introduce un total de propuesta mayor que $0.", depositInvalid: "El depósito debe ser mayor que $0 y no superar el total.",
    estLabel: "Estimación automática", estApply: "Usar estimación", estDiamond: "diamante", estMetal: "metal", estLabor: "mano de obra",
    depositAuto: (pct, amt) => `Vacío → depósito del ${pct}% (${amt})`,
    couponLabel: "Cupón", couponListLabel: "Precio", couponFinalLabel: "Cliente paga",
    igiRequired: "Introduce el certificado antes de asegurar el diamante.", qcRequired: "Sube al menos una foto o video de la pieza antes de enviar el control.",
    uploadBusy: "Espera a que terminen todas las cargas.", trackingRequired: "Introduce el número de guía antes de marcar el envío.",
    confirmFire: (action) => `¿${action}? Esto actualizará el pedido y enviará un correo al cliente.`,
    working: "Actualizando…", cancelFailed: "No se pudo cancelar. La nota sigue aquí; inténtalo de nuevo.",
    refreshFailed: "El evento se aceptó, pero la página no pudo actualizarse. Recarga antes de continuar.",
    cta: {
      proposal_sent: "Enviar propuesta al cliente", deposit_confirmed: "Confirmar depósito recibido",
      diamond_locked: "Confirmar diamante asegurado", production_started: "Iniciar producción",
      qc_ready: "Enviar control de pieza terminada", balance_requested: "Solicitar pago del saldo",
      balance_confirmed: "Confirmar saldo recibido", shipped: "Confirmar envío y enviar guía", delivered: "Marcar como entregado",
    },
  },
};

// 스테이지 순서 — 각 이벤트가 도달시키는 stage (완료/현재 표시용)
const FLOW = [
  { type: "proposal_sent", num: "1-1", reaches: "QUOTE", media: "proposal", artifactType: "QUOTE", composer: "proposal", fields: ["note", "total"], action: { kind: "QUOTE_ACCEPTANCE", allowedResponses: ["APPROVE", "REQUEST_CHANGES"] } },
  { type: "deposit_confirmed", num: "1-2", reaches: "CAD" },
  { type: "diamond_locked", num: "2-1", reaches: "CAD", fields: ["igi"] },
  { type: "production_started", num: "2-2", reaches: "PRODUCTION" },
  { type: "qc_ready", num: "2-3", reaches: "FINAL_QC", media: "qc", artifactType: "QC", fields: ["note"], action: { kind: "FINAL_QC_CONFIRMATION", allowedResponses: ["CONFIRM", "REQUEST_CHANGES"] } },
  { type: "balance_requested", num: "3-1", reaches: "BALANCE" },
  { type: "balance_confirmed", num: "3-2", reaches: "BALANCE" },
  { type: "shipped", num: "3-3", reaches: "SHIPPING", fields: ["tracking"] },
  { type: "delivered", num: "3-4", reaches: "DELIVERED" },
];
const STAGE_ORDER = ["OPS_REVIEW", "STONE_SELECTION", "QUOTE", "DEPOSIT", "CAD", "PRODUCTION", "FINAL_QC", "BALANCE", "SHIPPING", "DELIVERED"];

function useCopy() {
  const { locale } = useLocale();
  return { ...(COPY[locale] || COPY.en), ...(FLOW_GUARD_COPY[locale] || FLOW_GUARD_COPY.en) };
}

function eventType(event) {
  return event?.payload?.type || event?.title || "";
}

function latestActionResponse(actions, kind) {
  const latest = (actions || [])
    .filter((action) => action.kind === kind && action.status === "RESPONDED")
    .sort((a, b) => new Date(b.respondedAt || 0) - new Date(a.respondedAt || 0))[0];
  return latest?.responsePayload?.response || latest?.response || "";
}

function hasPaymentReport(timeline, kind) {
  return (timeline || []).some((event) => eventType(event) === "payment_reported"
    && (event.payload?.data?.kind || "deposit") === kind);
}

export function adminStepGuard({ step, index, order, timeline, actions, changeRequest, t }) {
  if (changeRequest) return { available: true, reason: "" };
  const fired = new Set((timeline || []).map(eventType));
  if (FLOW.slice(0, index).some((previous) => !fired.has(previous.type))) {
    return { available: false, reason: t.blockedPrevious };
  }
  if (step.type === "deposit_confirmed") {
    if (latestActionResponse(actions, "QUOTE_ACCEPTANCE") !== "APPROVE") {
      return { available: false, reason: t.waitQuoteApproval };
    }
    if (!hasPaymentReport(timeline, "deposit")) return { available: false, reason: t.waitDepositReport };
  }
  if (step.type === "balance_requested" && latestActionResponse(actions, "FINAL_QC_CONFIRMATION") !== "CONFIRM") {
    return { available: false, reason: t.waitQcApproval };
  }
  if (step.type === "balance_confirmed" && !hasPaymentReport(timeline, "balance")) {
    return { available: false, reason: t.waitBalanceReport };
  }
  if (step.type === "shipped" && !isShippingAddressComplete(order.summary?.shippingAddress)) {
    return { available: false, reason: t.addressRequired };
  }
  return { available: true, reason: "" };
}

function ErrorPanel({ error, t }) {
  return <div className="panel"><p className="form-hint">{error === "auth" ? t.needAuth : t.unavailable}</p></div>;
}

// 완료 상태 — Past Orders 섹션으로 분류되는 stage
const PAST_STAGES = new Set(["DELIVERED", "CANCELLED"]);
const PAGE_SIZE = 10;

function OrdersTable({ orders, t, navigate, withTotal = false }) {
  return (
    <div className="con-table-panel admin-live-orders-table">
      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th><th>{t.customer}</th><th>{t.category}</th><th>{t.stage}</th>
            {withTotal ? <th>{t.totalCol}</th> : <th>{t.waiting}</th>}
            <th>{t.updated}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.orderCode}
              className="row-clickable"
              onClick={() => navigate(`/bo-4q9z7m/live/${o.orderCode}`)}
            >
              <td><Link className="text-link con-code" to={`/bo-4q9z7m/live/${o.orderCode}`} onClick={(e) => e.stopPropagation()}><strong>{o.orderCode}</strong></Link></td>
              <td>{o.customerName || o.customerEmail}<br /><span className="form-hint">{o.customerEmail} · {o.locale}</span></td>
              <td>
                {o.intake?.category || o.summary?.category || "—"}
                {/* 오픈 브리프 = 스타일 미정 상담 주문 — 목록에서 바로 골라낼 수 있게 */}
                {!(o.intake?.styleCode || o.intake?.formPayload?.styleId) && (
                  <span style={{ color: "var(--accent-bright)", marginLeft: 6, whiteSpace: "nowrap" }}>✦ {t.consultBadge}</span>
                )}
              </td>
              <td><span className={`status-badge ${o.stage === "DELIVERED" ? "mst-done" : "mst-inProgress"}`}>{o.stage}</span></td>
              {withTotal
                ? <td>{o.totalUsd ? usd(o.totalUsd) : "—"}</td>
                : <td>{t.waitingOn[o.waitingOn] || o.waitingOn}</td>}
              <td>{new Date(o.updatedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminLiveOrders() {
  const t = useCopy();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", data: null });
  const [livePage, setLivePage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const data = await apiFetch("/admin/orders?limit=500");
      if (sequence !== loadSequence.current) return false;
      setState({ status: "ok", data: data.orders });
      return true;
    } catch (error) {
      if (sequence !== loadSequence.current) return false;
      setState((current) => (
        error?.status === 401 || error?.status === 403
          ? { status: "auth", data: null }
          : current.status === "ok"
            ? current
            : { status: error instanceof ApiUnavailableError ? "unavailable" : "auth", data: null }
      ));
      return false;
    }
  }, []);

  useEffect(() => {
    // 매출/파이프라인 스탯이 이 목록으로 계산되므로 서버 캡(500)까지 다 받아온다 — 표시는 10개씩 페이징
    load();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const interval = window.setInterval(refreshVisible, 15000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      loadSequence.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [load]);

  if (state.status === "loading") return <div className="panel"><p className="form-hint">…</p></div>;
  if (state.status !== "ok") return <ErrorPanel error={state.status} t={t} />;

  const live = state.data.filter((o) => !PAST_STAGES.has(o.stage));
  const past = state.data.filter((o) => PAST_STAGES.has(o.stage));
  // 데이터가 줄어 현재 페이지가 범위를 벗어나면 마지막 페이지로 클램프
  const livePages = Math.max(1, Math.ceil(live.length / PAGE_SIZE));
  const pastPages = Math.max(1, Math.ceil(past.length / PAGE_SIZE));
  const livePageNow = Math.min(livePage, livePages);
  const pastPageNow = Math.min(pastPage, pastPages);
  const delivered = past.filter((o) => o.stage === "DELIVERED");
  const revenue = delivered.reduce((s, o) => s + (o.totalUsd || 0), 0);
  const pipeline = live.reduce((s, o) => s + (o.totalUsd || 0), 0);

  return (
    <>
      <ConsoleHead kicker={t.kicker} title={t.title} />
      <StatStrip
        stats={[
          { value: live.length, label: t.statOpen },
          { value: usd(pipeline), label: t.statPipeline },
          { value: usd(revenue), label: t.statRevenue },
          { value: delivered.length, label: t.statDelivered },
          { value: delivered.length ? usd(revenue / delivered.length) : "—", label: t.statAvg },
        ]}
      />

      <div className="con-section-label"><h3>{t.liveSection}</h3><span className="con-count">{live.length}</span></div>
      {live.length === 0
        ? <div className="con-table-panel"><p className="con-note">{t.empty}</p></div>
        : (
          <>
            <OrdersTable orders={live.slice((livePageNow - 1) * PAGE_SIZE, livePageNow * PAGE_SIZE)} t={t} navigate={navigate} />
            <Pager page={livePageNow} pageCount={livePages} onPage={setLivePage} />
          </>
        )}

      <div className="con-section-label"><h3>{t.pastSection}</h3><span className="con-count">{past.length}</span></div>
      {past.length === 0
        ? <div className="con-table-panel"><p className="con-note">{t.emptyPast}</p></div>
        : (
          <>
            <OrdersTable orders={past.slice((pastPageNow - 1) * PAGE_SIZE, pastPageNow * PAGE_SIZE)} t={t} navigate={navigate} withTotal />
            <Pager page={pastPageNow} pageCount={pastPages} onPage={setPastPage} />
          </>
        )}
    </>
  );
}

// 이벤트 스텝 카드 — 필요한 입력(미디어/노트/금액/IGI/운송장)만 노출
function StepCard({ step, index, order, done, changeRequest, expanded, onToggle, t, onSent, available, blockedReason }) {
  const [media, setMedia] = useState([]);
  // 견적 컴포저는 인테이크에서 프리필 — 어드민은 확인·수정만 하고 보낸다
  const fp = order.intake?.formPayload || {};
  const sp = fp.stonePrefs || {};
  const style = fp.styleId ? getOpsStyle(fp.styleId) : null;
  const [f, setF] = useState({
    note: "", total: "", igi: "", tracking: "",
    setting: [
      style ? pickI18n(style.name, "en") : (order.intake?.category || ""),
      fp.conditional?.ringSize,
    ].filter(Boolean).join(" · "),
    designNote: "",
    metalSpec: METAL_LABELS[fp.metal] || fp.metal || "18K White Gold",
    estWeightG: "", leadDays: "10",
    shape: sp.shape || "round",
    caratMin: sp.caratRange?.[0] != null ? String(sp.caratRange[0]) : (sp.carat ? String(sp.carat) : ""),
    caratMax: sp.caratRange?.[1] != null ? String(sp.caratRange[1]) : (sp.carat ? (Number(sp.carat) + 0.05).toFixed(2) : ""),
    color: sp.colorRange?.[0] || sp.color || "D", clarity: sp.clarityRange?.[0] || sp.clarity || "VS1", growth: sp.growth || "CVD",
    lab: "IGI", igiNo: "", subNote: "", deposit: "",
  });
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const [couponApplied, setCouponApplied] = useState(true);
  // 워크숍 가격 엔진으로 Total/Deposit 자동 추정 — 폼 필드가 바뀌면 즉시 다시 계산한다(발송 전 추정치)
  const category = order.intake?.category;
  const estimate = useMemo(() => (
    step.composer === "proposal"
      ? estimateProposalQuote({
        metalSpec: f.metalSpec, estWeightG: f.estWeightG,
        shape: f.shape, caratMin: f.caratMin, caratMax: f.caratMax,
        color: f.color, clarity: f.clarity, growth: f.growth, lab: f.lab,
        styleId: fp.styleId, category,
      })
      : null
  ), [step.composer, f.metalSpec, f.estWeightG, f.shape, f.caratMin, f.caratMax, f.color, f.clarity, f.growth, f.lab, fp.styleId, category]);
  // 총액이 비어 있으면(어드민 미입력) 추정가로 1회 프리필 — 이후엔 어드민 편집/‘적용’ 버튼만 반영
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!prefilledRef.current && estimate && f.total === "") {
      prefilledRef.current = true;
      setF((prev) => ({ ...prev, total: String(estimate.totalUsd) }));
    }
  }, [estimate, f.total]);
  const depositRate = getSettings()?.opsDepositRate ?? 0.3;
  // 쿠폰 — 인테이크에서 고객이 넣은 코드(있으면). 오퍼레이터가 확정 제안에서 검증(적용/해제).
  // Total 칸 = 정가(list). 쿠폰 적용 시 고객 결제가 = 정가 − 할인.
  const coupon = step.composer === "proposal" ? findCoupon(fp.couponCode) : null;
  const multiplier = getSettings()?.opsMultiplier ?? 1.8;
  const listValue = Number(f.total) || 0;
  const couponResult = coupon && couponApplied && listValue > 0
    ? applyCoupon({ totalUsd: listValue, diamondAmountUsd: estimate?.diamondUsd || 0, multiplier }, coupon)
    : null;
  const finalUsd = couponResult ? couponResult.totalUsd : listValue; // 고객이 실제 결제하는 금액
  const discountUsd = couponResult ? couponResult.discountUsd : 0;
  // 한 번 보낸 스텝은 잠근다 — 중복 발송(중복 메일·중복 컨펌)이 재발송 필요보다 훨씬 흔한 사고다.
  // done은 stage가 아니라 "이 이벤트가 실제 발사됐는가"(타임라인) 기준 — 같은 stage에 도달하는
  // 스텝들(디파짓/다이아 둘 다 CAD)이 한꺼번에 체크되는 오판 방지.
  // 고객이 수정을 요청한 상태(changeRequest)면 다시 열어 수정본을 보낼 수 있다.
  const unlocked = done && Boolean(changeRequest);
  const remoteMedia = media.filter((item) => /^https?:\/\//.test(item.src || "")).slice(0, 5);
  const totalValue = Number(f.total);
  const depositValue = f.deposit === "" ? null : Number(f.deposit);
  const validationMessage = !available ? blockedReason
    : uploadError ? uploadError
    : step.composer === "proposal" && !(totalValue > 0) ? t.totalRequired
      : step.composer === "proposal" && depositValue !== null && (!(depositValue > 0) || depositValue > finalUsd) ? t.depositInvalid
        : step.fields?.includes("igi") && !f.igi.trim() ? t.igiRequired
          : step.type === "qc_ready" && uploadBusy ? t.uploadBusy
            : step.type === "qc_ready" && remoteMedia.length === 0 ? t.qcRequired
              : step.fields?.includes("tracking") && !f.tracking.trim() ? t.trackingRequired
                : "";
  const cta = unlocked ? t.resend : (t.cta[step.type] || t.steps[step.type]);

  async function fire() {
    if (busy || validationMessage) return;
    if (!window.confirm(t.confirmFire(cta))) return;
    setBusy(true);
    setError("");
    try {
      const body = { type: step.type, data: {} };
      if (step.fields?.includes("igi") && f.igi.trim()) body.data.igi = f.igi.trim();
      if (step.fields?.includes("tracking") && f.tracking.trim()) body.data.tracking = f.tracking.trim();
      if (step.artifactType) {
        body.artifact = {
          type: step.artifactType,
          media: remoteMedia,
          payload: step.composer === "proposal"
            ? {
              ...(f.setting.trim() ? { settingSummary: f.setting.trim() } : {}),
              ...(f.designNote.trim() ? { designNote: f.designNote.trim() } : {}),
              ...(f.metalSpec.trim() ? { metalSpec: f.metalSpec.trim() } : {}),
              ...(f.estWeightG ? { estWeightG: Number(f.estWeightG) } : {}),
              ...(f.leadDays ? { leadDays: Number(f.leadDays) } : {}),
              stone: {
                shape: f.shape, color: f.color, clarity: f.clarity, growth: f.growth, lab: f.lab,
                ...(f.caratMin ? { caratMin: Number(f.caratMin) } : {}),
                ...(f.caratMax ? { caratMax: Number(f.caratMax) } : {}),
                ...(f.igiNo.trim() ? { igiNo: f.igiNo.trim() } : {}),
              },
              ...(f.subNote.trim() ? { substitutionNote: f.subNote.trim() } : {}),
              ...(f.note.trim() ? { note: f.note.trim() } : {}),
              // totalUsd = 고객 결제가(쿠폰 적용 후). 쿠폰이 걸리면 원가·할인을 함께 실어 고객 포털에서 분해 표시.
              totalUsd: finalUsd,
              ...(discountUsd > 0 ? { listUsd: listValue, coupon: { code: coupon.code, discountUsd } } : {}),
              ...(depositValue !== null ? { depositUsd: depositValue } : {}),
            }
            : {
              ...(f.note.trim() ? { note: f.note.trim() } : {}),
              ...(f.total ? { totalUsd: Number(f.total) } : {}),
            },
        };
      }
      if (step.action) {
        body.action = { ...step.action, title: t.steps[step.type] };
      }
      await apiFetch(`/admin/orders/${order.orderCode}/events`, { method: "POST", body });
      const refreshed = await onSent();
      if (!refreshed) {
        setError(t.refreshFailed);
        return;
      }
      setBusy(false);
    } catch (e) {
      setError(e.code || e.message);
      setBusy(false);
    }
  }

  const open = Boolean(expanded) || unlocked;
  const sectionState = done && !unlocked ? "done" : open ? "active" : "upcoming";
  const bodyId = `admin-step-${step.type}`;
  return (
    <section className={`panel checkpoint client-stage-section ${sectionState}`}>
      <button
        className="client-stage-head admin-step-toggle"
        type="button"
        onClick={done && !unlocked ? undefined : onToggle}
        disabled={done && !unlocked}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="client-stage-number">{done && !unlocked ? "✓" : step.num}</span>
        <span className="admin-step-title">{t.steps[step.type]}</span>
        {unlocked
          ? <span className="status-badge mst-waitingClient">{t.changesRequested}</span>
          : done
            ? <span className="status-badge mst-done">{t.sentLabel}</span>
            : open
              ? <span className="status-badge mst-inProgress">{t.current}</span>
              : <span className="status-badge mst-pending">{step.reaches}</span>}
      </button>
      {open && (
        <div className="form-stack" style={{ marginTop: 14 }} id={bodyId}>
          {!available && blockedReason && <p className="admin-step-blocked" role="status">{blockedReason}</p>}
          {changeRequest && (
            <div className="feedback-note" style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 12 }}>
              <strong>{t.changesRequested}</strong>
              {changeRequest.responsePayload?.message && (
                <p style={{ margin: "4px 0 0" }}>“{changeRequest.responsePayload.message}”</p>
              )}
              {changeRequest.responsePayload?.media?.length > 0 && (
                <div className="card-grid cols-3" style={{ marginTop: 8 }}>
                  {changeRequest.responsePayload.media.map((m, i) => <MediaThumb key={i} media={m} alt="" ratio="1 / 1" />)}
                </div>
              )}
              {changeRequest.respondedAt && (
                <p className="form-hint" style={{ margin: "4px 0 0" }}>{new Date(changeRequest.respondedAt).toLocaleString()}</p>
              )}
            </div>
          )}
          {step.media && (
            <div className="field"><span>{t.media}</span>
              <MediaPicker
                value={media}
                onChange={setMedia}
                onBusyChange={setUploadBusy}
                onErrorChange={setUploadError}
                maxItems={5}
                showSamples={false}
                previewMode="list"
                scope={step.media}
                remoteRequired
              />
            </div>
          )}
          {step.composer === "proposal" && (
            <>
              <div className="filter-grid admin-proposal-top-grid">
                <label className="field"><span>{t.settingSummary}</span>
                  <input value={f.setting} onChange={(e) => setF({ ...f, setting: e.target.value })} /></label>
                <label className="field"><span>{t.estWeight}</span>
                  <input type="number" step="0.1" value={f.estWeightG} onChange={(e) => setF({ ...f, estWeightG: e.target.value })} /></label>
                <label className="field"><span>{t.leadDays}</span>
                  <input type="number" value={f.leadDays} onChange={(e) => setF({ ...f, leadDays: e.target.value })} /></label>
              </div>
              <label className="field"><span>{t.designNote}</span>
                <input value={f.designNote} onChange={(e) => setF({ ...f, designNote: e.target.value })} /></label>
              <label className="field"><span>{t.metalSpec}</span>
                <select value={f.metalSpec} onChange={(e) => setF({ ...f, metalSpec: e.target.value })}>
                  {f.metalSpec && !Object.values(METAL_LABELS).includes(f.metalSpec) && (
                    <option value={f.metalSpec}>{f.metalSpec}</option>
                  )}
                  {Object.values(METAL_LABELS).map((v) => <option key={v} value={v}>{v}</option>)}
                </select></label>
              <p className="form-hint" style={{ margin: 0 }}>{t.centerStone}</p>
              <div className="filter-grid admin-proposal-stone-grid">
                <label className="field"><span>{t.shape}</span>
                  <select value={f.shape} onChange={(e) => setF({ ...f, shape: e.target.value })}>
                    {SHAPES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select></label>
                <label className="field"><span>{t.caratMin}</span>
                  <input type="number" min="0.01" step="0.01" value={f.caratMin} onChange={(e) => setF({ ...f, caratMin: e.target.value })} /></label>
                <label className="field"><span>{t.caratMax}</span>
                  <input type="number" min="0.01" step="0.01" value={f.caratMax} onChange={(e) => setF({ ...f, caratMax: e.target.value })} /></label>
                <label className="field"><span>{t.color}</span>
                  <select value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}>
                    {COLORS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select></label>
              </div>
              <div className="filter-grid admin-proposal-stone-grid">
                <label className="field"><span>{t.clarity}</span>
                  <select value={f.clarity} onChange={(e) => setF({ ...f, clarity: e.target.value })}>
                    {CLARITIES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select></label>
                <label className="field"><span>{t.growth}</span>
                  <select value={f.growth} onChange={(e) => setF({ ...f, growth: e.target.value })}>
                    <option value="CVD">CVD</option><option value="HPHT">HPHT</option>
                  </select></label>
                <label className="field"><span>{t.lab}</span>
                  <select value={f.lab} onChange={(e) => setF({ ...f, lab: e.target.value })}>
                    <option value="IGI">IGI</option><option value="GIA">GIA</option>
                  </select></label>
                <label className="field"><span>{t.igi}</span>
                  <input value={f.igiNo} onChange={(e) => setF({ ...f, igiNo: e.target.value })} autoComplete="off" /></label>
              </div>
              <label className="field"><span>{t.subNote}</span>
                <textarea rows={2} value={f.subNote} onChange={(e) => setF({ ...f, subNote: e.target.value })} /></label>
            </>
          )}
          {step.fields?.includes("note") && (
            <label className="field"><span>{t.note}</span>
              <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          )}
          {step.composer === "proposal" && estimate && (
            <div className="quote-estimate">
              <div className="quote-estimate-row">
                <span className="quote-estimate-tag">{t.estLabel}</span>
                <strong className="quote-estimate-total">{usd(estimate.totalUsd)}</strong>
                {coupon && <span className="quote-estimate-listtag">{t.couponListLabel}</span>}
                <button
                  type="button"
                  className="quote-estimate-apply"
                  onClick={() => setF({ ...f, total: String(estimate.totalUsd) })}
                  disabled={Number(f.total) === estimate.totalUsd}
                >
                  {t.estApply}
                </button>
              </div>
              <p className="quote-estimate-breakdown">
                {t.estDiamond} {usd(estimate.diamondUsd)} · {t.estMetal} {usd(estimate.metalUsd)} · {t.estLabor} {usd(estimate.laborUsd)}
              </p>
            </div>
          )}
          {step.composer === "proposal" && coupon && (
            <div className={`quote-coupon${couponApplied && discountUsd > 0 ? " is-on" : ""}`}>
              <label className="quote-coupon-toggle">
                <input type="checkbox" checked={couponApplied} onChange={(e) => setCouponApplied(e.target.checked)} />
                <span className="quote-coupon-code">{t.couponLabel} · {coupon.code}</span>
                {coupon.kind === "percent" && <span className="quote-coupon-pct">−{coupon.value}%</span>}
              </label>
              {couponApplied && discountUsd > 0 && (
                <div className="quote-coupon-breakdown">
                  <span>{t.couponListLabel} {usd(listValue)}</span>
                  <span className="quote-coupon-arrow">→</span>
                  <span className="quote-coupon-final">{t.couponFinalLabel} <strong>{usd(finalUsd)}</strong></span>
                  <span className="quote-coupon-saved">−{usd(discountUsd)}</span>
                </div>
              )}
            </div>
          )}
          <div className="filter-grid admin-event-fields">
            {step.fields?.includes("total") && (
              <label className="field"><span>{t.total}{coupon && couponApplied && discountUsd > 0 ? ` · ${t.couponListLabel}` : ""}</span>
                <input type="number" min="0.01" step="0.01" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} required aria-invalid={step.composer === "proposal" && !(totalValue > 0)} /></label>
            )}
            {step.composer === "proposal" && (
              <label className="field"><span>{t.deposit}</span>
                <input type="number" min="0.01" step="0.01" max={finalUsd > 0 ? finalUsd : undefined} value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} aria-invalid={Boolean(f.deposit) && (!(depositValue > 0) || depositValue > finalUsd)} />
                {finalUsd > 0 && f.deposit === "" && (
                  <small className="quote-deposit-hint">{t.depositAuto(Math.round(depositRate * 100), usd(Math.round(finalUsd * depositRate)))}</small>
                )}</label>
            )}
            {step.fields?.includes("igi") && (
              <label className="field"><span>{t.igi}</span>
                <input value={f.igi} onChange={(e) => setF({ ...f, igi: e.target.value })} required aria-invalid={!f.igi.trim()} autoComplete="off" /></label>
            )}
            {step.fields?.includes("tracking") && (
              <label className="field"><span>{t.tracking}</span>
                <input value={f.tracking} onChange={(e) => setF({ ...f, tracking: e.target.value })} required aria-invalid={!f.tracking.trim()} autoComplete="off" /></label>
            )}
          </div>
          {validationMessage && <p className="form-error" role="status">{validationMessage}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button
            className={`button ${done && !unlocked ? "secondary" : "primary"}`}
            type="button"
            disabled={busy || uploadBusy || Boolean(validationMessage) || (done && !unlocked)}
            aria-busy={busy}
            onClick={fire}
          >
            {busy ? t.working : done && !unlocked ? t.sentLabel : cta}
          </button>
        </div>
      )}
    </section>
  );
}

export function AdminLiveOrderDetail() {
  const { orderCode } = useParams();
  return <AdminLiveOrderDetailContent key={orderCode} orderCode={orderCode} />;
}

function AdminLiveOrderDetailContent({ orderCode }) {
  const t = useCopy();
  const [state, setState] = useState({ status: "loading", data: null });
  const [notice, setNotice] = useState("");
  const [expandedStep, setExpandedStep] = useState(null); // 기본은 첫 미완료 스텝만 펼침
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundNote, setRefundNote] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const data = await apiFetch(`/admin/orders/${orderCode}`);
      if (sequence !== loadSequence.current) return false;
      setState({ status: "ok", data });
      return true;
    } catch (error) {
      if (sequence !== loadSequence.current) return false;
      setState((current) => (
        error?.status === 401 || error?.status === 403
          ? { status: "auth", data: null }
          : current.status === "ok"
            ? current
            : { status: error instanceof ApiUnavailableError ? "unavailable" : "auth", data: null }
      ));
      return false;
    }
  }, [orderCode]);

  async function fireCancel() {
    if (cancelBusy) return;
    const current = state.data;
    const hasTransferExposure = Boolean(current?.timeline?.some((event) => event.payload?.type === "payment_reported"))
      || Boolean(current?.order?.summary?.payments?.some((payment) => Number(payment.amountUsd) > 0));
    if (hasTransferExposure && !refundNote.trim()) {
      setCancelError(t.refundNoteRequired);
      return;
    }
    setCancelBusy(true);
    setCancelError("");
    try {
      await apiFetch(`/admin/orders/${orderCode}/events`, {
        method: "POST",
        body: { type: "order_cancelled", data: refundNote.trim() ? { refundNote: refundNote.trim() } : {} },
      });
      setCancelOpen(false);
      setRefundNote("");
      setNotice(t.sent);
      if (!(await load())) setNotice(t.refreshFailed);
    } catch {
      setCancelError(t.cancelFailed);
    } finally {
      setCancelBusy(false);
    }
  }

  useEffect(() => {
    setState((current) => (current.data?.order?.orderCode === orderCode ? current : { status: "loading", data: null }));
    load();
    const refreshVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const interval = window.setInterval(refreshVisible, 12000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      loadSequence.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [load, orderCode]);

  const intakeRows = useMemo(() => {
    if (state.status !== "ok") return [];
    const { order } = state.data;
    const fp = order.intake?.formPayload || {};
    const sp = fp.stonePrefs || {};
    const ms = fp.multiSpec || {};
    // 스타일 행 — 오픈 브리프(스타일 미정)는 상담 주문임을 명시해 "누락"으로 오독되지 않게 한다
    const styleId = fp.styleId || order.intake?.styleCode || "";
    const style = styleId ? getOpsStyle(styleId) : null;
    return [
      ["Style", styleId ? (style ? pickI18n(style.name, "en") : styleId) : t.consultOpenBrief],
      [t.category, [order.intake?.category, fp.productLine].filter(Boolean).join(" · ")],
      ["Stone", [sp.shape, formatCaratRange(sp.caratRange) || (sp.carat && `${sp.carat}ct`), formatGradeRange(sp.colorRange) || sp.color, formatGradeRange(sp.clarityRange) || sp.clarity, sp.growth].filter(Boolean).join(" · ")],
      ["Stones", [formatCaratRange(ms.totalCaratRange) && `${formatCaratRange(ms.totalCaratRange)} total`, ms.standard, ms.meleeSpec].filter(Boolean).join(" · ")],
      ["Fit", Object.entries(fp.conditional || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")],
      ["Engraving", (fp.engraving || "").trim()],
      ["Coupon", (fp.couponCode || "").trim()],
      [t.refNotes, (fp.inspirationNotes || "").trim()],
      [t.budget, order.intake?.budgetMinorUnits ? usd(order.intake.budgetMinorUnits / 100) : "—"],
      [t.requiredDate, order.intake?.requiredDate ? String(order.intake.requiredDate).slice(0, 10) : "—"],
    ].filter(([, v]) => v && v !== "—");
  }, [state, t]);

  if (state.status === "loading") return <div className="panel"><p className="form-hint">…</p></div>;
  if (state.status !== "ok") return <ErrorPanel error={state.status} t={t} />;

  const { order, timeline, artifacts, actions } = state.data;
  const refMedia = order.intake?.referenceMedia || [];
  const cancelNeedsResolution = timeline.some((event) => event.payload?.type === "payment_reported")
    || Boolean(order.summary?.payments?.some((payment) => Number(payment.amountUsd) > 0));

  return (
    <div className="form-stack">
      <p><Link className="text-link" to="/bo-4q9z7m/live">{t.back}</Link></p>
      <div className="panel admin-live-order-head" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div className="admin-live-order-meta">
          <p className="admin-kicker">{t.kicker}</p>
          <h2 style={{ margin: "2px 0 6px" }}>{order.orderCode} <span className="status-badge mst-inProgress">{order.stage}</span></h2>
          <p className="form-hint">{order.customer?.name} · {order.customer?.email} · {order.customer?.locale} · {t.waiting}: {t.waitingOn[order.waitingOn] || order.waitingOn}</p>
        </div>
        {!["CANCELLED", "DELIVERED"].includes(order.stage) && (
          <div className={`admin-order-cancel${cancelOpen ? " is-open" : ""}`}>
            {cancelOpen ? (
              <div className="form-stack">
                <label className="field"><span>{t.refundNoteLbl}</span>
                  <input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} autoFocus required={cancelNeedsResolution} aria-required={cancelNeedsResolution} /></label>
                <div className="row-actions">
                  <button className="button secondary small" type="button" disabled={cancelBusy} onClick={() => { setCancelOpen(false); setCancelError(""); }}>{t.cancelKeepBtn}</button>
                  <button className="button primary small" type="button" disabled={cancelBusy || (cancelNeedsResolution && !refundNote.trim())} aria-busy={cancelBusy} onClick={fireCancel}>
                    {cancelBusy ? t.working : t.cancelConfirmBtn}
                  </button>
                </div>
                {cancelError && <p className="form-error" role="alert">{cancelError}</p>}
              </div>
            ) : (
              <button className="button secondary small" type="button" onClick={() => { setCancelOpen(true); setCancelError(""); }}>{t.cancelOrderBtn}</button>
            )}
          </div>
        )}
      </div>

      {(() => {
        const cancelReq = timeline.find((e) => e.payload?.type === "cancel_requested");
        if (!cancelReq || order.stage === "CANCELLED") return null;
        return (
          <div className="panel form-stack" style={{ borderLeft: "2px solid #e08585" }}>
            <strong>{t.cancelRequestedBanner}</strong>
            {cancelReq.payload?.data?.reason && <p style={{ margin: 0 }}>“{cancelReq.payload.data.reason}”</p>}
            <p className="form-hint" style={{ margin: 0 }}>{new Date(cancelReq.createdAt).toLocaleString()}</p>
          </div>
        );
      })()}

      {notice && <p className="admin-save-notice is-saved" role="status">{notice}</p>}

      <div className="panel form-stack">
        <p className="admin-kicker">{t.intake} · {order.intake?.intakeCode}</p>
        <div className="ops-brief-list">
          {intakeRows.map(([label, value]) => (
            <div className="ops-brief-row" key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
        {refMedia.length > 0 && (
          <>
            <p className="form-hint">{t.referenceMedia}</p>
            <div className="card-grid cols-3">
              {refMedia.map((m, i) => <MediaThumb key={i} media={m} alt="" ratio="1 / 1" />)}
            </div>
          </>
        )}
      </div>

      {order.summary?.shippingAddress?.addressLine1 && (
        <div className="panel form-stack">
          <p className="admin-kicker">{t.shippingAddr}</p>
          <p style={{ margin: 0, lineHeight: 1.7 }}>
            <strong>{order.summary.shippingAddress.recipientName}</strong> · {order.summary.shippingAddress.phone}<br />
            {[order.summary.shippingAddress.addressLine1, order.summary.shippingAddress.addressLine2].filter(Boolean).join(", ")}<br />
            {[order.summary.shippingAddress.city, order.summary.shippingAddress.region, order.summary.shippingAddress.postalCode, order.summary.shippingAddress.country].filter(Boolean).join(", ")}
            {order.summary.shippingAddress.notes && <><br /><span className="form-hint">{order.summary.shippingAddress.notes}</span></>}
          </p>
        </div>
      )}

      <div className="panel form-stack">
        <p className="admin-kicker">{t.console}</p>
        <p className="form-hint">{t.consoleHint}</p>
      </div>
      {(() => {
        // 발사된 이벤트 = 완료 — 타임라인이 진실원장 (stage는 여러 스텝이 공유해 판정 기준으로 부적합)
        const firedTypes = new Set(timeline.map((e) => e.payload?.type || e.title));
        const firstOpenType = FLOW.find((s2) => !firedTypes.has(s2.type))?.type || null;
        const openKinds = new Set(actions.filter((a) => a.status === "OPEN").map((a) => a.kind));
        return FLOW.map((step, i) => {
          // 고객이 수정 요청한 컨펌 종류는 해당 스텝을 다시 연다.
          // 단, 판단 기준은 "가장 최근 응답" — 이후에 승인(APPROVE)이 왔으면 이전 수정 요청은 소멸.
          const lastResponded = step.action && !openKinds.has(step.action.kind)
            ? actions
              .filter((a) => a.kind === step.action.kind && a.status === "RESPONDED")
              .sort((x, y) => new Date(y.respondedAt) - new Date(x.respondedAt))[0] || null
            : null;
          const changeRequest = lastResponded?.responsePayload?.response === "REQUEST_CHANGES" ? lastResponded : null;
          const done = firedTypes.has(step.type);
          const expanded = !done && (expandedStep ? expandedStep === step.type : step.type === firstOpenType);
          const guard = adminStepGuard({ step, index: i, order, timeline, actions, changeRequest, t });
          return (
            <StepCard key={`${order.orderCode}-${step.type}`} step={step} index={i + 1} order={order} t={t} done={done}
              changeRequest={changeRequest} expanded={expanded}
              available={guard.available} blockedReason={guard.reason}
              onToggle={() => setExpandedStep((current) => (current === step.type ? null : step.type))}
              onSent={async () => { setNotice(t.sent); setExpandedStep(null); return load(); }} />
          );
        });
      })()}

      {artifacts.length > 0 && (
        <div className="panel form-stack">
          <p className="admin-kicker">{t.artifacts}</p>
          {artifacts.map((a) => (
            <div key={a.id} className="feedback-note">
              <strong>{a.type}</strong> · {a.versionLabel} · {new Date(a.publishedAt).toLocaleString()}
              {a.payload?.note && ` · ${a.payload.note}`}
              {a.media?.length > 0 && (
                <div className="card-grid cols-3" style={{ marginTop: 8 }}>
                  {a.media.map((m, i) => <MediaThumb key={i} media={m} alt="" ratio="1 / 1" />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="panel form-stack">
          <p className="admin-kicker">{t.actions}</p>
          {actions.map((a) => (
            <div key={a.id} className="feedback-note">
              <strong>{a.kind}</strong> · <span className={`status-badge ${a.status === "OPEN" ? "mst-waitingClient" : a.status === "RESPONDED" ? "mst-done" : "mst-pending"}`}>{a.status}</span>
              {a.responsePayload?.response && ` · ${a.responsePayload.response}`}
              {a.respondedAt && ` · ${new Date(a.respondedAt).toLocaleString()}`}
              {a.responsePayload?.message && <p style={{ margin: "4px 0 0" }}>“{a.responsePayload.message}”</p>}
              {a.responsePayload?.media?.length > 0 && (
                <div className="card-grid cols-3" style={{ marginTop: 8 }}>
                  {a.responsePayload.media.map((m, i) => <MediaThumb key={i} media={m} alt="" ratio="1 / 1" />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="panel form-stack">
        <p className="admin-kicker">{t.timeline}</p>
        {timeline.map((e) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hair)" }}>
            <span><strong>{t.steps[e.title] || e.title}</strong>{e.payload?.data?.tracking && ` · ${e.payload.data.tracking}`}{e.payload?.data?.igi && ` · IGI ${e.payload.data.igi}`}</span>
            <span className="form-hint" style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
