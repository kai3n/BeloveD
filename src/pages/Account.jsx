import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { apiFetch } from "../lib/api.js";
import { getOpsStyle, listCustomerActions, listOpsOrders } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";
import { serverActionLabel, serverStageLabel } from "./ServerOrderPortal.jsx";

const accountCopy = {
  en: {
    privateSpace: "PRIVATE CLIENT SPACE",
    guestLookup: "Guest lookup",
    startNew: "Start new request",
    ordersKicker: "PRIVATE ORDERS",
    ordersTitle: "Your custom orders.",
    ordersBody: "Each order shows the current stage and the next client action in one place.",
    currentAction: "Current action",
    currentStage: "Current stage",
    yourTurn: "Your turn",
    waiting: "Waiting on you",
    noOpenActionTitle: "BeloveD is preparing the next update",
    noOpenAction: "Nothing to confirm right now.",
    reviewOrder: "Review your order",
    reviewNow: "Review now",
    viewWorkspace: "View workspace",
    due: (date) => `Due ${date}`,
    openWorkspace: "Open workspace",
    customRequest: "Custom jewelry request",
    requestedBy: (date) => `Requested by ${date}`,
    created: (date) => `Created ${date}`,
    exploreDesigns: "Explore designs",
    actionTitles: {
      quoteAcceptance: "Review your quote",
      diamondSelection: "Choose your diamond",
      cadReview: "Review the design draft",
      cadApproval: "Approve the design",
      finalConfirmation: "Confirm the finished piece",
    },
  },
  ko: {
    privateSpace: "프라이빗 고객 공간",
    guestLookup: "비회원 조회",
    startNew: "새 요청 시작",
    ordersKicker: "내 주문",
    ordersTitle: "내 맞춤 주문",
    ordersBody: "주문별로 현재 단계와 고객이 해야 할 일을 한 카드에서 확인할 수 있습니다.",
    currentAction: "지금 할 일",
    currentStage: "현재 단계",
    yourTurn: "확인 필요",
    waiting: "고객 확인 대기",
    noOpenActionTitle: "BeloveD가 다음 업데이트를 준비 중입니다",
    noOpenAction: "지금 확인할 내용은 없습니다.",
    reviewOrder: "주문 검토하기",
    reviewNow: "검토하기",
    viewWorkspace: "워크스페이스 보기",
    due: (date) => `${date}까지`,
    openWorkspace: "워크스페이스 열기",
    customRequest: "맞춤 주얼리 요청",
    requestedBy: (date) => `희망일 ${date}`,
    created: (date) => `${date} 생성`,
    exploreDesigns: "디자인 보기",
    actionTitles: {
      quoteAcceptance: "견적 확인",
      diamondSelection: "다이아몬드 선택",
      cadReview: "디자인 초안 검토",
      cadApproval: "디자인 승인",
      finalConfirmation: "완성품 최종 확인",
    },
  },
  zh: {
    privateSpace: "私人客户空间",
    guestLookup: "访客查询",
    startNew: "发起新需求",
    ordersKicker: "我的订单",
    ordersTitle: "我的定制订单",
    ordersBody: "每个订单都会把当前阶段和需要您确认的事项放在同一张卡片里。",
    currentAction: "当前操作",
    currentStage: "当前阶段",
    yourTurn: "待您确认",
    waiting: "等待您处理",
    noOpenActionTitle: "BeloveD 正在准备下一步更新",
    noOpenAction: "目前没有需要确认的内容。",
    reviewOrder: "查看订单",
    reviewNow: "立即查看",
    viewWorkspace: "查看工作区",
    due: (date) => `截止 ${date}`,
    openWorkspace: "打开工作区",
    customRequest: "定制珠宝需求",
    requestedBy: (date) => `期望日期 ${date}`,
    created: (date) => `创建于 ${date}`,
    exploreDesigns: "查看设计",
    actionTitles: {
      quoteAcceptance: "确认报价",
      diamondSelection: "选择钻石",
      cadReview: "查看设计初稿",
      cadApproval: "确认设计",
      finalConfirmation: "确认成品",
    },
  },
  es: {
    privateSpace: "ESPACIO PRIVADO",
    guestLookup: "Consulta invitado",
    startNew: "Nueva solicitud",
    ordersKicker: "MIS PEDIDOS",
    ordersTitle: "Tus pedidos a medida",
    ordersBody: "Cada pedido muestra la etapa actual y la próxima acción del cliente en una sola tarjeta.",
    currentAction: "Acción actual",
    currentStage: "Etapa actual",
    yourTurn: "Tu turno",
    waiting: "Esperando por ti",
    noOpenActionTitle: "BeloveD está preparando la próxima actualización",
    noOpenAction: "No hay nada que confirmar ahora.",
    reviewOrder: "Revisar pedido",
    reviewNow: "Revisar ahora",
    viewWorkspace: "Ver espacio",
    due: (date) => `Vence ${date}`,
    openWorkspace: "Abrir espacio",
    customRequest: "Solicitud de joyería a medida",
    requestedBy: (date) => `Solicitado para ${date}`,
    created: (date) => `Creado ${date}`,
    exploreDesigns: "Ver diseños",
    actionTitles: {
      quoteAcceptance: "Revisar cotización",
      diamondSelection: "Elegir diamante",
      cadReview: "Revisar diseño",
      cadApproval: "Aprobar diseño",
      finalConfirmation: "Confirmar pieza final",
    },
  },
};

function getActionTitle(action, copy) {
  if (!action) return copy.noOpenActionTitle;
  return copy.actionTitles?.[action.type] ?? copy.reviewOrder;
}

export default function CustomerShell() {
  const { p, locale } = useLocale();
  const copy = accountCopy[locale] ?? accountCopy.en;
  const { user } = useAuth();

  return (
    <div className="page account-page">
      <div className="account-head">
        <div>
          <p className="section-label">{copy.privateSpace}</p>
          <h1 className="page-title">{p.account.title}</h1>
        </div>
        <div className="row-actions">
          {!user && <Link className="button secondary small" to="/track">{copy.guestLookup}</Link>}
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

  // 실서버(BD-) 주문이 진실 — 있으면 로컬 데모 미러(DM-) 대신 이것만 보여준다.
  // 같은 제출이 DM-/BD- 두 번호로 따로 보이던 혼란 제거. 서버 미접속(정적 데모)이면 로컬 폴백.
  const [serverOrders, setServerOrders] = useState([]);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/orders")
      .then((d) => { if (!cancelled) setServerOrders(d.orders || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  if (serverOrders.length > 0) {
    return (
      <>
        <p className="page-sub" style={{ marginTop: 0 }}>{p.account.welcome(user.name)}</p>
        <section className="account-section">
          <div className="account-orders-heading">
            <div>
              <p className="section-label">{copy.ordersKicker}</p>
              <h2>{copy.ordersTitle}</h2>
            </div>
            <p className="page-sub">{copy.ordersBody}</p>
          </div>
          <div className="account-order-list">
            {serverOrders.map((o) => {
              const needsAction = o.nextAction?.status === "OPEN";
              const stageLabel = serverStageLabel(o.stage, locale);
              return (
                <Link className={`account-workspace-card${needsAction ? " needs-action" : ""}`} to={`/orders/${o.orderCode}`} key={o.orderCode}>
                  <div className="account-workspace-main">
                    <div className="proposal-head">
                      <span>{o.orderCode}</span>
                      <span className={`status-badge ${needsAction ? "mst-waitingClient" : "mst-inProgress"}`}>{needsAction ? copy.yourTurn : stageLabel}</span>
                    </div>
                    <h3>{copy.customRequest}</h3>
                    <p className="account-order-meta">
                      {o.expectedCompletionAt ? copy.requestedBy(String(o.expectedCompletionAt).slice(0, 10)) : copy.created(String(o.updatedAt).slice(0, 10))}
                    </p>
                  </div>
                  <div className="account-workspace-action">
                    <span>{needsAction ? copy.currentAction : copy.currentStage}</span>
                    <strong>{needsAction ? serverActionLabel(o.nextAction.kind, locale) : stageLabel}</strong>
                    <p>{needsAction ? "" : copy.noOpenAction}</p>
                  </div>
                  <span className="account-card-cta">{needsAction ? copy.reviewNow : copy.viewWorkspace} →</span>
                </Link>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <p className="page-sub" style={{ marginTop: 0 }}>{p.account.welcome(user.name)}</p>

      {orders.length === 0 ? (
        <EmptyNote>
          {p.account.emptyOrders} <Link className="text-link" to="/designs">{copy.exploreDesigns}</Link>
        </EmptyNote>
      ) : (
        <section className="account-section">
          <div className="account-orders-heading">
            <div>
              <p className="section-label">{copy.ordersKicker}</p>
              <h2>{copy.ordersTitle}</h2>
            </div>
            <p className="page-sub">{copy.ordersBody}</p>
          </div>
          <div className="account-order-list">
            {orders.map((o) => {
              const style = o.styleId ? getOpsStyle(o.styleId) : null;
              const openAction = listCustomerActions(o.id, true)[0] || null;
              const needsAction = Boolean(openAction);
              const statusText = needsAction ? copy.yourTurn : p.orderStatus[o.status];
              return (
                <Link className={`account-workspace-card${needsAction ? " needs-action" : ""}`} to={`/orders/${o.id}`} key={o.id}>
                  <div className="account-workspace-main">
                    <div className="proposal-head">
                      <span>{o.id}</span>
                      <span className={`status-badge ${needsAction ? "mst-waitingClient" : `ost-${o.status}`}`}>{statusText}</span>
                    </div>
                    <h3>{style ? pickI18n(style.name, locale) : copy.customRequest}</h3>
                    <p className="account-order-meta">
                      {o.requiredDate ? copy.requestedBy(o.requiredDate) : copy.created(o.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <div className="account-workspace-action">
                    <span>{needsAction ? copy.currentAction : copy.currentStage}</span>
                    <strong>{getActionTitle(openAction, copy)}</strong>
                    <p>{needsAction && openAction.dueDate ? copy.due(openAction.dueDate) : copy.noOpenAction}</p>
                  </div>
                  <span className="account-card-cta">{needsAction ? copy.reviewNow : copy.viewWorkspace} →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
