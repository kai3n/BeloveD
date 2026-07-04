import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, CircleDollarSign, Coins, CreditCard, Gem, ShoppingBag, Star, Users } from "lucide-react";
import { dailyChecklist, hideMedia, listOpsOrders, mediaFeed } from "../../lib/store.js";
import { syncAdminCatalogFromServer } from "../../lib/serverSync.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaThumb } from "../../components/ui.jsx";
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

// 데일리 체크리스트 대시보드 (매뉴얼 §12)
export function AdminDashboard() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.opsA.check;
  const c = dailyChecklist();
  const orders = listOpsOrders();
  const active = orders.filter((o) => !["DELIVERED", "ARCHIVED", "CANCELLED"].includes(o.status));

  const items = [
    // 어드민 터치포인트(입금 확인)를 맨 위로 — 자동화 흐름이 여기서만 멈춘다
    [t.depositWait, c.depositWait || []],
    [t.balanceWait, c.balanceWait || []],
    [t.held, c.heldCandidates || []],
    [t.waiting, [...new Set(c.waitingClient)]],
    [t.blocked, [...new Set(c.blocked)]],
    [t.expiring, c.quotesExpiring],
    [t.lowCand, c.lowCandidates],
    [t.dueSoon, c.dueSoon],
    [t.openPr, c.openProcurements],
  ];
  const feed = mediaFeed(12);
  const tm = p.opsA.monitor;

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card"><div className="num">{active.length}</div><div className="lbl">{p.opsA.orders.title}</div></div>
        <div className="summary-card"><div className="num">{(c.depositWait || []).length + (c.balanceWait || []).length}</div><div className="lbl">{t.depositWait}</div></div>
        <div className="summary-card"><div className="num">{(c.heldCandidates || []).length}</div><div className="lbl">{t.held}</div></div>
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
      {/* 고객에게 보일 시각자료 사후 모니터링 — 사전 승인 게이트 대신 */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3>{tm.title}</h3>
        <div className="card-grid cols-3">
          {feed.map((m) => (
            <div key={`${m.feedKind}-${m.id}`} className="item-card" style={m.hidden ? { opacity: 0.45 } : undefined}>
              <MediaThumb media={{ kind: m.kind, src: m.src }} alt={m.id} />
              <div className="card-body">
                <p className="spec">{tm.kinds[m.feedKind]} · {m.orderId} · {String(m.at).slice(5, 10)}</p>
                {m.hidden ? (
                  <p className="form-hint">{tm.hidden}</p>
                ) : (
                  <button className="button secondary small" onClick={() => hideMedia(m.feedKind, m.id, m.refId)}>{tm.hide}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
