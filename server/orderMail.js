// 주문 상태 메일 — 이벤트 10종 × 4개 언어. 언어는 제출 시 저장된 customers.locale.
// 발송은 항상 커밋/응답 후 fire-and-forget — 실패는 로그만 남긴다 (스펙 §5).
import { sendOrderMail } from "./mailer.js";

// 발신 주소가 no-reply라 "이 메일에 회신" 안내는 금지 — 문의는 support 주소로만 안내한다.
// ignore는 주문용 면책 문구 — wrap()에 넘겨 로케일당 한 번만 붙는다 (고정 영어 문구와의 이중 표기 금지).
const SUPPORT_EMAIL = "support@belovediamond.com";
const CHROME = {
  en: { cta: "VIEW YOUR ORDER", tail: `Questions? Email us at ${SUPPORT_EMAIL}.`, ignore: "If you don't recognize this order, you can ignore this email." },
  ko: { cta: "주문 확인하기", tail: `궁금한 점은 ${SUPPORT_EMAIL}으로 문의해 주세요.`, ignore: "이 주문을 기억하지 못하시면 이 메일을 무시하셔도 됩니다." },
  zh: { cta: "查看订单", tail: `如有疑问，请致信 ${SUPPORT_EMAIL}。`, ignore: "如果您不记得此订单，可以忽略此邮件。" },
  es: { cta: "VER TU PEDIDO", tail: `¿Preguntas? Escríbenos a ${SUPPORT_EMAIL}.`, ignore: "Si no reconoces este pedido, puedes ignorar este correo." },
};

export { CHROME };

// 고객 여정 6단계 — 상태 메일마다 전체 여정 중 현재 위치를 화살표 스트립으로 보여준다.
// 포털 마일스톤(13종)보다 굵은 단위: 메일에서는 "전체 중 어디까지 왔나"만 한눈에 보이면 된다.
const JOURNEY = ["request", "proposal", "design", "crafting", "finalCheck", "delivery"];
export const JOURNEY_LABELS = {
  en: { request: "Request", proposal: "Proposal", design: "Design", crafting: "Crafting", finalCheck: "Final check", delivery: "Delivery", progress: (n, total) => `Order progress — step ${n} of ${total}` },
  ko: { request: "접수", proposal: "제안", design: "디자인", crafting: "제작", finalCheck: "최종 확인", delivery: "배송", progress: (n, total) => `주문 진행 — ${total}단계 중 ${n}단계` },
  zh: { request: "接单", proposal: "方案", design: "设计", crafting: "制作", finalCheck: "终检", delivery: "配送", progress: (n, total) => `订单进度 — 共 ${total} 步 · 第 ${n} 步` },
  es: { request: "Solicitud", proposal: "Propuesta", design: "Diseño", crafting: "Fabricación", finalCheck: "Revisión final", delivery: "Entrega", progress: (n, total) => `Progreso del pedido — paso ${n} de ${total}` },
};
// 이벤트 → 여정 단계. 취소 계열은 매핑하지 않는다 — 취소 메일에 진행 스트립은 어울리지 않는다.
const EVENT_STAGE = {
  received: "request",
  proposal_sent: "proposal",
  deposit_confirmed: "design", diamond_locked: "design", cad_ready: "design",
  production_started: "crafting",
  qc_ready: "finalCheck", balance_requested: "finalCheck", balance_confirmed: "finalCheck",
  shipped: "delivery", delivered: "delivery",
};

// 결제 영수증 라벨 — deposit_confirmed/balance_confirmed 메일에 금액 내역을 싣는다
export const RECEIPT_LABELS = {
  en: { title: "Payment receipt", deposit_confirmed: "Deposit", balance_confirmed: "Balance payment", amount: "Amount received", total: "Order total", remaining: "Remaining balance", paidFull: "Paid in full" },
  ko: { title: "결제 영수증", deposit_confirmed: "디파짓", balance_confirmed: "잔금", amount: "결제 금액", total: "주문 총액", remaining: "남은 금액", paidFull: "완납" },
  zh: { title: "付款收据", deposit_confirmed: "定金", balance_confirmed: "尾款", amount: "已收金额", total: "订单总额", remaining: "剩余金额", paidFull: "已付清" },
  es: { title: "Recibo de pago", deposit_confirmed: "Depósito", balance_confirmed: "Saldo", amount: "Importe recibido", total: "Total del pedido", remaining: "Saldo restante", paidFull: "Pagado por completo" },
};

const usdFmt = (n) => `$${Number(n).toLocaleString("en-US")}`;

// 결제 확인 메일의 영수증 블록 — 헤어라인 박스 + 금액 행. 남은 금액 0이면 "완납"으로 표기.
export function receiptBlock(receipt, loc) {
  if (!receipt || !(Number(receipt.amountUsd) > 0)) return "";
  const L = RECEIPT_LABELS[loc] || RECEIPT_LABELS.en;
  const kindLabel = L[receipt.kind] || L.deposit_confirmed;
  const row = (label, value, strong = false) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#8e897e">${label}</td>
        <td style="padding:6px 0;font-size:13px;text-align:right;${strong ? "font-weight:700;" : ""}color:#15130f">${value}</td>
      </tr>`;
  const remaining = receipt.remainingUsd === null || receipt.remainingUsd === undefined
    ? ""
    : row(L.remaining, receipt.remainingUsd > 0 ? usdFmt(receipt.remainingUsd) : L.paidFull);
  return `
    <div style="border:1px solid #e4e0d6;padding:14px 18px;margin:20px 0 0">
      <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8e897e;margin:0 0 4px">${L.title}</p>
      <table style="width:100%;border-collapse:collapse">
        ${row(kindLabel, usdFmt(receipt.amountUsd), true)}${receipt.totalUsd ? row(L.total, usdFmt(receipt.totalUsd)) : ""}${remaining}
      </table>
    </div>`;
}

// 이메일 클라이언트 호환을 위해 인라인 스타일 + 텍스트 화살표만 사용 (flex/grid 금지).
// 완료 ✓(잉크) → 현재 ●(샴페인 볼드) → 남은 단계(회색). delivered는 전 단계 완료로 표시.
export function journeyStrip(type, loc) {
  const stageKey = EVENT_STAGE[type];
  if (!stageKey) return "";
  const L = JOURNEY_LABELS[loc] || JOURNEY_LABELS.en;
  const cur = JOURNEY.indexOf(stageKey);
  const allDone = type === "delivered";
  const parts = JOURNEY.map((k, i) => {
    if (i < cur || (i === cur && allDone)) return `<span style="color:#15130f;white-space:nowrap">✓ ${L[k]}</span>`;
    if (i === cur) return `<strong style="color:#8f7d54;white-space:nowrap">● ${L[k]}</strong>`;
    return `<span style="color:#b9b4a9;white-space:nowrap">${L[k]}</span>`;
  });
  return `
    <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8e897e;margin:22px 0 8px">${L.progress(cur + 1, JOURNEY.length)}</p>
    <p style="font-size:13px;line-height:2;margin:0 0 6px">${parts.join(' <span style="color:#b9b4a9">→</span> ')}</p>`;
}

export const ORDER_MAIL = {
  received: {
    en: { subject: (o) => `We received your request — ${o}`, line: () => "Your custom request is in. Our team is reviewing it and will follow up with a proposal shortly." },
    ko: { subject: (o) => `요청이 접수되었습니다 — ${o}`, line: () => "커스텀 요청이 접수되었습니다. 팀이 검토 후 곧 제안을 보내드릴게요." },
    zh: { subject: (o) => `我们已收到您的请求 — ${o}`, line: () => "您的定制请求已收到，团队审核后会尽快发送方案。" },
    es: { subject: (o) => `Recibimos tu solicitud — ${o}`, line: () => "Tu solicitud está registrada. Nuestro equipo la revisará y te enviará una propuesta pronto." },
  },
  proposal_sent: {
    en: { subject: (o) => `Your proposal is ready — ${o}`, line: () => "Your proposal and quote are ready in your portal. Review and confirm to move ahead." },
    ko: { subject: (o) => `제안서가 도착했습니다 — ${o}`, line: () => "제안과 견적이 포털에 준비되었습니다. 확인 후 진행을 승인해 주세요." },
    zh: { subject: (o) => `您的方案已就绪 — ${o}`, line: () => "方案与报价已在您的订单页面就绪，请查看并确认。" },
    es: { subject: (o) => `Tu propuesta está lista — ${o}`, line: () => "Tu propuesta y cotización están en tu portal. Revísalas y confirma para avanzar." },
  },
  deposit_confirmed: {
    en: { subject: (o) => `Deposit received — ${o}`, line: () => "We confirmed your deposit. Your stone is being secured and design work begins now." },
    ko: { subject: (o) => `입금이 확인되었습니다 — ${o}`, line: () => "디파짓 입금이 확인되었습니다. 스톤 확보와 디자인 작업이 시작됩니다." },
    zh: { subject: (o) => `已确认收到定金 — ${o}`, line: () => "定金已确认，我们将锁定钻石并开始设计。" },
    es: { subject: (o) => `Depósito recibido — ${o}`, line: () => "Confirmamos tu depósito. Aseguramos tu piedra y comienza el diseño." },
  },
  diamond_locked: {
    en: { subject: (o) => `Your diamond is secured — ${o}`, line: (o, d) => `Your certified stone${d.igi ? ` (IGI ${d.igi})` : ""} is secured for your order.` },
    ko: { subject: (o) => `다이아몬드가 확보되었습니다 — ${o}`, line: (o, d) => `주문하신 인증 다이아몬드${d.igi ? ` (IGI ${d.igi})` : ""}가 확보되었습니다.` },
    zh: { subject: (o) => `您的钻石已锁定 — ${o}`, line: (o, d) => `您的认证钻石${d.igi ? `（IGI ${d.igi}）` : ""}已为订单锁定。` },
    es: { subject: (o) => `Tu diamante está asegurado — ${o}`, line: (o, d) => `Tu piedra certificada${d.igi ? ` (IGI ${d.igi})` : ""} está asegurada para tu pedido.` },
  },
  cad_ready: {
    en: { subject: (o) => `Your design is ready for review — ${o}`, line: () => "The 3D design (CAD) of your piece is ready. Review it in your portal and approve or request changes." },
    ko: { subject: (o) => `디자인 승인을 기다립니다 — ${o}`, line: () => "3D 디자인(CAD)이 준비되었습니다. 포털에서 확인하고 승인하거나 수정을 요청해 주세요." },
    zh: { subject: (o) => `您的设计已就绪，待您确认 — ${o}`, line: () => "作品的 3D 设计（CAD）已完成，请在订单页面查看并确认或提出修改。" },
    es: { subject: (o) => `Tu diseño está listo para revisar — ${o}`, line: () => "El diseño 3D (CAD) de tu pieza está listo. Revísalo en tu portal y apruébalo o pide cambios." },
  },
  production_started: {
    en: { subject: (o) => `Crafting has begun — ${o}`, line: () => "Your piece is now in production. We'll share quality-check media when it's finished." },
    ko: { subject: (o) => `제작이 시작되었습니다 — ${o}`, line: () => "제작이 시작되었습니다. 완성되면 품질 확인 사진·영상을 보내드릴게요." },
    zh: { subject: (o) => `已开始制作 — ${o}`, line: () => "您的作品已进入制作阶段，完成后我们会发送质检照片与视频。" },
    es: { subject: (o) => `La fabricación ha comenzado — ${o}`, line: () => "Tu pieza está en producción. Compartiremos el material de control de calidad al terminar." },
  },
  qc_ready: {
    en: { subject: (o) => `Your finished piece is ready to view — ${o}`, line: () => "Your finished piece passed our checks. Review the final photos and video in your portal and confirm." },
    ko: { subject: (o) => `완성품이 준비되었습니다 — ${o}`, line: () => "완성품이 준비되었습니다. 포털에서 최종 사진·영상을 확인하고 컨펌해 주세요." },
    zh: { subject: (o) => `成品已就绪，请查看 — ${o}`, line: () => "您的成品已完成质检，请在订单页面查看最终照片与视频并确认。" },
    es: { subject: (o) => `Tu pieza terminada está lista — ${o}`, line: () => "Tu pieza terminada pasó nuestras revisiones. Mira las fotos y el video final en tu portal y confirma." },
  },
  balance_requested: {
    en: { subject: (o) => `Balance due — ${o}`, line: () => "Your piece passed final QC. Settle the remaining balance in your portal to start shipping." },
    ko: { subject: (o) => `잔금 안내 — ${o}`, line: () => "최종 확인이 끝났습니다. 포털에서 잔금을 결제해 주시면 배송을 시작합니다." },
    zh: { subject: (o) => `请支付尾款 — ${o}`, line: () => "成品已通过最终质检，请在订单页面支付尾款后我们将安排发货。" },
    es: { subject: (o) => `Saldo pendiente — ${o}`, line: () => "Tu pieza pasó el control final. Paga el saldo restante en tu portal para iniciar el envío." },
  },
  order_cancelled: {
    en: { subject: (o) => `Order cancelled — ${o}`, line: (o, d) => `Your order has been cancelled.${d.refundNote ? ` ${d.refundNote}` : ""} If this wasn't intended, contact us at ${SUPPORT_EMAIL}.` },
    ko: { subject: (o) => `주문 취소 완료 — ${o}`, line: (o, d) => `주문이 취소되었습니다.${d.refundNote ? ` ${d.refundNote}` : ""} 의도치 않은 취소라면 ${SUPPORT_EMAIL}으로 알려주세요.` },
    zh: { subject: (o) => `订单已取消 — ${o}`, line: (o, d) => `您的订单已取消。${d.refundNote ? `${d.refundNote} ` : ""}如非本意，请联系 ${SUPPORT_EMAIL}。` },
    es: { subject: (o) => `Pedido cancelado — ${o}`, line: (o, d) => `Tu pedido ha sido cancelado.${d.refundNote ? ` ${d.refundNote}` : ""} Si no fue intencional, escríbenos a ${SUPPORT_EMAIL}.` },
  },
  cancel_requested: {
    en: { subject: (o) => `Cancellation request received — ${o}`, line: () => "We received your cancellation request. Since production has begun, refunds follow our policy — we will contact you within 1 business day with the details." },
    ko: { subject: (o) => `취소 요청 접수 — ${o}`, line: () => "취소 요청이 접수되었습니다. 제작이 시작된 주문은 정책에 따라 부분 환불이 적용되며, 영업일 1일 내 환불 내용을 안내드리겠습니다." },
    zh: { subject: (o) => `已收到取消请求 — ${o}`, line: () => "我们已收到您的取消请求。由于制作已开始，退款将按政策执行 — 我们将在 1 个工作日内与您联系。" },
    es: { subject: (o) => `Solicitud de cancelación recibida — ${o}`, line: () => "Recibimos tu solicitud de cancelación. Como la producción ya comenzó, los reembolsos siguen nuestra política — te contactaremos en 1 día hábil." },
  },
  balance_confirmed: {
    en: { subject: (o) => `Balance received — ${o}`, line: () => "Your balance is confirmed. We are preparing your insured shipment and will send tracking shortly." },
    ko: { subject: (o) => `잔금 확인 완료 — ${o}`, line: () => "잔금 입금이 확인되었습니다. 보험 배송을 준비 중이며 곧 운송장 번호를 보내드립니다." },
    zh: { subject: (o) => `尾款已确认 — ${o}`, line: () => "已确认您的尾款。我们正在准备全程保险配送，运单号稍后发送。" },
    es: { subject: (o) => `Saldo recibido — ${o}`, line: () => "Tu saldo está confirmado. Estamos preparando tu envío asegurado y enviaremos la guía en breve." },
  },
  shipped: {
    en: { subject: (o) => `Your order is on its way — ${o}`, line: (o, d) => `Your piece has shipped${d.tracking ? ` — tracking ${d.tracking}` : ""}. Delivery is fully insured.` },
    ko: { subject: (o) => `발송되었습니다 — ${o}`, line: (o, d) => `주문하신 제품이 발송되었습니다${d.tracking ? ` — 운송장 ${d.tracking}` : ""}. 전 구간 보험이 적용됩니다.` },
    zh: { subject: (o) => `您的订单已发货 — ${o}`, line: (o, d) => `您的作品已发出${d.tracking ? `——运单号 ${d.tracking}` : ""}，全程保险。` },
    es: { subject: (o) => `Tu pedido está en camino — ${o}`, line: (o, d) => `Tu pieza fue enviada${d.tracking ? ` — guía ${d.tracking}` : ""}. El envío está totalmente asegurado.` },
  },
  delivered: {
    en: { subject: (o) => `Delivered — enjoy your piece — ${o}`, line: () => "Your order shows as delivered. We'd love to see it on you — leave a review anytime." },
    ko: { subject: (o) => `배송이 완료되었습니다 — ${o}`, line: () => "배송이 완료되었습니다. 착용샷과 함께 리뷰를 남겨주시면 큰 힘이 됩니다." },
    zh: { subject: (o) => `已送达，愿您喜欢 — ${o}`, line: () => "您的订单已送达。欢迎随时留下评价与佩戴照片。" },
    es: { subject: (o) => `Entregado — disfruta tu pieza — ${o}`, line: () => "Tu pedido figura como entregado. Nos encantaría verlo puesto: deja una reseña cuando quieras." },
  },
};

export async function sendOrderEventMail({ email, locale, orderCode, type, data = {} }) {
  const pack = ORDER_MAIL[type];
  if (!pack) throw new Error(`unknown order mail type: ${type}`);
  const loc = pack[locale] ? locale : "en";
  const t = pack[loc];
  const chrome = CHROME[loc];
  const origin = process.env.PUBLIC_ORIGIN || "http://127.0.0.1:8787";
  const link = `${origin}/track/${orderCode}`;
  const inner = `
    <p style="font-size:15px;line-height:1.6">${t.line(orderCode, data)}</p>
    <p style="font-size:13px;color:#8e897e;margin:6px 0 0">Order ${orderCode}</p>${receiptBlock(data.receipt, loc)}${journeyStrip(type, loc)}
    <p style="margin:24px 0"><a href="${link}" style="background:#16130f;color:#f8f7f5;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">${chrome.cta}</a></p>
    <p style="font-size:13px;color:#8e897e">${chrome.tail}</p>`;
  return sendOrderMail(email, t.subject(orderCode, data), inner, { type: `order_${type}`, orderCode }, chrome.ignore);
}
