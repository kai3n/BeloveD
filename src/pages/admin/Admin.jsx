import { NavLink, Outlet } from "react-router-dom";
import { dailyChecklist, listOpsOrders } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";

export default function Admin() {
  const { p } = useLocale();
  const menu = [
    { to: "/admin", key: "checklist", ops: true, end: true },
    { to: "/admin/ops", key: "orders", ops: true },
    { to: "/admin/styles", key: "styles", ops: true },
    { to: "/admin/benchmark", key: "benchmark", ops: true },
    { to: "/admin/diamonds", key: "diamonds" },
    { to: "/admin/vendors", key: "vendors" },
    { to: "/admin/dealers", key: "dealers", dealer: true },
    { to: "/admin/catalog", key: "catalog", dealer: true },
    { to: "/admin/wholesale", key: "wholesale", dealer: true },
    { to: "/admin/claims", key: "claims", dealer: true },
    { to: "/admin/warranty", key: "warranty", dealer: true },
    { to: "/admin/settings", key: "settings" },
  ];
  return (
    <div className="page">
      <h1 className="page-title">{p.admin.title}</h1>
      <div className="admin-shell">
        <nav className="admin-side">
          {menu.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end}>
              {m.ops ? p.opsA.menu[m.key] : m.dealer ? p.adminDealer.menu[m.key] : p.admin.menu[m.key]}
            </NavLink>
          ))}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

// 데일리 체크리스트 대시보드 (매뉴얼 §12)
export function AdminDashboard() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.opsA.check;
  const c = dailyChecklist();
  const orders = listOpsOrders();
  const active = orders.filter((o) => !["DELIVERED", "ARCHIVED", "CANCELLED"].includes(o.status));

  const items = [
    [t.waiting, [...new Set(c.waitingClient)]],
    [t.blocked, [...new Set(c.blocked)]],
    [t.expiring, c.quotesExpiring],
    [t.lowCand, c.lowCandidates],
    [t.dueSoon, c.dueSoon],
    [t.openPr, c.openPr ?? c.openProcurements],
  ];

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card"><div className="num">{active.length}</div><div className="lbl">{p.opsA.orders.title}</div></div>
        <div className="summary-card"><div className="num">{[...new Set(c.waitingClient)].length}</div><div className="lbl">{t.waiting}</div></div>
        <div className="summary-card"><div className="num">{c.lowCandidates.length}</div><div className="lbl">{t.lowCand}</div></div>
        <div className="summary-card"><div className="num">{(c.openProcurements || []).length}</div><div className="lbl">{t.openPr}</div></div>
      </div>
      <div className="panel" style={{ marginTop: 18 }}>
        <h3>{t.title}</h3>
        {items.every(([, list]) => list.length === 0) ? (
          <p className="form-hint">✓ {t.clear}</p>
        ) : items.map(([label, list]) => list.length > 0 && (
          <p key={label} className="warn-note" style={{ margin: "6px 0" }}>· {label}: {list.join(", ")}</p>
        ))}
      </div>
    </>
  );
}
