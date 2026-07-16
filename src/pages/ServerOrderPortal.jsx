// 실서버 주문 포털 (BD- 주문번호) — 접수 메일의 /track/BD-… 링크가 여기로 열린다.
// 데모 스토어(DM-)와 달리 Postgres의 stage/타임라인/액션을 그대로 보여주는 얇은 뷰.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../lib/api.js";
import { useAuth, LOGIN_FOR } from "../lib/auth.jsx";
import { MediaPicker, MediaThumb, usd } from "../components/ui.jsx";
import { PROPOSAL_FLOW_COPY } from "../lib/proposalFlowCopy.js";
import { Checkpoint, ClientMediaCarousel, PaymentCard, ShippingAddressPanel } from "./ClientPortal.jsx";
import { getSettings, isShippingAddressComplete } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { hasSyncedPublicSettings, syncCatalogFromServer } from "../lib/serverSync.js";
import { useLocale } from "../i18n.jsx";

const EMPTY_ADDRESS = {
  recipientName: "", phone: "", addressLine1: "", addressLine2: "",
  city: "", region: "", postalCode: "", country: "", notes: "",
};

const COPY = {
  en: {
    kicker: "Order status",
    signInTitle: "Sign in to view this order",
    signInBody: "This order is linked to your email. Sign in with the same email you used when ordering.",
    signInCta: "Sign in",
    deniedTitle: "We couldn't open this order",
    deniedBody: "This order belongs to a different account. Sign in with the email you used when ordering.",
    unavailableTitle: "The order portal is warming up",
    unavailableBody: "Please try again in a moment, or email support@belovediamond.com — we answer within one business day.",
    loading: "Loading your order…",
    waiting: {
      CUSTOMER: "Your turn — a confirmation below is waiting for you.",
      BELOVEDIAMOND: "BeloveD is on it — no action needed from you right now.",
      EXTERNAL: "In transit — we'll update you as soon as it moves.",
      NONE: "All done — enjoy your piece.",
    },
    waitingDeposit: "Your turn — reserve your piece with the deposit below.",
    waitingBalance: "Your turn — settle the balance below to start shipping.",
    stages: {
      OPS_REVIEW: "Reviewing your request", STONE_SELECTION: "Selecting your stone", QUOTE: "Review your proposal",
      DEPOSIT: "Awaiting your deposit", CAD: "Designing", PRODUCTION: "Crafting", FINAL_QC: "Final quality check",
      BALANCE: "Balance", SHIPPING: "Shipping", DELIVERED: "Delivered", CANCELLED: "Cancelled",
    },
    phases: { DEFINE: "Confirm your piece", MAKING: "We make it", DELIVERY: "Deliver" },
    nextTitle: "Your confirmation",
    kinds: {
      QUOTE_ACCEPTANCE: "Review and confirm your proposal",
      CAD_REVIEW: "Review your design",
      FINAL_QC_CONFIRMATION: "Confirm your finished piece",
      FINAL_WEIGHT_ACCEPTANCE: "Confirm the final weight",
      DIAMOND_SELECTION: "Choose your stone",
      DELIVERY_ADDRESS: "Confirm your delivery address",
    },
    respond: { APPROVE: "Approve", ACCEPT: "Accept", CONFIRM: "Confirm", REQUEST_CHANGES: "Request changes", REJECT: "Decline" },
    changesTitle: "What should we change?",
    changesPlaceholder: "Tell us what you'd like different — stone, metal, budget, design details…",
    changesSend: "Send request", changesCancel: "Back",
    changesAttach: "Photos or videos (optional)",
    responded: "Thank you — your response is in. We'll take it from here.",
    cancelLink: "Cancel this order", cancelRequestLink: "Request cancellation",
    cancelPolicyFree: "Before the deposit, cancellation is free — the order simply closes.",
    cancelPolicyPartial: "Production has begun, so refunds follow our policy — we'll confirm the exact amount with you before anything is final.",
    cancelReason: "Reason (optional)", cancelConfirm: "Confirm cancellation", cancelKeep: "Keep my order",
    cancelRequestedNote: "Cancellation requested — we'll contact you within 1 business day.",
    cancelledLine: "This order has been cancelled.",
    addressGate: "Save your shipping address above before reporting the transfer.",
    shipmentTitle: "Shipment", trackingLabel: "Tracking number",
    shipmentNote: "Fully insured door-to-door — signature required on delivery.",
    timelineTitle: "Timeline",
    receiptsTitle: "Payments", receiptDeposit: "Deposit received", receiptBalance: "Balance received", receiptPaidTotal: "Paid to date",
    artifactsTitle: "Shared with you",
    proposalTitle: "Your proposal",
    specStone: "Stone", specMetal: "Metal", specTotal: "Total, all-inclusive",
    leadFmt: (d) => `≈ ${d} business days`,
    events: {
      proposal_sent: "Proposal sent", deposit_confirmed: "Deposit confirmed",
      diamond_locked: "Your diamond is secured", production_started: "Production started",
      qc_ready: "Finished piece ready for your review", balance_requested: "Balance requested",
      balance_confirmed: "Balance received — preparing your shipment",
      shipped: "Shipped", delivered: "Delivered",
      shipping_address_confirmed: "Shipping address confirmed", payment_reported: "Payment reported — confirming transfer",
      order_cancelled: "Order cancelled", cancel_requested: "Cancellation requested",
      "Request received": "Request received", "Response received": "Response received",
    },
    emailTail: "Questions? Email support@belovediamond.com — it reaches the order team directly.",
  },
  ko: {
    kicker: "주문 현황",
    signInTitle: "로그인하면 주문을 볼 수 있어요",
    signInBody: "이 주문은 이메일 계정에 연결되어 있습니다. 주문할 때 쓴 이메일로 로그인해 주세요.",
    signInCta: "로그인",
    deniedTitle: "이 주문을 열 수 없습니다",
    deniedBody: "다른 계정의 주문입니다. 주문할 때 사용한 이메일로 로그인해 주세요.",
    unavailableTitle: "주문 포털을 준비하고 있어요",
    unavailableBody: "잠시 후 다시 시도해 주세요. 급하시면 support@belovediamond.com으로 문의 주시면 영업일 기준 하루 안에 답변드립니다.",
    loading: "주문을 불러오는 중…",
    waiting: {
      CUSTOMER: "지금은 고객님 차례예요 — 아래 컨펌이 기다리고 있습니다.",
      BELOVEDIAMOND: "BeloveD가 진행 중입니다 — 지금은 하실 일이 없어요.",
      EXTERNAL: "이동 중입니다 — 변동이 생기면 바로 알려드릴게요.",
      NONE: "모든 단계가 끝났습니다 — 마음껏 즐겨주세요.",
    },
    waitingDeposit: "지금은 고객님 차례예요 — 아래에서 디파짓으로 예약을 확정해 주세요.",
    waitingBalance: "지금은 고객님 차례예요 — 아래에서 잔금을 보내주시면 배송 준비가 시작됩니다.",
    stages: {
      OPS_REVIEW: "요청 검토 중", STONE_SELECTION: "스톤 선정 중", QUOTE: "제안 확인 대기",
      DEPOSIT: "디파짓 대기", CAD: "디자인 중", PRODUCTION: "제작 중", FINAL_QC: "최종 품질 확인",
      BALANCE: "잔금", SHIPPING: "배송 중", DELIVERED: "배송 완료", CANCELLED: "취소됨",
    },
    phases: { DEFINE: "피스 확정", MAKING: "제작", DELIVERY: "배송" },
    nextTitle: "고객 컨펌",
    kinds: {
      QUOTE_ACCEPTANCE: "제안을 확인하고 컨펌해 주세요",
      CAD_REVIEW: "디자인을 확인해 주세요",
      FINAL_QC_CONFIRMATION: "완성품을 컨펌해 주세요",
      FINAL_WEIGHT_ACCEPTANCE: "최종 중량을 확인해 주세요",
      DIAMOND_SELECTION: "스톤을 선택해 주세요",
      DELIVERY_ADDRESS: "배송지를 확인해 주세요",
    },
    respond: { APPROVE: "승인", ACCEPT: "수락", CONFIRM: "컨펌", REQUEST_CHANGES: "수정 요청", REJECT: "반려" },
    changesTitle: "어떤 부분을 바꿔드릴까요?",
    changesPlaceholder: "스톤, 메탈, 예산, 디자인 디테일 등 원하시는 변경을 적어주세요…",
    changesSend: "요청 보내기", changesCancel: "뒤로",
    changesAttach: "사진·영상 첨부 (선택)",
    responded: "감사합니다 — 응답이 접수됐습니다. 이후 진행은 저희가 맡을게요.",
    cancelLink: "주문 취소", cancelRequestLink: "취소 요청",
    cancelPolicyFree: "디파짓 전에는 무료로 취소됩니다 — 주문이 바로 종료돼요.",
    cancelPolicyPartial: "제작이 시작되어 정책에 따라 부분 환불이 적용됩니다 — 확정 전에 환불 금액을 먼저 안내드려요.",
    cancelReason: "사유 (선택)", cancelConfirm: "취소 확정", cancelKeep: "주문 유지",
    cancelRequestedNote: "취소 요청이 접수됐습니다 — 영업일 1일 내 연락드립니다.",
    cancelledLine: "이 주문은 취소되었습니다.",
    addressGate: "송금 보고 전에 위의 배송지를 저장해 주세요.",
    shipmentTitle: "배송", trackingLabel: "운송장 번호",
    shipmentNote: "전 구간 보험 배송 — 수령 시 서명이 필요합니다.",
    timelineTitle: "타임라인",
    receiptsTitle: "결제 내역", receiptDeposit: "디파짓 결제 완료", receiptBalance: "잔금 결제 완료", receiptPaidTotal: "누적 결제액",
    artifactsTitle: "공유된 자료",
    proposalTitle: "제안",
    specStone: "스톤", specMetal: "메탈", specTotal: "총액 (올인클루시브)",
    leadFmt: (d) => `≈ ${d} 영업일`,
    events: {
      proposal_sent: "제안 발송됨", deposit_confirmed: "디파짓 확인됨",
      diamond_locked: "다이아몬드 확보됨", production_started: "제작 시작",
      qc_ready: "완성품 확인 요청", balance_requested: "잔금 안내",
      balance_confirmed: "잔금 확인 완료 — 배송 준비 중",
      shipped: "발송됨", delivered: "배송 완료",
      shipping_address_confirmed: "배송지 확인됨", payment_reported: "송금 보고 접수 — 입금 확인 중",
      order_cancelled: "주문 취소됨", cancel_requested: "취소 요청 접수",
      "Request received": "요청 접수됨", "Response received": "응답 접수됨",
    },
    emailTail: "궁금한 점은 support@belovediamond.com으로 문의해 주세요 — 주문 팀에게 바로 전달됩니다.",
  },
  zh: {
    kicker: "订单状态",
    signInTitle: "登录后即可查看此订单",
    signInBody: "此订单与您的邮箱绑定。请使用下单时的邮箱登录。",
    signInCta: "登录",
    deniedTitle: "无法打开此订单",
    deniedBody: "该订单属于其他账户。请使用下单时的邮箱登录。",
    unavailableTitle: "订单页面正在准备",
    unavailableBody: "请稍后重试，或致信 support@belovediamond.com，我们会在一个工作日内回复。",
    loading: "正在加载订单…",
    waiting: {
      CUSTOMER: "轮到您了 — 下方有待您确认的事项。",
      BELOVEDIAMOND: "BeloveD 正在处理 — 目前无需您操作。",
      EXTERNAL: "运输中 — 一有进展我们会立即通知您。",
      NONE: "全部完成 — 愿您喜欢。",
    },
    waitingDeposit: "轮到您了 — 请在下方支付定金完成预订。",
    waitingBalance: "轮到您了 — 请在下方支付尾款以安排发货。",
    stages: {
      OPS_REVIEW: "审核请求中", STONE_SELECTION: "挑选钻石中", QUOTE: "待您确认方案",
      DEPOSIT: "等待定金", CAD: "设计中", PRODUCTION: "制作中", FINAL_QC: "最终质检",
      BALANCE: "尾款", SHIPPING: "配送中", DELIVERED: "已送达", CANCELLED: "已取消",
    },
    phases: { DEFINE: "确认作品", MAKING: "制作", DELIVERY: "交付" },
    nextTitle: "待您确认",
    kinds: {
      QUOTE_ACCEPTANCE: "请查看并确认方案",
      CAD_REVIEW: "请查看设计",
      FINAL_QC_CONFIRMATION: "请确认成品",
      FINAL_WEIGHT_ACCEPTANCE: "请确认最终重量",
      DIAMOND_SELECTION: "请选择钻石",
      DELIVERY_ADDRESS: "请确认收货地址",
    },
    respond: { APPROVE: "同意", ACCEPT: "接受", CONFIRM: "确认", REQUEST_CHANGES: "请求修改", REJECT: "拒绝" },
    changesTitle: "需要修改哪些地方？",
    changesPlaceholder: "请告诉我们想调整的内容 — 钻石、金属、预算、设计细节…",
    changesSend: "发送请求", changesCancel: "返回",
    changesAttach: "附上照片或视频（可选）",
    responded: "谢谢 — 已收到您的回复，后续交给我们。",
    cancelLink: "取消订单", cancelRequestLink: "申请取消",
    cancelPolicyFree: "支付定金前可免费取消 — 订单将直接关闭。",
    cancelPolicyPartial: "制作已开始，退款将按政策执行 — 确认前我们会先告知退款金额。",
    cancelReason: "原因（可选）", cancelConfirm: "确认取消", cancelKeep: "保留订单",
    cancelRequestedNote: "已收到取消请求 — 我们将在 1 个工作日内联系您。",
    cancelledLine: "此订单已取消。",
    addressGate: "报告付款前，请先保存上方的收货地址。",
    shipmentTitle: "配送", trackingLabel: "运单号",
    shipmentNote: "全程保险配送 — 签收时需要签名。",
    timelineTitle: "时间线",
    receiptsTitle: "付款记录", receiptDeposit: "定金已收", receiptBalance: "尾款已收", receiptPaidTotal: "累计已付",
    artifactsTitle: "与您共享",
    proposalTitle: "您的方案",
    specStone: "钻石", specMetal: "金属", specTotal: "总价（全包）",
    leadFmt: (d) => `约 ${d} 个工作日`,
    events: {
      proposal_sent: "方案已发送", deposit_confirmed: "定金已确认",
      diamond_locked: "钻石已锁定", production_started: "开始制作",
      qc_ready: "成品待您确认", balance_requested: "已发送尾款说明",
      balance_confirmed: "尾款已确认 — 准备发货",
      shipped: "已发货", delivered: "已送达",
      shipping_address_confirmed: "收货地址已确认", payment_reported: "已报告付款 — 核对到账中",
      order_cancelled: "订单已取消", cancel_requested: "已申请取消",
      "Request received": "已收到请求", "Response received": "已收到回复",
    },
    emailTail: "如有疑问，请致信 support@belovediamond.com — 同一团队为您服务。",
  },
  es: {
    kicker: "Estado del pedido",
    signInTitle: "Inicia sesión para ver este pedido",
    signInBody: "Este pedido está vinculado a tu correo. Inicia sesión con el correo que usaste al ordenar.",
    signInCta: "Iniciar sesión",
    deniedTitle: "No pudimos abrir este pedido",
    deniedBody: "Este pedido pertenece a otra cuenta. Inicia sesión con el correo que usaste al ordenar.",
    unavailableTitle: "El portal del pedido se está preparando",
    unavailableBody: "Inténtalo de nuevo en un momento, o escríbenos a support@belovediamond.com — contestamos en un día hábil.",
    loading: "Cargando tu pedido…",
    waiting: {
      CUSTOMER: "Tu turno — hay una confirmación esperándote abajo.",
      BELOVEDIAMOND: "BeloveD está en ello — no necesitas hacer nada ahora.",
      EXTERNAL: "En tránsito — te avisaremos en cuanto avance.",
      NONE: "Todo listo — disfruta tu pieza.",
    },
    waitingDeposit: "Tu turno — reserva tu pieza con el depósito abajo.",
    waitingBalance: "Tu turno — envía el saldo abajo para iniciar el envío.",
    stages: {
      OPS_REVIEW: "Revisando tu solicitud", STONE_SELECTION: "Seleccionando tu piedra", QUOTE: "Revisa tu propuesta",
      DEPOSIT: "Depósito pendiente", CAD: "Diseñando", PRODUCTION: "Fabricando", FINAL_QC: "Control final",
      BALANCE: "Saldo", SHIPPING: "En camino", DELIVERED: "Entregado", CANCELLED: "Cancelado",
    },
    phases: { DEFINE: "Confirma tu pieza", MAKING: "La fabricamos", DELIVERY: "Entrega" },
    nextTitle: "Tu confirmación",
    kinds: {
      QUOTE_ACCEPTANCE: "Revisa y confirma tu propuesta",
      CAD_REVIEW: "Revisa tu diseño",
      FINAL_QC_CONFIRMATION: "Confirma tu pieza terminada",
      FINAL_WEIGHT_ACCEPTANCE: "Confirma el peso final",
      DIAMOND_SELECTION: "Elige tu piedra",
      DELIVERY_ADDRESS: "Confirma tu dirección de entrega",
    },
    respond: { APPROVE: "Aprobar", ACCEPT: "Aceptar", CONFIRM: "Confirmar", REQUEST_CHANGES: "Pedir cambios", REJECT: "Rechazar" },
    changesTitle: "¿Qué deberíamos cambiar?",
    changesPlaceholder: "Cuéntanos qué quieres diferente — piedra, metal, presupuesto, detalles…",
    changesSend: "Enviar solicitud", changesCancel: "Atrás",
    changesAttach: "Fotos o videos (opcional)",
    responded: "Gracias — recibimos tu respuesta. Nosotros seguimos desde aquí.",
    cancelLink: "Cancelar este pedido", cancelRequestLink: "Solicitar cancelación",
    cancelPolicyFree: "Antes del depósito la cancelación es gratuita — el pedido simplemente se cierra.",
    cancelPolicyPartial: "La producción ya comenzó; los reembolsos siguen nuestra política — confirmaremos el monto contigo antes de finalizar.",
    cancelReason: "Motivo (opcional)", cancelConfirm: "Confirmar cancelación", cancelKeep: "Mantener mi pedido",
    cancelRequestedNote: "Cancelación solicitada — te contactaremos en 1 día hábil.",
    cancelledLine: "Este pedido ha sido cancelado.",
    addressGate: "Guarda tu dirección de envío arriba antes de reportar la transferencia.",
    shipmentTitle: "Envío", trackingLabel: "Número de guía",
    shipmentNote: "Envío asegurado puerta a puerta — se requiere firma al recibir.",
    timelineTitle: "Cronología",
    receiptsTitle: "Pagos", receiptDeposit: "Depósito recibido", receiptBalance: "Saldo recibido", receiptPaidTotal: "Total pagado",
    artifactsTitle: "Compartido contigo",
    proposalTitle: "Tu propuesta",
    specStone: "Piedra", specMetal: "Metal", specTotal: "Total, todo incluido",
    leadFmt: (d) => `≈ ${d} días hábiles`,
    events: {
      proposal_sent: "Propuesta enviada", deposit_confirmed: "Depósito confirmado",
      diamond_locked: "Diamante asegurado", production_started: "Producción iniciada",
      qc_ready: "Pieza lista para tu revisión", balance_requested: "Saldo solicitado",
      balance_confirmed: "Saldo recibido — preparando el envío",
      shipped: "Enviado", delivered: "Entregado",
      shipping_address_confirmed: "Dirección de envío confirmada", payment_reported: "Pago reportado — confirmando transferencia",
      order_cancelled: "Pedido cancelado", cancel_requested: "Cancelación solicitada",
      "Request received": "Solicitud recibida", "Response received": "Respuesta recibida",
    },
    emailTail: "¿Preguntas? Escríbenos a support@belovediamond.com.",
  },
};

const MUTATION_COPY = {
  en: {
    saveFailed: "We couldn't save this address. Your changes are still here — please try again.",
    actionFailed: "We couldn't send that response. Your message and attachments are still here — please try again.",
    cancelFailed: "We couldn't submit the cancellation. Your reason is still here — please try again.",
    saving: "Saving…", responding: "Sending…", cancelling: "Submitting…",
    zoom: "Open finished-piece media full screen", closeZoom: "Close full-screen media",
  },
  ko: {
    saveFailed: "배송지를 저장하지 못했습니다. 입력한 내용은 그대로 있으니 다시 시도해 주세요.",
    actionFailed: "응답을 보내지 못했습니다. 메시지와 첨부는 그대로 있으니 다시 시도해 주세요.",
    cancelFailed: "취소 요청을 접수하지 못했습니다. 사유는 그대로 있으니 다시 시도해 주세요.",
    saving: "저장 중…", responding: "보내는 중…", cancelling: "접수 중…",
    zoom: "완성품 미디어 크게 보기", closeZoom: "전체 화면 미디어 닫기",
  },
  zh: {
    saveFailed: "无法保存收货地址。您的更改仍保留，请重试。",
    actionFailed: "无法发送回复。您的消息和附件仍保留，请重试。",
    cancelFailed: "无法提交取消申请。您的原因仍保留，请重试。",
    saving: "保存中…", responding: "发送中…", cancelling: "提交中…",
    zoom: "全屏查看成品媒体", closeZoom: "关闭全屏媒体",
  },
  es: {
    saveFailed: "No pudimos guardar la dirección. Tus cambios siguen aquí; inténtalo de nuevo.",
    actionFailed: "No pudimos enviar la respuesta. Tu mensaje y archivos siguen aquí; inténtalo de nuevo.",
    cancelFailed: "No pudimos enviar la cancelación. Tu motivo sigue aquí; inténtalo de nuevo.",
    saving: "Guardando…", responding: "Enviando…", cancelling: "Enviando…",
    zoom: "Ver el acabado a pantalla completa", closeZoom: "Cerrar contenido a pantalla completa",
  },
};

function configuredDeposit(total, explicit) {
  if (!(Number(total) > 0)) return null;
  const configuredRate = Number(getSettings().opsDepositRate);
  const rate = configuredRate > 0 && configuredRate < 1 ? configuredRate : 0.5;
  const requested = Number(explicit) > 0 ? Number(explicit) : Math.round(Number(total) * rate);
  return Math.min(Number(total), requested);
}

// Account(My Page) 서버 주문 카드가 같은 라벨을 쓰도록 export
export function serverStageLabel(stage, locale) {
  const t = COPY[locale] || COPY.en;
  return t.stages[stage] || stage;
}
export function serverActionLabel(kind, locale) {
  const t = COPY[locale] || COPY.en;
  return t.kinds[kind] || t.nextTitle;
}

// 실서버 제안 카드 — DM 포털의 ProposalCard와 같은 마크업/클래스(플랫폼 CSS 재사용).
// 어드민 견적 컴포저의 payload(settingSummary/stone/총액…)를 오더 시트처럼 렌더.
function ServerProposalCard({ pay, media, fc, t, shapes }) {
  const stone = pay.stone || null;
  const total = pay.totalUsd > 0 ? pay.totalUsd : null;
  // 디파짓은 총액을 넘지 못한다 — 초과 입력 시 잔금이 음수로 보이는 것 방지
  const deposit = configuredDeposit(total, pay.depositUsd);
  const metalSummary = [
    pay.metalSpec,
    pay.estWeightG ? fc.weightApprox(pay.estWeightG) : "",
  ].filter(Boolean).join(" · ");
  const caratRange = stone && stone.caratMin
    ? `${Number(stone.caratMin).toFixed(2)}${Number(stone.caratMax) > Number(stone.caratMin) ? `–${Number(stone.caratMax).toFixed(2)}` : ""}ct`
    : "";
  const grade = stone ? [stone.color, stone.clarity, stone.growth].filter(Boolean).join(" · ") : "";
  return (
    <div className="proposal-card">
      {media?.length > 0 && (
        <div className={`server-proposal-media${media.length === 1 ? " is-single" : ""}`}>
          {media.map((m, i) => <MediaThumb key={i} media={m} alt="" ratio="1 / 1" eager={i === 0} />)}
        </div>
      )}
      <div className="proposal-card-body">
        <div className="proposal-piece">
          <p className="section-label">{fc.pieceTitle}</p>
          <dl className="proposal-spec">
            {pay.settingSummary && <div><dt>{fc.specSetting}</dt><dd>{pay.settingSummary}</dd></div>}
            {pay.designNote && <div className="is-design-note"><dt>{fc.designNote}</dt><dd>{pay.designNote}</dd></div>}
            {metalSummary && <div><dt>{fc.specMetal}</dt><dd>{metalSummary}</dd></div>}
            {stone && (
              <div><dt>{fc.specStone}</dt><dd>{[shapes?.[stone.shape] || stone.shape, caratRange].filter(Boolean).join(" · ")}</dd></div>
            )}
            {grade && <div><dt>{fc.specGrade}</dt><dd>{grade}</dd></div>}
            {stone?.igiNo && <div><dt>{fc.specCert}</dt><dd>{stone.lab || "IGI"} {stone.igiNo}</dd></div>}
            {pay.leadDays > 0 && <div><dt>{fc.specLead}</dt><dd>{t.leadFmt(pay.leadDays)}</dd></div>}
            {/* 구버전 payload(자유 텍스트 스펙) 폴백 */}
            {!stone && pay.stoneSpec && <div><dt>{fc.specStone}</dt><dd>{pay.stoneSpec}</dd></div>}
          </dl>
          {pay.note && (
            <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65 }}>{pay.note}</p>
          )}
        </div>
        {total && (
          <aside className="proposal-pricing">
            <p className="section-label">{fc.priceTitle}</p>
            <div className="proposal-total">
              <span className="proposal-total-label">{fc.totalLabel}</span>
              {pay.coupon?.code && pay.listUsd > total && (
                <div className="proposal-coupon">
                  <div className="proposal-coupon-row"><span>{fc.listLabel}</span><s>{usd(pay.listUsd)}</s></div>
                  <div className="proposal-coupon-row is-save"><span>{fc.couponSaved} · {pay.coupon.code}</span><strong>−{usd(pay.coupon.discountUsd)}</strong></div>
                </div>
              )}
              <div className="proposal-amount">{usd(total)}</div>
              <p className="form-hint">{fc.totalMeta}</p>
            </div>
            <div className="proposal-split">
              <div><span>{fc.depositToday}</span><strong>{usd(deposit)}</strong></div>
              <div><span>{fc.balanceShip}</span><strong>{usd(total - deposit)}</strong></div>
            </div>
          </aside>
        )}
      </div>
      <p className="proposal-sub-note"><strong>{fc.subTitle}.</strong> {pay.substitutionNote || fc.subBody}</p>
    </div>
  );
}

function fmtDate(iso, locale) {
  if (!iso) return "";
  try {
    // 분 단위까지 — 같은 날 여러 이벤트(제안 발송→수정 요청→재발송)를 구분할 수 있어야 한다
    return new Date(iso).toLocaleString(locale === "zh" ? "zh-CN" : locale, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return ""; }
}

export default function ServerOrderPortal({ orderCode }) {
  useDBVersion();
  const { locale, p } = useLocale();
  const fc = PROPOSAL_FLOW_COPY[locale] || PROPOSAL_FLOW_COPY.en;
  const { user } = useAuth();
  const location = useLocation();
  const t = COPY[locale] || COPY.en;
  const mc = MUTATION_COPY[locale] || MUTATION_COPY.en;
  const [state, setState] = useState({ status: "loading", order: null });
  const [respondedId, setRespondedId] = useState("");
  // 수정 요청은 무엇을 바꿀지 적을 수 있어야 어드민이 반영한다 — 클릭 시 텍스트 입력 단계로
  const [changeMode, setChangeMode] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");
  const [changeMedia, setChangeMedia] = useState([]); // 참고 사진·영상 — R2 업로드 후 URL만 전송
  const [changeUploadBusy, setChangeUploadBusy] = useState(false);
  const [changeUploadError, setChangeUploadError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [address, setAddress] = useState(null); // null = 주문 로드 전 (로드 시 서버 저장값으로 초기화)
  const [addressSaved, setAddressSaved] = useState(false);
  const [addressDirty, setAddressDirty] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [paymentSettingsStatus, setPaymentSettingsStatus] = useState(() => (
    hasSyncedPublicSettings() ? "ready" : "loading"
  ));
  const loadSequence = useRef(0);

  const loadOrder = useCallback(async ({ initial = false } = {}) => {
    const sequence = ++loadSequence.current;
    if (initial) {
      setState((current) => (current.order?.orderCode === orderCode ? current : { status: "loading", order: null }));
    }
    try {
      const data = await apiFetch(`/orders/${orderCode}`);
      if (sequence === loadSequence.current) setState({ status: "ok", order: data.order });
      return data.order;
    } catch (error) {
      if (sequence !== loadSequence.current) return null;
      if (initial || error?.status === 401 || error?.status === 403) {
        if (error instanceof ApiUnavailableError) setState({ status: "unavailable", order: null });
        else if (error.status === 401) setState({ status: "signin", order: null });
        else setState({ status: "denied", order: null });
      }
      return null;
    }
  }, [orderCode, user?.id]);

  useEffect(() => {
    setRespondedId("");
    setChangeMode(false);
    setChangeMsg("");
    setChangeMedia([]);
    setChangeUploadBusy(false);
    setChangeUploadError("");
    setPendingAction("");
    setMutationError("");
    setAddress(null);
    setAddressSaved(false);
    setAddressDirty(false);
    setAddressError("");
    setAddressSaving(false);
    setCancelOpen(false);
    setCancelMsg("");
    setCancelBusy(false);
    setCopiedTracking(false);
    loadOrder({ initial: true });
    return () => { loadSequence.current += 1; };
  }, [loadOrder]);

  useEffect(() => {
    let active = true;
    if (!hasSyncedPublicSettings()) setPaymentSettingsStatus("loading");
    syncCatalogFromServer().then((synced) => {
      if (active) setPaymentSettingsStatus(synced ? "ready" : "unavailable");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const terminal = ["DELIVERED", "CANCELLED"].includes(state.order?.stage);
    if (state.status !== "ok" || terminal) return undefined;
    const refreshVisibleOrder = () => {
      if (document.visibilityState === "visible") loadOrder();
    };
    const interval = window.setInterval(refreshVisibleOrder, 15000);
    window.addEventListener("focus", refreshVisibleOrder);
    document.addEventListener("visibilitychange", refreshVisibleOrder);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisibleOrder);
      document.removeEventListener("visibilitychange", refreshVisibleOrder);
    };
  }, [loadOrder, state.order?.stage, state.status]);

  useEffect(() => {
    if (state.status !== "ok" || address !== null) return;
    const saved = state.order.summary?.shippingAddress || null;
    const prefill = saved || state.order.defaultShippingAddress || null; // 회원 프로필 기본 배송지 프리필
    setAddress({ ...EMPTY_ADDRESS, ...(prefill || {}) });
    setAddressSaved(Boolean(saved && isShippingAddressComplete(saved)));
  }, [state, address]);

  async function saveAddress() {
    if (addressSaving) return;
    setAddressSaving(true);
    setAddressError("");
    try {
      await apiFetch(`/orders/${orderCode}/shipping-address`, { method: "POST", body: address });
      setAddressSaved(true);
      setAddressDirty(false);
      await loadOrder();
    } catch {
      setAddressError(mc.saveFailed);
    } finally {
      setAddressSaving(false);
    }
  }

  function changeAddress(next) {
    setAddress(next);
    setAddressDirty(true);
    setAddressError("");
  }

  function copyTracking(value) {
    try { navigator.clipboard?.writeText(value); } catch { /* 클립보드 미지원 */ }
    setCopiedTracking(true);
    window.setTimeout(() => setCopiedTracking(false), 1600);
  }

  async function doCancel(reason) {
    if (cancelBusy) return;
    setCancelBusy(true);
    setMutationError("");
    try {
      await apiFetch(`/orders/${orderCode}/cancel`, { method: "POST", body: { reason } });
      setCancelOpen(false);
      setCancelMsg("");
      await loadOrder();
    } catch {
      setMutationError(mc.cancelFailed);
    } finally {
      setCancelBusy(false);
    }
  }

  async function reportPayment(kind) {
    await apiFetch(`/orders/${orderCode}/payment-reported`, { method: "POST", body: { kind } });
    await loadOrder();
  }

  async function respond(action, response, extra = {}) {
    if (pendingAction) return;
    setPendingAction(`${action.id}:${response}`);
    setMutationError("");
    try {
      await apiFetch(`/actions/${action.id}/respond`, {
        method: "POST",
        body: { response, expectedSubjectVersionId: action.subjectVersionId, ...extra },
      });
      setRespondedId(action.id);
      setChangeMode(false);
      setChangeMsg("");
      setChangeMedia([]);
      setChangeUploadError("");
      await loadOrder();
    } catch {
      setMutationError(mc.actionFailed);
      await loadOrder();
    } finally {
      setPendingAction("");
    }
  }

  if (state.status === "loading") {
    return <div className="page page-narrow"><p className="form-hint" role="status">{t.loading}</p></div>;
  }

  if (state.status !== "ok") {
    const copy = state.status === "signin"
      ? { title: t.signInTitle, body: t.signInBody }
      : state.status === "denied"
        ? { title: t.deniedTitle, body: t.deniedBody }
        : { title: t.unavailableTitle, body: t.unavailableBody };
    return (
      <div className="page page-narrow">
        <h1 className="page-title">{copy.title}</h1>
        <div className="panel form-stack">
          <p className="form-hint">{copy.body}</p>
          {state.status !== "unavailable" && (
            <Link className="button primary" to={LOGIN_FOR.customer} state={{ from: location.pathname }}>{t.signInCta}</Link>
          )}
        </div>
      </div>
    );
  }

  const order = state.order;
  const action = order.nextAction && order.nextAction.status === "OPEN" ? order.nextAction : null;

  // 결제 단계 도출 — 제안 승인 후(stage QUOTE)엔 디파짓, stage BALANCE면 잔금 카드
  const quoteArt = (order.publishedArtifacts || [])
    .filter((a) => a.type === "QUOTE")
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0] || null;
  const qp = quoteArt?.payload || {};
  const payTotal = qp.totalUsd > 0 ? qp.totalUsd : null;
  const payDeposit = configuredDeposit(payTotal, qp.depositUsd);
  const latestQuoteAction = (order.actions || [])
    .filter((item) => item.kind === "QUOTE_ACCEPTANCE")
    .sort((a, b) => new Date(b.respondedAt || b.createdAt || 0) - new Date(a.respondedAt || a.createdAt || 0))[0] || null;
  const quoteApproved = latestQuoteAction?.status === "RESPONDED" && latestQuoteAction.response === "APPROVE";
  const reportedKinds = new Set(
    order.timeline.filter((e) => e.payload?.type === "payment_reported").map((e) => e.payload?.data?.kind || "deposit"),
  );
  const showDeposit = Boolean(payTotal && (order.stage === "DEPOSIT" || (quoteApproved && order.stage === "QUOTE")));
  const showBalance = Boolean(payTotal && order.stage === "BALANCE");
  const STAGE_SEQ = ["OPS_REVIEW", "STONE_SELECTION", "QUOTE", "DEPOSIT", "CAD", "PRODUCTION", "FINAL_QC", "BALANCE", "SHIPPING", "DELIVERED"];
  const stageIdx = STAGE_SEQ.indexOf(order.stage);
  const pastQuote = stageIdx > STAGE_SEQ.indexOf("QUOTE");
  const quoteAction = action?.kind === "QUOTE_ACCEPTANCE" ? action : null;
  const otherAction = action && !quoteAction ? action : null;
  const depositReported = reportedKinds.has("deposit");
  const balanceReported = reportedKinds.has("balance");
  // 체크포인트 상태 — active(고객 차례) / waiting(BeloveD 차례) / done / upcoming
  const proposalState = quoteAction ? "active" : !quoteArt ? "waiting" : (quoteApproved || pastQuote) ? "done" : "waiting";
  const depositState = !payTotal ? null : showDeposit ? (depositReported ? "waiting" : "active") : pastQuote ? "done" : "upcoming";
  // 취소 정책 — 디파짓 확인 전: 즉시 / 제작 중: 요청(정책 환불) / 완성 후: 불가
  const cancelled = order.stage === "CANCELLED";
  const cancelRequested = order.timeline.some((e) => e.payload?.type === "cancel_requested");
  const cancelMode = ["OPS_REVIEW", "STONE_SELECTION", "QUOTE", "DEPOSIT"].includes(order.stage)
    ? "direct"
    : ["CAD", "PRODUCTION"].includes(order.stage) ? "request" : null;
  // 배송 단계 — shipped 이벤트에 실린 운송장 번호를 꺼내 보여준다
  const trackingNo = order.timeline.find((e) => e.payload?.type === "shipped" && e.payload?.data?.tracking)?.payload.data.tracking || null;
  const shipmentVisible = stageIdx >= STAGE_SEQ.indexOf("SHIPPING");
  const balanceVisible = Boolean(payTotal) && stageIdx >= STAGE_SEQ.indexOf("BALANCE");
  const balanceConfirmed = order.timeline.some((e) => e.payload?.type === "balance_confirmed");
  const balanceState = balanceConfirmed || stageIdx > STAGE_SEQ.indexOf("BALANCE")
    ? "done"
    : balanceReported ? "waiting" : "active";
  const shippingLocked = ["SHIPPING", "DELIVERED", "CANCELLED"].includes(order.stage);
  const addressReady = addressSaved && !addressDirty;
  // 컨펌 버튼 ↔ 수정요청 폼 (메시지+첨부) — 제안·완성품 QC 공용
  const renderDecision = (act) => (changeMode ? (
    <div className="form-stack" style={{ marginTop: 12 }}>
      <label className="field"><span>{t.changesTitle}</span>
        <textarea
          rows={3}
          value={changeMsg}
          placeholder={t.changesPlaceholder}
          onChange={(e) => setChangeMsg(e.target.value)}
          autoFocus
        />
      </label>
      <div className="field"><span>{t.changesAttach}</span>
        <MediaPicker
          value={changeMedia}
          onChange={setChangeMedia}
          onBusyChange={setChangeUploadBusy}
          onErrorChange={setChangeUploadError}
          maxItems={5}
          showSamples={false}
          previewMode="list"
          remoteRequired
        />
      </div>
      <div className="customer-decision-actions">
        <button
          className="button primary"
          type="button"
          disabled={!changeMsg.trim() || changeUploadBusy || Boolean(changeUploadError) || Boolean(pendingAction)}
          aria-busy={Boolean(pendingAction)}
          onClick={() => respond(act, "REQUEST_CHANGES", {
            message: changeMsg.trim(),
            media: changeMedia.filter((m) => /^https?:\/\//.test(m.src || "")).slice(0, 5),
          })}
        >
          {pendingAction ? mc.responding : t.changesSend}
        </button>
        <button className="button secondary" type="button" disabled={Boolean(pendingAction) || changeUploadBusy} onClick={() => { setChangeMode(false); setChangeMsg(""); setChangeMedia([]); setChangeUploadError(""); setMutationError(""); }}>
          {t.changesCancel}
        </button>
      </div>
    </div>
  ) : (
    <div className="customer-decision-actions" style={{ marginTop: 14 }}>
      {(act.allowedResponses?.length ? act.allowedResponses : ["CONFIRM"]).map((response, i) => (
        <button
          key={response}
          className={`button ${i === 0 ? "primary" : "secondary"}`}
          type="button"
          disabled={Boolean(pendingAction)}
          aria-busy={pendingAction === `${act.id}:${response}`}
          onClick={() => (response === "REQUEST_CHANGES" ? setChangeMode(true) : respond(act, response))}
        >
          {pendingAction === `${act.id}:${response}` ? mc.responding : (t.respond[response] || response)}
        </button>
      ))}
    </div>
  ));

  const waitingLine = cancelled
    ? t.cancelledLine
    : showDeposit && !depositReported
      ? t.waitingDeposit
    : showBalance && !balanceReported && !balanceConfirmed
      ? t.waitingBalance
      : t.waiting[order.waitingOn] || "";

  return (
    <div className="page client-portal-page">
      <section className="client-actionbar">
        <div className="client-actionbar-copy">
          <p className="section-label">{t.kicker}</p>
          <strong>{waitingLine}</strong>
        </div>
        <div className="client-actionbar-meta">
          <span>{order.orderCode}</span>
          <span className={`status-badge ${["DELIVERED", "CANCELLED"].includes(order.stage) ? "mst-done" : "mst-inProgress"}`}>{t.stages[order.stage] || order.stage}</span>
        </div>
      </section>

      {mutationError && <p className="client-action-notice is-error" role="alert">{mutationError}</p>}

      {/* 여정 4단계 레일 */}
      <section className="client-confirm-rail" aria-label={t.kicker}>
        {(order.phases || []).map((phase, index) => {
          const phaseDone = order.stage === "DELIVERED" || phase.state === "complete";
          return (
            <article className={`client-confirm-step ${phaseDone ? "done" : phase.state}`} key={phase.key}>
              <span className="client-confirm-index">{phaseDone ? "✓" : String(index + 1).padStart(2, "0")}</span>
              <div><strong>{t.phases[phase.key] || phase.title}</strong></div>
            </article>
          );
        })}
      </section>

      {!cancelled && (<>
      {/* 01 제안 — 준비 중 안내 → 오더시트 카드 + 컨펌. 승인되면 접힘(done) */}
      <Checkpoint id="bd-proposal" index="1-1" title={fc.proposalKicker} state={proposalState}
        summary={payTotal ? usd(payTotal) : ""}>
        {quoteArt ? (
          <>
            <ServerProposalCard pay={qp} media={quoteArt.media} fc={fc} t={t} shapes={p.shapes} />
            {quoteAction && renderDecision(quoteAction)}
          </>
        ) : (
          <div style={{ marginTop: 6 }}>
            <strong style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{fc.preparingTitle}</strong>
            <p className="form-hint" style={{ margin: "6px 0 0" }}>{fc.preparingBody}</p>
          </div>
        )}
      </Checkpoint>
      {respondedId && !action && <p className="client-action-notice" role="status">{t.responded}</p>}

      {/* 02 디파짓 — 승인 즉시 열림: 결제 카드 + 배송지 */}
      {depositState && (
        <Checkpoint id="bd-deposit" index="1-2" title={fc.payTitle} state={depositState} summary={usd(payDeposit)}>
          {/* 배송지 먼저, 결제는 그 다음 — 주소를 안 적고 송금 보고하는 사고 방지 (체크아웃 관례) */}
          {address && (
            <ShippingAddressPanel
              value={address}
              onChange={changeAddress}
              t={p.portal}
              locked={shippingLocked}
              saved={addressReady}
              saving={addressSaving}
              error={addressError}
              canSave={!shippingLocked && (!addressReady || addressDirty)}
              onSave={saveAddress}
            />
          )}
          <PaymentCard
            amountUsd={payDeposit}
            amountLabel={fc.depositToday}
            amountContext={`${fc.totalLabel} ${usd(payTotal)} · ${fc.balanceShip} ${usd(payTotal - payDeposit)}`}
            memoText={`BeloveD ${order.orderCode} Deposit`}
            reported={depositReported}
            fc={fc}
            sentCta={fc.depositSentCta}
            reportedNote={fc.reportedNote}
            onReport={() => reportPayment("deposit")}
            reportDisabled={!addressReady}
            reportHint={t.addressGate}
            settingsStatus={paymentSettingsStatus}
          />
        </Checkpoint>
      )}

      {/* 03 잔금 — BALANCE 단계부터 */}
      {balanceVisible && (
        <Checkpoint id="bd-balance" index="3-1" title={fc.balanceTitle} state={balanceState} summary={usd(payTotal - payDeposit)}>
          <PaymentCard
            amountUsd={payTotal - payDeposit}
            amountLabel={fc.balanceShip}
            amountContext={`${fc.totalLabel} ${usd(payTotal)} · ${fc.doneBadge} ${usd(payDeposit)}`}
            memoText={`BeloveD ${order.orderCode} Balance`}
            reported={balanceReported}
            fc={fc}
            sentCta={fc.balanceSentCta}
            reportedNote={fc.balanceReportedNote}
            onReport={() => reportPayment("balance")}
            reportDisabled={!addressReady}
            reportHint={t.addressGate}
            settingsStatus={paymentSettingsStatus}
          />
        </Checkpoint>
      )}

      {/* 디파짓 이후에도 발송 전까지 저장된 배송지를 수정·재저장할 수 있다. */}
      {address && ["CAD", "PRODUCTION", "FINAL_QC", "BALANCE"].includes(order.stage) && (
        <section className="panel form-stack">
          <ShippingAddressPanel
            value={address}
            onChange={changeAddress}
            t={p.portal}
            locked={false}
            saved={addressReady}
            saving={addressSaving}
            error={addressError}
            canSave={!addressReady || addressDirty}
            onSave={saveAddress}
          />
        </section>
      )}

      {/* 3-2 배송 — 운송장 번호 (배송 중·수령 완료 모두 표시) */}
      {shipmentVisible && (
        <Checkpoint
          id="bd-shipment"
          index="3-2"
          title={t.shipmentTitle}
          state={order.stage === "DELIVERED" ? "done" : "active"}
          summary={order.stage === "DELIVERED" ? (trackingNo || t.stages.DELIVERED) : undefined}
          badgeOverride={t.stages[order.stage] || order.stage}
        >
          {trackingNo && (
            <div className="payment-memo-block" style={{ marginTop: 12 }}>
              <span className="payment-memo-label">{t.trackingLabel}</span>
              <button
                className={`payment-memo-pill ${copiedTracking ? "is-copied" : ""}`}
                type="button"
                onClick={() => copyTracking(trackingNo)}
              >
                <strong>{trackingNo}</strong>
                <em>{copiedTracking ? fc.copiedBtn : fc.copyBtn}</em>
              </button>
            </div>
          )}
          <p className="form-hint" style={{ margin: "10px 0 0", textAlign: "center" }}>{t.shipmentNote}</p>
        </Checkpoint>
      )}

      {/* 기타 열린 컨펌 (완성품 QC 등) — 판단 근거(QC 사진·노트)를 버튼과 같은 카드에 보여준다 */}
      {otherAction && (() => {
        // 컨펌 종류에 대응하는 최신 아티팩트 — FINAL_QC_CONFIRMATION → QC 미디어
        const subjectType = otherAction.kind === "FINAL_QC_CONFIRMATION" ? "QC" : null;
        const subject = subjectType
          ? (order.publishedArtifacts || [])
            .filter((a) => a.type === subjectType)
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0] || null
          : null;
        return (
          <Checkpoint
            id="bd-action"
            index="2-1"
            title={t.kinds[otherAction.kind] || otherAction.title || t.nextTitle}
            state="active"
            badgeOverride={t.nextTitle}
          >
            {subject?.media?.length > 0 && (
              <div className="qc-media-viewer">
                <ClientMediaCarousel
                  media={subject.media}
                  alt={subject.versionLabel || t.kinds[otherAction.kind]}
                  ratio="16 / 10"
                  fit="contain"
                  enableLightbox
                  zoomLabel={mc.zoom}
                  closeLabel={mc.closeZoom}
                />
              </div>
            )}
            {subject?.payload?.note && <p className="form-hint" style={{ margin: "10px 0 0" }}>{subject.payload.note}</p>}
            {otherAction.description && <p className="form-hint">{otherAction.description}</p>}
            {renderDecision(otherAction)}
          </Checkpoint>
        );
      })()}

      {/* 공유 자료 — 비-QUOTE 아티팩트(QC 미디어 등), 타입별 최신만. 열린 컨펌 카드에 이미 보인 것은 중복 노출 안 함 */}
      {Object.values((order.publishedArtifacts || []).reduce((acc, a) => {
        const prev = acc[a.type];
        if (!prev || new Date(a.publishedAt) > new Date(prev.publishedAt)) acc[a.type] = a;
        return acc;
      }, {})).map((a) => {
        if (a.type === "QUOTE") return null;
        if (otherAction?.kind === "FINAL_QC_CONFIRMATION" && a.type === "QC") return null;
        const pay = a.payload || {};
        const hasContent = a.media?.length || pay.note;
        if (!hasContent) return null;
        return (
          <section className="panel form-stack" key={a.id}>
            <p className="section-label">{t.artifactsTitle}</p>
            {a.media?.length > 0 && (
              a.type === "QC" ? (
                <div className="qc-media-viewer">
                  <ClientMediaCarousel
                    media={a.media}
                    alt={a.versionLabel || t.artifactsTitle}
                    ratio="16 / 10"
                    fit="contain"
                    enableLightbox
                    zoomLabel={mc.zoom}
                    closeLabel={mc.closeZoom}
                  />
                </div>
              ) : (
                <div className="card-grid cols-3">
                  {a.media.map((m, i) => <MediaThumb key={i} media={m} alt={a.versionLabel} ratio="1 / 1" />)}
                </div>
              )
            )}
            {pay.note && <p className="form-hint" style={{ margin: 0 }}>{pay.note}</p>}
          </section>
        );
      })}

      {/* 취소 — 정책 단계별: 즉시 취소 / 취소 요청 / (완성 후엔 노출 안 함) */}
      {cancelMode && (
        <section className="panel form-stack">
          {cancelRequested ? (
            <p className="form-hint" style={{ margin: 0, textAlign: "center" }}>{t.cancelRequestedNote}</p>
          ) : cancelOpen ? (
            <>
              <p className="form-hint" style={{ margin: 0 }}>
                {cancelMode === "direct" ? t.cancelPolicyFree : t.cancelPolicyPartial}
              </p>
              <label className="field"><span>{t.cancelReason}</span>
                <textarea rows={2} value={cancelMsg} onChange={(e) => setCancelMsg(e.target.value)} autoFocus />
              </label>
              <div className="customer-decision-actions">
                <button className="button primary" type="button" disabled={cancelBusy} onClick={() => { setCancelOpen(false); setMutationError(""); }}>{t.cancelKeep}</button>
                <button className="button secondary" type="button" disabled={cancelBusy} aria-busy={cancelBusy} onClick={() => doCancel(cancelMsg.trim())}>
                  {cancelBusy ? mc.cancelling : t.cancelConfirm}
                </button>
              </div>
            </>
          ) : (
            <button
              className="text-link"
              type="button"
              style={{ justifySelf: "center", margin: "0 auto", color: "var(--quiet)", fontSize: 12.5 }}
              onClick={() => { setCancelOpen(true); setMutationError(""); }}
            >
              {cancelMode === "direct" ? t.cancelLink : t.cancelRequestLink}
            </button>
          )}
        </section>
      )}
      </>)}

      {/* 결제 내역(영수증) — summary.payments가 단일 소스 (deposit/balance_confirmed 이벤트가 기록, 메일 영수증과 동일 숫자) */}
      {Array.isArray(order.summary?.payments) && order.summary.payments.length > 0 && (
        <section className="panel">
          <p className="section-label">{t.receiptsTitle}</p>
          <div style={{ display: "grid", gap: 0 }}>
            {order.summary.payments.map((pmt) => (
              <div key={pmt.kind} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--hair)" }}>
                <div>
                  <strong style={{ fontSize: 14 }}>✓ {pmt.kind === "balance_confirmed" ? t.receiptBalance : t.receiptDeposit}</strong>
                  <p className="form-hint" style={{ margin: "2px 0 0" }}>{fmtDate(pmt.at, locale)}</p>
                </div>
                <strong style={{ whiteSpace: "nowrap" }}>{usd(pmt.amountUsd)}</strong>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0 0" }}>
              <span className="form-hint">{t.receiptPaidTotal}</span>
              <strong>{usd(order.summary.payments.reduce((s, x) => s + (Number(x.amountUsd) || 0), 0))}</strong>
            </div>
          </div>
        </section>
      )}

      {/* 타임라인 */}
      <section className="panel">
        <p className="section-label">{t.timelineTitle}</p>
        <div className="client-brief-list" style={{ display: "grid", gap: 0 }}>
          {order.timeline
            // 이벤트명 현지화 (서버는 원시 타입을 title로 기록) + 같은 이벤트 연속 중복은 최신 1건만
            .map((event) => ({ ...event, label: t.events[event.payload?.type] || t.events[event.title] || event.title }))
            .filter((event, i, arr) => i === 0 || event.label !== arr[i - 1].label)
            .map((event) => (
              <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--hair)" }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{event.label}</strong>
                  {event.body && <p className="form-hint" style={{ margin: "2px 0 0" }}>{event.body}</p>}
                </div>
                <span className="form-hint" style={{ whiteSpace: "nowrap" }}>{fmtDate(event.createdAt, locale)}</span>
              </div>
            ))}
        </div>
      </section>

      <p className="form-hint" style={{ textAlign: "center" }}>{t.emailTail}</p>
    </div>
  );
}
