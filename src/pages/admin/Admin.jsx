import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, Building2, CircleDollarSign, Coins, CreditCard, Gem, MessagesSquare, ShoppingBag, Star, TicketPercent, Users } from "lucide-react";
import { syncAdminCatalogFromServer } from "../../lib/serverSync.js";
import { apiFetch } from "../../lib/api.js";
import { useLocale } from "../../i18n.jsx";
import { useAuth } from "../../lib/auth.jsx";

const CHAT_LABEL = { en: "Messages", ko: "메시지", zh: "消息", es: "Mensajes" };
const SUPPLIER_LABEL = { en: "Vendors", ko: "벤더", zh: "供应商", es: "Proveedores" };

// 돈 관련 메뉴 — bot_admin 세션에는 숨긴다 (서버 requireFullAdmin이 최종 방어선)
const FULL_ADMIN_MENU = new Set(["benchmark", "metals", "payments", "coupons", "suppliers"]);

export default function Admin() {
  const { p, locale } = useLocale();
  const { adminLevel } = useAuth();
  const location = useLocation();
  const isOrderDetail = /^\/bo-4q9z7m\/live\/[^/]+/.test(location.pathname);
  const [chatUnread, setChatUnread] = useState(0);
  // 콘솔은 비공개 초안까지 포함한 전체 카탈로그가 필요 — 공개 하이드레이션을 덮어쓴다
  useEffect(() => { syncAdminCatalogFromServer(); }, []);
  // 사이드바 채팅 미확인 뱃지 — 답장 필요한 열린 스레드 수
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiFetch("/admin/chat/threads?status=open");
        if (alive) setChatUnread((d.threads || []).filter((t) => t.staffUnread > 0).length);
      } catch { /* 서버 부재 무시 */ }
    };
    load();
    const id = window.setInterval(load, 12000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);
  const menu = [
    { to: "/bo-4q9z7m/live", key: "live", Icon: ShoppingBag },
    { to: "/bo-4q9z7m/chat", key: "chat", Icon: MessagesSquare, label: CHAT_LABEL[locale] || CHAT_LABEL.en, badge: chatUnread },
    { to: "/bo-4q9z7m/designs", key: "styles", Icon: Gem },
    { to: "/bo-4q9z7m/benchmark", key: "benchmark", Icon: CircleDollarSign },
    { to: "/bo-4q9z7m/metals", key: "metals", Icon: Coins },
    { to: "/bo-4q9z7m/payments", key: "payments", Icon: CreditCard },
    { to: "/bo-4q9z7m/coupons", key: "coupons", Icon: TicketPercent },
    { to: "/bo-4q9z7m/reviews", key: "reviews", Icon: Star },
    { to: "/bo-4q9z7m/members", key: "members", Icon: Users },
    { to: "/bo-4q9z7m/suppliers", key: "suppliers", Icon: Building2, label: SUPPLIER_LABEL[locale] || SUPPLIER_LABEL.en },
    { to: "/bo-4q9z7m/analytics", key: "analytics", Icon: Activity },
  ].filter((item) => adminLevel !== "bot" || !FULL_ADMIN_MENU.has(item.key));
  return (
    <div className={`page admin-page ${isOrderDetail ? "admin-page-detail" : ""}`}>
      <h1 className="con-sr">{p.admin.title}</h1>
      <div className="admin-shell">
        <nav className="admin-side" aria-label={p.admin.title}>
          <div className="admin-side-head">
            <span className="admin-side-brand">BeloveD</span>
            <span className="admin-side-role">{p.admin.title}</span>
          </div>
          {menu.map(({ to, key, Icon, label, badge }) => (
            <NavLink key={to} to={to}>
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>{label || p.opsA.menu[key]}</span>
              {badge > 0 && (
                <span style={{ marginLeft: "auto", minWidth: 18, height: 18, padding: "0 6px", borderRadius: 9, background: "#d64545", color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}
