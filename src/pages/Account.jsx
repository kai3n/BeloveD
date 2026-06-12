import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { getTemplate, listPayments, listRequests } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote, StatusBadge } from "../components/ui.jsx";
import { usd } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

export default function Account() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { user } = useAuth();
  const [tab, setTab] = useState("orders");
  const requests = listRequests({ customerId: user.id });
  const payments = listPayments(user.id);

  const tabs = [
    { key: "orders", label: p.account.tabs.orders },
    { key: "payments", label: p.account.tabs.payments },
    { key: "profile", label: p.account.tabs.profile },
  ];

  return (
    <div className="page">
      <h1 className="page-title">{p.account.title}</h1>
      <p className="page-sub">{p.account.welcome(user.name)}</p>

      <div className="tab-row">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? "is-active" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "orders" && (
        requests.length === 0 ? (
          <EmptyNote>{p.account.emptyOrders} <Link className="text-link" to="/templates">{p.account.gallery}</Link></EmptyNote>
        ) : (
          <table className="data-table">
            <thead><tr><th>{p.account.orderNo}</th><th>{p.account.design}</th><th>{p.common.status}</th><th>{p.common.date}</th><th /></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{pickI18n(getTemplate(r.templateId)?.name, locale)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.createdAt.slice(0, 10)}</td>
                  <td><Link className="text-link" to={`/account/requests/${r.id}`}>{p.common.view}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "payments" && (
        payments.length === 0 ? <EmptyNote>{p.account.emptyPayments}</EmptyNote> : (
          <table className="data-table">
            <thead><tr><th>{p.account.when}</th><th>{p.account.type}</th><th>{p.account.amount}</th><th>{p.account.state}</th></tr></thead>
            <tbody>
              {payments.map((pay) => (
                <tr key={pay.id}>
                  <td>{pay.at.slice(0, 10)}</td>
                  <td>{pay.kind === "deposit" ? p.account.deposit : p.account.final}</td>
                  <td>{usd(pay.amount)}</td>
                  <td>{pay.status === "paid" ? p.account.paid : pay.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "profile" && (
        <div className="panel" style={{ maxWidth: 480 }}>
          <table className="data-table"><tbody>
            <tr><th>{p.account.nameLbl}</th><td>{user.name}</td></tr>
            <tr><th>{p.account.emailLbl}</th><td>{user.email}</td></tr>
            <tr><th>{p.account.roleLbl}</th><td>{p.account.customerRole}</td></tr>
          </tbody></table>
          <p className="form-hint" style={{ marginTop: 12 }}>{p.account.profileHint}</p>
        </div>
      )}
    </div>
  );
}
