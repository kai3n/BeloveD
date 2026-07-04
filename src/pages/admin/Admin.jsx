import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, CircleDollarSign, Coins, CreditCard, Gem, ShoppingBag, Star, Users } from "lucide-react";
import { syncAdminCatalogFromServer } from "../../lib/serverSync.js";
import { useLocale } from "../../i18n.jsx";

export default function Admin() {
  const { p } = useLocale();
  const location = useLocation();
  const isOrderDetail = /^\/bo-4q9z7m\/live\/[^/]+/.test(location.pathname);
  // 콘솔은 비공개 초안까지 포함한 전체 카탈로그가 필요 — 공개 하이드레이션을 덮어쓴다
  useEffect(() => { syncAdminCatalogFromServer(); }, []);
  const menu = [
    { to: "/bo-4q9z7m/live", key: "live", Icon: ShoppingBag },
    { to: "/bo-4q9z7m/designs", key: "styles", Icon: Gem },
    { to: "/bo-4q9z7m/benchmark", key: "benchmark", Icon: CircleDollarSign },
    { to: "/bo-4q9z7m/metals", key: "metals", Icon: Coins },
    { to: "/bo-4q9z7m/payments", key: "payments", Icon: CreditCard },
    { to: "/bo-4q9z7m/reviews", key: "reviews", Icon: Star },
    { to: "/bo-4q9z7m/members", key: "members", Icon: Users },
    { to: "/bo-4q9z7m/analytics", key: "analytics", Icon: Activity },
  ];
  return (
    <div className={`page admin-page ${isOrderDetail ? "admin-page-detail" : ""}`}>
      <h1 className="con-sr">{p.admin.title}</h1>
      <div className="admin-shell">
        <nav className="admin-side" aria-label={p.admin.title}>
          <div className="admin-side-head">
            <span className="admin-side-brand">BeloveD</span>
            <span className="admin-side-role">{p.admin.title}</span>
          </div>
          {menu.map(({ to, key, Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{p.opsA.menu[key]}</span>
            </NavLink>
          ))}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

