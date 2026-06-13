import { NavLink, Outlet } from "react-router-dom";
import { dailyChecklist, hideMedia, listOpsOrders, mediaFeed } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaThumb } from "../../components/ui.jsx";
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
      {/* 벤더↔고객 시각자료 사후 모니터링 — 사전 승인 게이트 대신 */}
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
