import { Link } from "react-router-dom";
import { dailyChecklist, listCustomerActions, listOpsOrders } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

export default function AdminOpsOrders() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.opsA.orders;
  const orders = listOpsOrders();
  const check = dailyChecklist();

  return (
    <>
      {(check.waitingClient.length > 0 || check.dueSoon.length > 0) && (
        <p className="warn-note" style={{ marginBottom: 14 }}>
          {check.waitingClient.length > 0 && <>⏳ {p.opsA.check.waiting}: {[...new Set(check.waitingClient)].join(", ")} </>}
          {check.dueSoon.length > 0 && <>· {p.opsA.check.dueSoon}: {check.dueSoon.join(", ")}</>}
        </p>
      )}
      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{t.title} ({orders.length})</h3>
        {orders.length === 0 ? <EmptyNote>—</EmptyNote> : (
          <table className="data-table">
            <thead><tr><th>Order</th><th>{p.intake.name}</th><th>{p.common.status}</th><th>{t.owner}</th><th>{t.required}</th><th>{t.nextAction}</th><th>{t.queryCode}</th><th /></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.customerName}</td>
                  <td><span className={`status-badge ost-${o.status}`}>{p.orderStatus[o.status]}</span></td>
                  <td>{o.owner}</td>
                  <td>{o.requiredDate || "—"}</td>
                  <td>{listCustomerActions(o.id, true).length}</td>
                  <td>{o.queryCode}</td>
                  <td><Link className="text-link" to={`/admin/ops/${o.id}`}>{t.detail}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
