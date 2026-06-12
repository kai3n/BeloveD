import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { getOpsStyle, listOpsOrders } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

export default function Account() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { user } = useAuth();
  const orders = listOpsOrders({ customerId: user.id });

  return (
    <div className="page">
      <h1 className="page-title">{p.account.title}</h1>
      <p className="page-sub">{p.account.welcome(user.name)}</p>

      {orders.length === 0 ? (
        <EmptyNote>
          {p.account.emptyOrders} <Link className="text-link" to="/styles">{p.styleCat.title}</Link>
        </EmptyNote>
      ) : (
        <table className="data-table">
          <thead><tr><th>{p.portal.orderId}</th><th>{p.portal.style}</th><th>{p.common.status}</th><th>{p.common.date}</th><th /></tr></thead>
          <tbody>
            {orders.map((o) => {
              const style = o.styleId ? getOpsStyle(o.styleId) : null;
              return (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{style ? pickI18n(style.name, locale) : "—"}</td>
                  <td><span className={`status-badge ost-${o.status}`}>{p.orderStatus[o.status]}</span></td>
                  <td>{o.createdAt.slice(0, 10)}</td>
                  <td><Link className="text-link" to={`/track/${o.id}`}>{p.common.view}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
