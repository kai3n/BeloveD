import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { anonymizeForVendor, getTemplate, listRequests } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, StatusBadge } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

const TABS = [
  { key: "new", statuses: ["VENDOR_ASSIGNED", "REVISION_REQUESTED"] },
  { key: "waiting", statuses: ["PROPOSAL_UPLOADED"] },
  { key: "production", statuses: ["DEPOSIT_PAID", "IN_PRODUCTION", "QUALITY_CHECK", "FINAL_PAYMENT_PAID", "SHIPPED"] },
  { key: "done", statuses: ["CONFIRMED", "DELIVERED", "COMPLETED", "CANCELLED"] },
];

export function hoursSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

export default function VendorQueue() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { user } = useAuth();
  const [tab, setTab] = useState("new");
  const tabDef = TABS.find((t) => t.key === tab);
  const requests = listRequests({ vendorId: user.id })
    .filter((r) => tabDef.statuses.includes(r.status))
    .map(anonymizeForVendor); // PII 제거 — 벤더는 익명 주문만 본다

  return (
    <div className="page">
      <h1 className="page-title">{p.vendor.title}</h1>
      <p className="page-sub">{p.vendor.sub(user.name)}</p>

      <div className="tab-row">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "is-active" : ""} onClick={() => setTab(t.key)}>{p.vendor.tabs[t.key]}</button>
        ))}
      </div>

      {requests.length === 0 ? <EmptyNote>{p.vendor.empty}</EmptyNote> : (
        <table className="data-table">
          <thead><tr><th>{p.vendor.order}</th><th>{p.vendor.design}</th><th>{p.common.status}</th><th>{p.vendor.elapsed}</th><th /></tr></thead>
          <tbody>
            {requests.map((r) => {
              const waitingHours = r.assignedAt ? hoursSince(r.assignedAt) : 0;
              const slaWarn = (r.status === "VENDOR_ASSIGNED" || r.status === "REVISION_REQUESTED") && waitingHours >= 48;
              return (
                <tr key={r.id}>
                  <td>{r.customerLabel}</td>
                  <td>{pickI18n(getTemplate(r.templateId)?.name, locale)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className={slaWarn ? "warn-note" : ""}>{p.vendor.hours(waitingHours)}{slaWarn ? p.vendor.slaWarn : ""}</td>
                  <td><Link className="text-link" to={`/vendor/requests/${r.id}`}>{p.vendor.work}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
