// 주문 상태 메일 — 이벤트 10종 × 4개 언어. 언어는 제출 시 저장된 customers.locale.
// 발송은 항상 커밋/응답 후 fire-and-forget — 실패는 로그만 남긴다 (스펙 §5).
import { sendOrderMail } from "./mailer.js";

const CHROME = {
  en: { cta: "VIEW YOUR ORDER", tail: "Questions? Just reply to this email." },
  ko: { cta: "주문 확인하기", tail: "궁금한 점은 이 메일에 회신해 주세요." },
  zh: { cta: "查看订单", tail: "如有疑问，直接回复本邮件即可。" },
  es: { cta: "VER TU PEDIDO", tail: "¿Preguntas? Responde a este correo." },
};

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
    <p style="font-size:13px;color:#8e897e;margin:6px 0 0">Order ${orderCode}</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#16130f;color:#f8f7f5;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">${chrome.cta}</a></p>
    <p style="font-size:13px;color:#8e897e">${chrome.tail}</p>`;
  return sendOrderMail(email, t.subject(orderCode, data), inner, { type: `order_${type}`, orderCode });
}
