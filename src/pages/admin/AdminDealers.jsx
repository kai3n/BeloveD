import {
  approveApplication, dealerTierInfo, listApplications, listDealers,
  rejectApplication, updateDealerProfile,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, usd } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

export default function AdminDealers() {
  useDBVersion();
  const { p } = useLocale();
  const a = p.adminDealer.apps;
  const d = p.adminDealer.dealers;
  const apps = listApplications();
  const pending = apps.filter((x) => x.status === "pending");
  const dealers = listDealers();

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{a.title} ({pending.length})</h3>
        {pending.length === 0 ? <EmptyNote>{a.empty}</EmptyNote> : (
          <table className="data-table">
            <tbody>
              {pending.map((app) => (
                <tr key={app.id}>
                  <td>{app.bizName}<br /><span className="form-hint">{app.contactName} · {app.email}</span></td>
                  <td>{app.city}</td>
                  <td>{app.permitNo}<br /><span className="form-hint">{app.resaleCertNo || p.adminDealer.dealers.certMissing}</span></td>
                  <td>{a.expected} {usd(app.expectedQuarterlyUsd)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button primary small" onClick={() => approveApplication(app.id)}>{a.approve}</button>
                      <button className="button danger small" onClick={() => rejectApplication(app.id)}>{a.reject}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{d.title} ({dealers.length})</h3>
        <table className="data-table">
          <thead><tr><th>{p.admin.vendors.displayName}</th><th>{d.city}</th><th>{d.tier}</th><th>{d.volume}</th><th>{d.cert}</th><th>{d.override}</th><th /></tr></thead>
          <tbody>
            {dealers.map(({ user, profile }) => {
              const info = dealerTierInfo(user.id);
              return (
                <tr key={user.id}>
                  <td>{user.name}<br /><span className="form-hint">{user.email}</span></td>
                  <td>{profile?.city}</td>
                  <td>Tier {info.tier}</td>
                  <td>{usd(info.quarterVolume)}</td>
                  <td>
                    <input defaultValue={profile?.resaleCertNo || ""} placeholder={d.certMissing}
                      onBlur={(e) => updateDealerProfile(user.id, { resaleCertNo: e.target.value })} />
                  </td>
                  <td>
                    <select value={profile?.tierOverride || ""} onChange={(e) => updateDealerProfile(user.id, { tierOverride: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">{d.none}</option>
                      <option value="1">Tier 1</option>
                      <option value="2">Tier 2</option>
                    </select>
                  </td>
                  <td>
                    <button className={`chip ${profile?.active ? "is-active" : ""}`} onClick={() => updateDealerProfile(user.id, { active: !profile.active })}>
                      {profile?.active ? d.active : d.suspended}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
