import { canTransition, STATUSES } from "../../lib/statusMachine.js";
import {
  assignVendor, getOrderByRequest, getTemplate, getUser, listRequests,
  listVendors, transitionRequest, updateShipping,
} from "../../lib/store.js";
import { useAuth } from "../../lib/auth.jsx";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, StatusBadge, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

export default function AdminOrders() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { user } = useAuth();
  const requests = listRequests();
  const vendors = listVendors().filter((v) => v.active);

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <h3>{p.admin.orders.title} ({requests.length})</h3>
      {requests.length === 0 ? <EmptyNote>{p.admin.dash.noOrders}</EmptyNote> : (
        <table className="data-table">
          <thead><tr>
            <th>{p.admin.orders.order}</th><th>{p.admin.orders.customer}</th><th>{p.admin.orders.design}</th>
            <th>{p.admin.orders.vendorCol}</th><th>{p.common.status}</th><th>{p.admin.orders.payment}</th><th>{p.admin.orders.force}</th>
          </tr></thead>
          <tbody>
            {requests.map((r) => {
              const order = getOrderByRequest(r.id);
              const allowedTargets = STATUSES.filter((s) => s !== r.status && canTransition(r.status, s, "admin"));
              return (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{getUser(r.customerId)?.name}<br /><span className="form-hint">{getUser(r.customerId)?.email}</span></td>
                  <td>{pickI18n(getTemplate(r.templateId)?.name, locale)}</td>
                  <td>
                    <select
                      value={r.vendorId || ""}
                      onChange={(e) => assignVendor(r.id, e.target.value, user)}
                      disabled={!canTransition(r.status, "VENDOR_ASSIGNED", "admin")}
                    >
                      <option value="" disabled>{p.admin.orders.assign}</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    {order ? (
                      <>
                        {usd(order.totalUsd)}<br />
                        <span className="form-hint">
                          {p.admin.orders.dep} {order.depositPaidAt ? "✓" : "—"} · {p.admin.orders.fin} {order.finalPaidAt ? "✓" : "—"}
                        </span>
                        {order.shippingStage === "ready" && (
                          <input placeholder={p.admin.orders.trackingPh} defaultValue={order.trackingNo || ""}
                            onBlur={(e) => updateShipping(order.id, { trackingNo: e.target.value })} />
                        )}
                      </>
                    ) : p.common.none}
                  </td>
                  <td>
                    <select value="" onChange={(e) => transitionRequest(r.id, e.target.value, user)}>
                      <option value="" disabled>{p.admin.orders.transit}</option>
                      {allowedTargets.map((s) => <option key={s} value={s}>{p.status[s]}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
