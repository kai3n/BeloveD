import { useAuth } from "../../lib/auth.jsx";
import { getCatalogItem, listWholesaleOrders } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

export default function DealerOrders() {
  useDBVersion();
  const { p, locale } = useLocale();
  const d = p.dealer.orders;
  const { user } = useAuth();
  const orders = listWholesaleOrders({ dealerId: user.id });

  if (orders.length === 0) return <EmptyNote>{d.empty}</EmptyNote>;

  return (
    <>
      {orders.map((o) => (
        <div className="panel" key={o.id}>
          <div className="proposal-head">
            <strong>{o.id} · {usd(o.totalUsd)}</strong>
            <span className={`status-badge wst-${o.status}`}>{d.st[o.status]}</span>
          </div>
          <table className="data-table"><tbody>
            {o.items.map((it, i) => {
              const item = getCatalogItem(it.itemId);
              return (
                <tr key={i}>
                  <td>{pickI18n(item?.name, locale)}</td>
                  <td>× {it.qty}</td>
                  <td>{usd(it.unitUsd)} ({p.dealer.catalog.stone} {usd(it.stoneUsd)} + {p.dealer.catalog.metal.split(" ")[0]} {usd(it.metalUsd)})</td>
                </tr>
              );
            })}
            <tr><th>{d.date}</th><td colSpan={2}>{o.createdAt.slice(0, 10)} · ${o.goldSpotAtOrder}/g</td></tr>
            <tr><th>{p.dealer.orderNew.shipTo}</th><td colSpan={2}>{o.shipTo.name} — {o.shipTo.address}</td></tr>
            {o.trackingNo && <tr><th>{d.tracking}</th><td colSpan={2}>{o.trackingNo}</td></tr>}
          </tbody></table>
          {o.qcPhotos.length > 0 && (
            <>
              <p className="form-hint" style={{ margin: "12px 0 8px" }}>{d.qc}</p>
              <div className="proposal-media">
                {o.qcPhotos.map((src, i) => <MediaThumb key={i} media={{ kind: "image", src }} alt={d.qc} />)}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
