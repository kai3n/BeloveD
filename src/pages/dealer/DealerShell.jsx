import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { dealerTierInfo, getDealerProfile, getSettings, listWholesaleOrders } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { usd } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

export default function DealerShell() {
  const { p } = useLocale();
  const d = p.dealer;
  const menu = [
    { to: "/dealer", key: "dashboard", end: true },
    { to: "/dealer/catalog", key: "catalog" },
    { to: "/dealer/orders", key: "orders" },
    { to: "/dealer/registrations", key: "regs" },
    { to: "/dealer/claims", key: "claims" },
    { to: "/dealer/policies", key: "policies" },
  ];
  return (
    <div className="page">
      <h1 className="page-title">{d.title}</h1>
      <div className="admin-shell">
        <nav className="admin-side">
          {menu.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{d.nav[m.key]}</NavLink>)}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

export function DealerDashboard() {
  useDBVersion();
  const { p } = useLocale();
  const d = p.dealer.dash;
  const { user } = useAuth();
  const settings = getSettings();
  const info = dealerTierInfo(user.id);
  const profile = getDealerProfile(user.id);
  const progress = Math.min(100, Math.round((info.quarterVolume / settings.tierThresholdUsd) * 100));
  const recent = listWholesaleOrders({ dealerId: user.id }).slice(0, 3);

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="num">{d.tierName(info.tier)}</div>
          <div className="lbl">{d.tier}{info.override ? ` ${d.override}` : ""}</div>
        </div>
        <div className="summary-card"><div className="num">{usd(info.quarterVolume)}</div><div className="lbl">{d.volume}</div></div>
        <div className="summary-card"><div className="num">${settings.goldSpotPerGram}/g</div><div className="lbl">{d.spot}</div></div>
        <div className="summary-card">
          <div className="num" style={{ fontSize: 18, paddingTop: 8 }}>{profile.resaleCertNo ? d.certOk : "—"}</div>
          <div className="lbl">{d.cert}{!profile.resaleCertNo && <span className="warn-note"> · {d.certMissing}</span>}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h3>{d.threshold(usd(getSettings().tierThresholdUsd))}</h3>
        <div className="meter"><div className="meter-fill" style={{ width: `${progress}%` }} /></div>
        <p className="form-hint" style={{ marginTop: 10 }}>{d.demotionWarn}</p>
      </div>

      {recent.length > 0 && (
        <div className="panel">
          <h3>{p.dealer.orders.title}</h3>
          <table className="data-table"><tbody>
            {recent.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td><td>{o.createdAt.slice(0, 10)}</td><td>{usd(o.totalUsd)}</td>
                <td><span className={`status-badge wst-${o.status}`}>{p.dealer.orders.st[o.status]}</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </>
  );
}
