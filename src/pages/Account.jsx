import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { getOpsStyle, listCustomerActions, listOpsOrders } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

const accountCopy = {
  en: {
    privateSpace: "PRIVATE CLIENT SPACE",
    guestLookup: "Guest lookup",
    startNew: "Start new request",
    needsReview: "NEEDS YOUR REVIEW",
    nextActions: "Your next actions",
    waiting: "Waiting on you",
    reviewOrder: "Review your order",
    due: (date) => `Due ${date}`,
    openWorkspace: "Open workspace",
    activeOrders: "ACTIVE ORDERS",
    inProgress: "Custom pieces in progress.",
    customRequest: "Custom jewelry request",
    requestedBy: (date) => `Requested by ${date}`,
    created: (date) => `Created ${date}`,
    exploreDesigns: "Explore designs",
  },
  ko: {
    privateSpace: "프라이빗 고객 공간",
    guestLookup: "비회원 조회",
    startNew: "새 요청 시작",
    needsReview: "검토 필요",
    nextActions: "다음 액션",
    waiting: "고객 확인 대기",
    reviewOrder: "주문 검토하기",
    due: (date) => `${date}까지`,
    openWorkspace: "워크스페이스 열기",
    activeOrders: "진행 중인 주문",
    inProgress: "제작 중인 맞춤 피스.",
    customRequest: "맞춤 주얼리 요청",
    requestedBy: (date) => `희망일 ${date}`,
    created: (date) => `${date} 생성`,
    exploreDesigns: "디자인 보기",
  },
  zh: {
    privateSpace: "私人客户空间",
    guestLookup: "访客查询",
    startNew: "发起新需求",
    needsReview: "需要您确认",
    nextActions: "下一步操作",
    waiting: "等待您处理",
    reviewOrder: "查看订单",
    due: (date) => `截止 ${date}`,
    openWorkspace: "打开工作区",
    activeOrders: "进行中的订单",
    inProgress: "正在制作的定制作品。",
    customRequest: "定制珠宝需求",
    requestedBy: (date) => `期望日期 ${date}`,
    created: (date) => `创建于 ${date}`,
    exploreDesigns: "查看设计",
  },
  es: {
    privateSpace: "ESPACIO PRIVADO",
    guestLookup: "Consulta invitado",
    startNew: "Nueva solicitud",
    needsReview: "REQUIERE TU REVISIÓN",
    nextActions: "Tus próximas acciones",
    waiting: "Esperando por ti",
    reviewOrder: "Revisar pedido",
    due: (date) => `Vence ${date}`,
    openWorkspace: "Abrir espacio",
    activeOrders: "PEDIDOS ACTIVOS",
    inProgress: "Piezas a medida en progreso.",
    customRequest: "Solicitud de joyería a medida",
    requestedBy: (date) => `Solicitado para ${date}`,
    created: (date) => `Creado ${date}`,
    exploreDesigns: "Ver diseños",
  },
};

export default function CustomerShell() {
  const { p, locale } = useLocale();
  const copy = accountCopy[locale] ?? accountCopy.en;

  return (
    <div className="page account-page">
      <div className="account-head">
        <div>
          <p className="section-label">{copy.privateSpace}</p>
          <h1 className="page-title">{p.account.title}</h1>
        </div>
        <div className="row-actions">
          <Link className="button secondary small" to="/track">{copy.guestLookup}</Link>
          <Link className="button primary small" to="/custom/new">{copy.startNew}</Link>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

// 내 주문 목록 (셸의 인덱스 자식)
export function AccountOrders() {
  useDBVersion();
  const { p, locale } = useLocale();
  const copy = accountCopy[locale] ?? accountCopy.en;
  const { user } = useAuth();
  const orders = listOpsOrders({ customerId: user.id });
  const actionCards = orders.flatMap((order) =>
    listCustomerActions(order.id, true).map((action) => ({ order, action })),
  );

  return (
    <>
      <p className="page-sub" style={{ marginTop: 0 }}>{p.account.welcome(user.name)}</p>

      {actionCards.length > 0 && (
        <section className="account-section">
          <div className="section-heading compact">
            <div>
              <p className="section-label">{copy.needsReview}</p>
              <h2>{copy.nextActions}</h2>
            </div>
          </div>
          <div className="order-card-grid">
            {actionCards.map(({ order, action }) => {
              const style = order.styleId ? getOpsStyle(order.styleId) : null;
              return (
                <Link className="order-action-card" to={`/orders/${order.id}`} key={action.id}>
                  <span className="status-badge mst-waitingClient">{copy.waiting}</span>
                  <h3>{action.prompt || copy.reviewOrder}</h3>
                  <p>{style ? pickI18n(style.name, locale) : order.id}</p>
                  <small>{action.dueDate ? copy.due(action.dueDate) : copy.openWorkspace} →</small>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {orders.length === 0 ? (
        <EmptyNote>
          {p.account.emptyOrders} <Link className="text-link" to="/designs">{copy.exploreDesigns}</Link>
        </EmptyNote>
      ) : (
        <section className="account-section">
          <div className="section-heading compact">
            <div>
              <p className="section-label">{copy.activeOrders}</p>
              <h2>{copy.inProgress}</h2>
            </div>
          </div>
          <div className="order-card-grid">
            {orders.map((o) => {
              const style = o.styleId ? getOpsStyle(o.styleId) : null;
              return (
                <Link className="order-card" to={`/orders/${o.id}`} key={o.id}>
                  <div className="proposal-head">
                    <span>{o.id}</span>
                    <span className={`status-badge ost-${o.status}`}>{p.orderStatus[o.status]}</span>
                  </div>
                  <h3>{style ? pickI18n(style.name, locale) : copy.customRequest}</h3>
                  <p>{o.requiredDate ? copy.requestedBy(o.requiredDate) : copy.created(o.createdAt.slice(0, 10))}</p>
                  <small>{copy.openWorkspace} →</small>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
