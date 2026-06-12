import { NavLink, Outlet } from "react-router-dom";
import { listDiamonds, listOrders, listRequests } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { hoursSince } from "../vendor/VendorQueue.jsx";
import { useLocale } from "../../i18n.jsx";

export default function Admin() {
  const { p } = useLocale();
  const menu = [
    { to: "/admin", key: "dashboard", end: true },
    { to: "/admin/diamonds", key: "diamonds" },
    { to: "/admin/templates", key: "templates" },
    { to: "/admin/orders", key: "orders" },
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
          {menu.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{m.dealer ? p.adminDealer.menu[m.key] : p.admin.menu[m.key]}</NavLink>)}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  useDBVersion();
  const { p } = useLocale();
  const requests = listRequests();
  const active = requests.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.status));
  const unassigned = requests.filter((r) => r.status === "SUBMITTED");
  const slaBreached = requests.filter(
    (r) => ["VENDOR_ASSIGNED", "REVISION_REQUESTED"].includes(r.status) && r.assignedAt && hoursSince(r.assignedAt) >= 48
  );
  const awaitingDeposit = requests.filter((r) => r.status === "CONFIRMED");

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card"><div className="num">{active.length}</div><div className="lbl">{p.admin.dash.active}</div></div>
        <div className="summary-card"><div className="num">{unassigned.length}</div><div className="lbl">{p.admin.dash.unassigned}</div></div>
        <div className="summary-card"><div className="num">{slaBreached.length}</div><div className="lbl">{p.admin.dash.sla}</div></div>
        <div className="summary-card"><div className="num">{listDiamonds({ includeHidden: true }).length}</div><div className="lbl">{p.admin.dash.inventory}</div></div>
      </div>
      {slaBreached.length > 0 && (
        <p className="warn-note" style={{ marginTop: 18 }}>
          {p.admin.dash.slaWarn(slaBreached.map((r) => r.code).join(", "))}
        </p>
      )}
      {awaitingDeposit.length > 0 && (
        <p className="form-hint" style={{ marginTop: 10 }}>{p.admin.dash.depositWait(awaitingDeposit.map((r) => r.code).join(", "))}</p>
      )}
      {listOrders().length === 0 && <p className="form-hint" style={{ marginTop: 18 }}>{p.admin.dash.noOrders}</p>}
    </>
  );
}
