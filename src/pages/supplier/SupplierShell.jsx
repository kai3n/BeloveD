import { NavLink, Outlet } from "react-router-dom";
import { useLocale } from "../../i18n.jsx";

// 서플라이어 포털 셸 — admin/dealer와 동일한 좌측 사이드바 레이아웃
export default function SupplierShell() {
  const { p } = useLocale();
  const t = p.supplierP;
  const menu = [
    { to: "/supplier", label: t.queue, end: true },
    { to: "/supplier/pool", label: t.poolLink },
  ];
  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <div className="admin-shell">
        <nav className="admin-side">
          {menu.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>)}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}
