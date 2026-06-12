import { useState } from "react";
import { getCatalogItem, getUser, listWholesaleOrders, transitionWholesale } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

function QcAttach({ order, label, passLabel }) {
  const [photos, setPhotos] = useState([]);
  return (
    <div className="form-stack" style={{ marginTop: 14 }}>
      <p className="form-hint">{label}</p>
      <MediaPicker value={photos} onChange={setPhotos} />
      <button className="button primary small" disabled={photos.length === 0}
        onClick={() => transitionWholesale(order.id, "QC_PASSED", { qcPhotos: photos.map((m) => m.src || m) })}>
        {passLabel}
      </button>
    </div>
  );
}

export default function AdminWholesale() {
  useDBVersion();
  const { p, locale } = useLocale();
  const w = p.adminDealer.wholesale;
  const st = p.dealer.orders.st;
  const orders = listWholesaleOrders();

  if (orders.length === 0) return <EmptyNote>{p.dealer.orders.empty}</EmptyNote>;

  return (
    <>
      {orders.map((o) => (
        <div className="panel" key={o.id}>
          <div className="proposal-head">
            <strong>{o.id} · {getUser(o.dealerId)?.name} · {usd(o.totalUsd)}</strong>
            <span className={`status-badge wst-${o.status}`}>{st[o.status]}</span>
          </div>
          <table className="data-table"><tbody>
            {o.items.map((it, i) => (
              <tr key={i}>
                <td>{pickI18n(getCatalogItem(it.itemId)?.name, locale)}</td>
                <td>× {it.qty}</td>
                <td>{usd(it.unitUsd)}</td>
              </tr>
            ))}
            <tr><th>{w.shipToLbl}</th><td colSpan={2}>{o.shipTo.name} — {o.shipTo.address} ({o.shipTo.type})</td></tr>
            <tr><th />{<td colSpan={2} className="form-hint">{w.spotAt(o.goldSpotAtOrder)} · {o.createdAt.slice(0, 10)}</td>}</tr>
          </tbody></table>

          {o.qcPhotos.length > 0 && (
            <div className="proposal-media" style={{ marginTop: 12 }}>
              {o.qcPhotos.map((src, i) => <MediaThumb key={i} media={{ kind: "image", src }} alt="QC" />)}
            </div>
          )}

          {o.status === "PLACED" && (
            <>
              <QcAttach order={o} label={w.attach} passLabel={w.pass} />
              <button className="button danger small" style={{ marginTop: 10 }} onClick={() => transitionWholesale(o.id, "CANCELLED")}>{w.cancel}</button>
            </>
          )}
          {o.status === "QC_PASSED" && (
            <div className="row-actions" style={{ marginTop: 14 }}>
              <input placeholder={w.trackingPh} id={`trk-${o.id}`}
                style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "9px 10px" }} />
              <button className="button primary small"
                onClick={() => transitionWholesale(o.id, "SHIPPED", { trackingNo: document.getElementById(`trk-${o.id}`).value })}>
                {w.ship}
              </button>
            </div>
          )}
          {o.status === "SHIPPED" && (
            <button className="button secondary small" style={{ marginTop: 14 }} onClick={() => transitionWholesale(o.id, "DELIVERED")}>{w.deliver}</button>
          )}
        </div>
      ))}
    </>
  );
}
