// 실서버 주문 포털 (BD- 주문번호) — 접수 메일의 /track/BD-… 링크가 여기로 열린다.
// 데모 스토어(DM-)와 달리 Postgres의 stage/타임라인/액션을 그대로 보여주는 얇은 뷰.
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../lib/api.js";
import { useAuth, LOGIN_FOR } from "../lib/auth.jsx";
import { MediaThumb } from "../components/ui.jsx";
import { useLocale } from "../i18n.jsx";

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
    stages: {
      OPS_REVIEW: "Reviewing your request", STONE_SELECTION: "Selecting your stone", QUOTE: "Review your proposal",
      DEPOSIT: "Reserved — deposit", CAD: "Designing", PRODUCTION: "Crafting", FINAL_QC: "Final quality check",
      BALANCE: "Balance", SHIPPING: "Shipping", DELIVERED: "Delivered", CANCELLED: "Cancelled",
    },
    phases: { DEFINE: "Define your piece", APPROVE_DESIGN: "Approve the design", MAKING: "We make it", DELIVERY: "Deliver" },
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
    responded: "Thank you — your response is in. We'll take it from here.",
    timelineTitle: "Timeline",
    artifactsTitle: "Shared with you",
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
    stages: {
      OPS_REVIEW: "요청 검토 중", STONE_SELECTION: "스톤 선정 중", QUOTE: "제안 확인 대기",
      DEPOSIT: "예약 — 디파짓", CAD: "디자인 중", PRODUCTION: "제작 중", FINAL_QC: "최종 품질 확인",
      BALANCE: "잔금", SHIPPING: "배송 중", DELIVERED: "배송 완료", CANCELLED: "취소됨",
    },
    phases: { DEFINE: "피스 확정", APPROVE_DESIGN: "디자인 승인", MAKING: "제작", DELIVERY: "배송" },
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
    responded: "감사합니다 — 응답이 접수됐습니다. 이후 진행은 저희가 맡을게요.",
    timelineTitle: "타임라인",
    artifactsTitle: "공유된 자료",
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
    stages: {
      OPS_REVIEW: "审核请求中", STONE_SELECTION: "挑选钻石中", QUOTE: "待您确认方案",
      DEPOSIT: "已预订 — 定金", CAD: "设计中", PRODUCTION: "制作中", FINAL_QC: "最终质检",
      BALANCE: "尾款", SHIPPING: "配送中", DELIVERED: "已送达", CANCELLED: "已取消",
    },
    phases: { DEFINE: "确定作品", APPROVE_DESIGN: "确认设计", MAKING: "制作", DELIVERY: "交付" },
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
    responded: "谢谢 — 已收到您的回复，后续交给我们。",
    timelineTitle: "时间线",
    artifactsTitle: "与您共享",
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
    stages: {
      OPS_REVIEW: "Revisando tu solicitud", STONE_SELECTION: "Seleccionando tu piedra", QUOTE: "Revisa tu propuesta",
      DEPOSIT: "Reservado — depósito", CAD: "Diseñando", PRODUCTION: "Fabricando", FINAL_QC: "Control final",
      BALANCE: "Saldo", SHIPPING: "En camino", DELIVERED: "Entregado", CANCELLED: "Cancelado",
    },
    phases: { DEFINE: "Define tu pieza", APPROVE_DESIGN: "Aprueba el diseño", MAKING: "La fabricamos", DELIVERY: "Entrega" },
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
    responded: "Gracias — recibimos tu respuesta. Nosotros seguimos desde aquí.",
    timelineTitle: "Cronología",
    artifactsTitle: "Compartido contigo",
    emailTail: "¿Preguntas? Responde a cualquiera de nuestros correos del pedido.",
  },
};

function fmtDate(iso, locale) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale === "zh" ? "zh-CN" : locale, { month: "short", day: "numeric" });
  } catch { return ""; }
}

export default function ServerOrderPortal({ orderCode }) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const location = useLocation();
  const t = COPY[locale] || COPY.en;
  const [state, setState] = useState({ status: "loading", order: null });
  const [respondedId, setRespondedId] = useState("");

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

  async function respond(action, response) {
    try {
      await apiFetch(`/actions/${action.id}/respond`, {
        method: "POST",
        body: { response, expectedSubjectVersionId: action.subjectVersionId },
      });
      setRespondedId(action.id); // refetch로 최신 상태 반영
    } catch { /* 이미 응답됨(409) 등 — refetch가 진실을 보여준다 */ setRespondedId(action.id); }
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
  const waitingLine = t.waiting[order.waitingOn] || "";
  const action = order.nextAction && order.nextAction.status === "OPEN" ? order.nextAction : null;

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

      {/* 열린 고객 컨펌 */}
      {action && (
        <section className="panel checkpoint client-stage-section active">
          <div className="client-stage-head">
            <span className="client-stage-number">!</span>
            <div><h3>{t.kinds[action.kind] || action.title || t.nextTitle}</h3>{action.description && <p>{action.description}</p>}</div>
            <span className="status-badge mst-waitingClient">{t.nextTitle}</span>
          </div>
          <div className="customer-decision-actions" style={{ marginTop: 12 }}>
            {(action.allowedResponses.length ? action.allowedResponses : ["CONFIRM"]).map((response, i) => (
              <button
                key={response}
                className={`button ${i === 0 ? "primary" : "secondary"}`}
                type="button"
                onClick={() => respond(action, response)}
              >
                {t.respond[response] || response}
              </button>
            ))}
          </div>
        </section>
      )}
      {respondedId && !action && <p className="client-action-notice" role="status">{t.responded}</p>}

      {/* 공유 자료 (발행된 아티팩트 미디어) */}
      {order.publishedArtifacts?.some((a) => a.media?.length) && (
        <section className="panel">
          <p className="section-label">{t.artifactsTitle}</p>
          <div className="card-grid cols-3">
            {order.publishedArtifacts.flatMap((a) => (a.media || []).map((m, i) => (
              <MediaThumb key={`${a.id}-${i}`} media={m} alt={a.versionLabel} ratio="1 / 1" />
            )))}
          </div>
        </section>
      )}

      {/* 타임라인 */}
      <section className="panel">
        <p className="section-label">{t.timelineTitle}</p>
        <div className="client-brief-list" style={{ display: "grid", gap: 0 }}>
          {order.timeline.map((event) => (
            <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--hair)" }}>
              <div>
                <strong style={{ fontSize: 14 }}>{event.title}</strong>
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
