import { Link, useNavigate } from "react-router-dom";
import { dailyChecklist, listCustomerActions, listOpsOrders } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

export default function AdminOpsOrders() {
  useDBVersion();
  const navigate = useNavigate();
  const { p } = useLocale();
  const t = p.opsA.orders;
  const orders = listOpsOrders();
  const check = dailyChecklist();

  function openOrder(orderId) {
    navigate(`/bo-4q9z7m/orders/${orderId}`);
  }

  function openOrderFromKeyboard(event, orderId) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openOrder(orderId);
  }

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
                <tr
                  key={o.id}
                  className="ops-order-row"
                  data-testid="admin-order-row"
                  data-order-id={o.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`${t.detail} ${o.id}`}
                  onClick={() => openOrder(o.id)}
                  onKeyDown={(event) => openOrderFromKeyboard(event, o.id)}
                >
                  <td>{o.id}</td>
                  <td>{o.customerName}</td>
                  <td><span className={`status-badge ost-${o.status}`}>{p.orderStatus[o.status]}</span></td>
                  <td>{o.owner}</td>
                  <td>{o.requiredDate || "—"}</td>
                  <td>{listCustomerActions(o.id, true).length}</td>
                  <td>{o.queryCode}</td>
                  <td><Link className="text-link" to={`/bo-4q9z7m/orders/${o.id}`} onClick={(event) => event.stopPropagation()}>{t.detail}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
