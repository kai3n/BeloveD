// 실서버 주문 포털 (BD- 주문번호) — 접수 메일의 /track/BD-… 링크가 여기로 열린다.
// 데모 스토어(DM-)와 달리 Postgres의 stage/타임라인/액션을 그대로 보여주는 얇은 뷰.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../lib/api.js";
import { useAuth, LOGIN_FOR } from "../lib/auth.jsx";
import { MediaPicker, MediaThumb, usd } from "../components/ui.jsx";
import { PROPOSAL_FLOW_COPY } from "../lib/proposalFlowCopy.js";
import { Checkpoint, PaymentCard, ShippingAddressPanel } from "./ClientPortal.jsx";
import { isShippingAddressComplete } from "../lib/store.js";
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
    unavailableBody: "Please try again in a moment, or reply to your confirmation email — we answer within one business day.",
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
    timelineTitle: "Timeline",
    artifactsTitle: "Shared with you",
    proposalTitle: "Your proposal",
    specStone: "Stone", specMetal: "Metal", specTotal: "Total, all-inclusive",
    leadFmt: (d) => `≈ ${d} business days`,
    events: {
      proposal_sent: "Proposal sent", deposit_confirmed: "Deposit confirmed",
      diamond_locked: "Your diamond is secured", production_started: "Production started",
      qc_ready: "Finished piece ready for your review", balance_requested: "Balance requested",
      shipped: "Shipped", delivered: "Delivered",
      shipping_address_confirmed: "Shipping address confirmed", payment_reported: "Payment reported — confirming transfer",
      "Request received": "Request received", "Response received": "Response received",
    },
    emailTail: "Questions? Reply to any of our order emails — they reach the same team.",
  },
  ko: {
    kicker: "주문 현황",
    signInTitle: "로그인하면 주문을 볼 수 있어요",
    signInBody: "이 주문은 이메일 계정에 연결되어 있습니다. 주문할 때 쓴 이메일로 로그인해 주세요.",
    signInCta: "로그인",
    deniedTitle: "이 주문을 열 수 없습니다",
    deniedBody: "다른 계정의 주문입니다. 주문할 때 사용한 이메일로 로그인해 주세요.",
    unavailableTitle: "주문 포털을 준비하고 있어요",
    unavailableBody: "잠시 후 다시 시도해 주세요. 급하시면 접수 메일에 회신 주시면 영업일 기준 하루 안에 답변드립니다.",
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
    timelineTitle: "타임라인",
    artifactsTitle: "공유된 자료",
    proposalTitle: "제안",
    specStone: "스톤", specMetal: "메탈", specTotal: "총액 (올인클루시브)",
    leadFmt: (d) => `≈ ${d} 영업일`,
    events: {
      proposal_sent: "제안 발송됨", deposit_confirmed: "디파짓 확인됨",
      diamond_locked: "다이아몬드 확보됨", production_started: "제작 시작",
      qc_ready: "완성품 확인 요청", balance_requested: "잔금 안내",
      shipped: "발송됨", delivered: "배송 완료",
      shipping_address_confirmed: "배송지 확인됨", payment_reported: "송금 보고 접수 — 입금 확인 중",
      "Request received": "요청 접수됨", "Response received": "응답 접수됨",
    },
    emailTail: "궁금한 점은 주문 메일에 회신해 주세요 — 같은 팀에게 바로 전달됩니다.",
  },
  zh: {
    kicker: "订单状态",
    signInTitle: "登录后即可查看此订单",
    signInBody: "此订单与您的邮箱绑定。请使用下单时的邮箱登录。",
    signInCta: "登录",
    deniedTitle: "无法打开此订单",
    deniedBody: "该订单属于其他账户。请使用下单时的邮箱登录。",
    unavailableTitle: "订单页面正在准备",
    unavailableBody: "请稍后重试，或直接回复确认邮件，我们会在一个工作日内回复。",
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
    timelineTitle: "时间线",
    artifactsTitle: "与您共享",
    proposalTitle: "您的方案",
    specStone: "钻石", specMetal: "金属", specTotal: "总价（全包）",
    leadFmt: (d) => `约 ${d} 个工作日`,
    events: {
      proposal_sent: "方案已发送", deposit_confirmed: "定金已确认",
      diamond_locked: "钻石已锁定", production_started: "开始制作",
      qc_ready: "成品待您确认", balance_requested: "已发送尾款说明",
      shipped: "已发货", delivered: "已送达",
      shipping_address_confirmed: "收货地址已确认", payment_reported: "已报告付款 — 核对到账中",
      "Request received": "已收到请求", "Response received": "已收到回复",
    },
    emailTail: "如有疑问，直接回复订单邮件即可 — 同一团队为您服务。",
  },
  es: {
    kicker: "Estado del pedido",
    signInTitle: "Inicia sesión para ver este pedido",
    signInBody: "Este pedido está vinculado a tu correo. Inicia sesión con el correo que usaste al ordenar.",
    signInCta: "Iniciar sesión",
    deniedTitle: "No pudimos abrir este pedido",
    deniedBody: "Este pedido pertenece a otra cuenta. Inicia sesión con el correo que usaste al ordenar.",
    unavailableTitle: "El portal del pedido se está preparando",
    unavailableBody: "Inténtalo de nuevo en un momento, o responde a tu correo de confirmación — contestamos en un día hábil.",
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
    timelineTitle: "Cronología",
    artifactsTitle: "Compartido contigo",
    proposalTitle: "Tu propuesta",
    specStone: "Piedra", specMetal: "Metal", specTotal: "Total, todo incluido",
    leadFmt: (d) => `≈ ${d} días hábiles`,
    events: {
      proposal_sent: "Propuesta enviada", deposit_confirmed: "Depósito confirmado",
      diamond_locked: "Diamante asegurado", production_started: "Producción iniciada",
      qc_ready: "Pieza lista para tu revisión", balance_requested: "Saldo solicitado",
      shipped: "Enviado", delivered: "Entregado",
      shipping_address_confirmed: "Dirección de envío confirmada", payment_reported: "Pago reportado — confirmando transferencia",
      "Request received": "Solicitud recibida", "Response received": "Respuesta recibida",
    },
    emailTail: "¿Preguntas? Responde a cualquiera de nuestros correos del pedido.",
  },
};

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
  const deposit = total ? Math.min(total, pay.depositUsd > 0 ? pay.depositUsd : Math.round(total * 0.3)) : null;
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
  const { locale, p } = useLocale();
  const fc = PROPOSAL_FLOW_COPY[locale] || PROPOSAL_FLOW_COPY.en;
  const { user } = useAuth();
  const location = useLocation();
  const t = COPY[locale] || COPY.en;
  const [state, setState] = useState({ status: "loading", order: null });
  const [respondedId, setRespondedId] = useState("");
  // 수정 요청은 무엇을 바꿀지 적을 수 있어야 어드민이 반영한다 — 클릭 시 텍스트 입력 단계로
  const [changeMode, setChangeMode] = useState(false);
  const [changeMsg, setChangeMsg] = useState("");
  const [changeMedia, setChangeMedia] = useState([]); // 참고 사진·영상 — R2 업로드 후 URL만 전송
  const [address, setAddress] = useState(null); // null = 주문 로드 전 (로드 시 서버 저장값으로 초기화)
  const [addressSaved, setAddressSaved] = useState(false);

  useEffect(() => {
    if (state.status !== "ok" || address !== null) return;
    const saved = state.order.summary?.shippingAddress || null;
    setAddress({ ...EMPTY_ADDRESS, ...(saved || {}) });
    setAddressSaved(Boolean(saved && isShippingAddressComplete(saved)));
  }, [state, address]);

  async function saveAddress() {
    try {
      await apiFetch(`/orders/${orderCode}/shipping-address`, { method: "POST", body: address });
      setAddressSaved(true);
    } catch { /* 실패 시 편집 상태 유지 — 재시도 가능 */ }
  }

  async function reportPayment(kind) {
    try {
      await apiFetch(`/orders/${orderCode}/payment-reported`, { method: "POST", body: { kind } });
    } catch { /* refetch가 진실을 보여준다 */ }
    setRespondedId(`paid-${kind}-${Date.now()}`); // refetch 트리거
  }

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", order: null });
    apiFetch(`/orders/${orderCode}`)
      .then((data) => { if (!cancelled) setState({ status: "ok", order: data.order }); })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiUnavailableError) setState({ status: "unavailable", order: null });
        else if (e.status === 401) setState({ status: "signin", order: null });
        else setState({ status: "denied", order: null });
      });
    return () => { cancelled = true; };
  }, [orderCode, user?.id, respondedId]);

  async function respond(action, response, extra = {}) {
    try {
      await apiFetch(`/actions/${action.id}/respond`, {
        method: "POST",
        body: { response, expectedSubjectVersionId: action.subjectVersionId, ...extra },
      });
      setRespondedId(action.id); // refetch로 최신 상태 반영
    } catch { /* 이미 응답됨(409) 등 — refetch가 진실을 보여준다 */ setRespondedId(action.id); }
    setChangeMode(false);
    setChangeMsg("");
    setChangeMedia([]);
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
  const payDeposit = payTotal ? Math.min(payTotal, qp.depositUsd > 0 ? qp.depositUsd : Math.round(payTotal * 0.3)) : null;
  const latestQuoteAction = (order.actions || []).find((a) => a.kind === "QUOTE_ACCEPTANCE");
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
  const balanceVisible = Boolean(payTotal) && stageIdx >= STAGE_SEQ.indexOf("BALANCE");
  const balanceState = showBalance ? (balanceReported ? "waiting" : "active") : "done";
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
        <MediaPicker value={changeMedia} onChange={setChangeMedia} maxItems={3} showSamples={false} previewMode="list" />
      </div>
      <div className="customer-decision-actions">
        <button
          className="button primary"
          type="button"
          disabled={!changeMsg.trim()}
          onClick={() => respond(act, "REQUEST_CHANGES", {
            message: changeMsg.trim(),
            media: changeMedia.filter((m) => /^https?:\/\//.test(m.src || "")).slice(0, 3),
          })}
        >
          {t.changesSend}
        </button>
        <button className="button secondary" type="button" onClick={() => { setChangeMode(false); setChangeMsg(""); setChangeMedia([]); }}>
          {t.changesCancel}
        </button>
      </div>
    </div>
  ) : (
    <div className="customer-decision-actions" style={{ marginTop: 14 }}>
      {(act.allowedResponses.length ? act.allowedResponses : ["CONFIRM"]).map((response, i) => (
        <button
          key={response}
          className={`button ${i === 0 ? "primary" : "secondary"}`}
          type="button"
          onClick={() => (response === "REQUEST_CHANGES" ? setChangeMode(true) : respond(act, response))}
        >
          {t.respond[response] || response}
        </button>
      ))}
    </div>
  ));

  const waitingLine = showDeposit && !depositReported
    ? t.waitingDeposit
    : showBalance && !balanceReported
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
          <span className="status-badge mst-inProgress">{t.stages[order.stage] || order.stage}</span>
        </div>
      </section>

      {/* 여정 4단계 레일 */}
      <section className="client-confirm-rail" aria-label={t.kicker}>
        {order.phases.map((phase, index) => (
          <article className={`client-confirm-step ${phase.state === "complete" ? "done" : phase.state}`} key={phase.key}>
            <span className="client-confirm-index">{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{t.phases[phase.key] || phase.title}</strong></div>
          </article>
        ))}
      </section>

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
              onChange={setAddress}
              t={p.portal}
              locked={addressSaved}
              canSave={!addressSaved}
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
          />
        </Checkpoint>
      )}

      {/* 기타 열린 컨펌 (완성품 QC 등) */}
      {otherAction && (
        <Checkpoint
          id="bd-action"
          index="2-1"
          title={t.kinds[otherAction.kind] || otherAction.title || t.nextTitle}
          state="active"
          badgeOverride={t.nextTitle}
        >
          {otherAction.description && <p className="form-hint">{otherAction.description}</p>}
          {renderDecision(otherAction)}
        </Checkpoint>
      )}

      {/* 공유 자료 — 비-QUOTE 아티팩트(QC 미디어 등), 타입별 최신만 */}
      {Object.values((order.publishedArtifacts || []).reduce((acc, a) => {
        const prev = acc[a.type];
        if (!prev || new Date(a.publishedAt) > new Date(prev.publishedAt)) acc[a.type] = a;
        return acc;
      }, {})).map((a) => {
        if (a.type === "QUOTE") return null;
        const pay = a.payload || {};
        const hasContent = a.media?.length || pay.note;
        if (!hasContent) return null;
        return (
          <section className="panel form-stack" key={a.id}>
            <p className="section-label">{t.artifactsTitle}</p>
            {a.media?.length > 0 && (
              <div className="card-grid cols-3">
                {a.media.map((m, i) => <MediaThumb key={i} media={m} alt={a.versionLabel} ratio="1 / 1" />)}
              </div>
            )}
            {pay.note && <p className="form-hint" style={{ margin: 0 }}>{pay.note}</p>}
          </section>
        );
      })}

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
