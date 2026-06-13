import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { getOpsStyle, listOpsOrders } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

// 고객 셸 — admin/dealer와 동일한 좌측 사이드바 레이아웃
export default function CustomerShell() {
  const { p } = useLocale();
  const menu = [
    { to: "/account", label: p.account.tabs.orders, end: true },
    { to: "/custom/new", label: p.nav.custom },
    { to: "/track", label: p.portal.guestTitle },
  ];
  return (
    <div className="page">
      <h1 className="page-title">{p.account.title}</h1>
      <div className="admin-shell">
        <nav className="admin-side">
          {menu.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>)}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

// 내 주문 목록 (셸의 인덱스 자식)
export function AccountOrders() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { user } = useAuth();
  const orders = listOpsOrders({ customerId: user.id });

  return (
    <>
      <p className="page-sub" style={{ marginTop: 0 }}>{p.account.welcome(user.name)}</p>

      {orders.length === 0 ? (
        <EmptyNote>
          {p.account.emptyOrders} <Link className="text-link" to="/styles">{p.styleCat.title}</Link>
        </EmptyNote>
      ) : (
        <table className="data-table">
          <thead><tr><th>{p.portal.orderId}</th><th>{p.portal.style}</th><th>{p.common.status}</th><th>{p.common.date}</th><th /></tr></thead>
          <tbody>
            {orders.map((o) => {
              const style = o.styleId ? getOpsStyle(o.styleId) : null;
              return (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{style ? pickI18n(style.name, locale) : "—"}</td>
                  <td><span className={`status-badge ost-${o.status}`}>{p.orderStatus[o.status]}</span></td>
                  <td>{o.createdAt.slice(0, 10)}</td>
                  <td><Link className="text-link" to={`/track/${o.id}`}>{p.common.view}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
