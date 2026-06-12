import { getCatalogItem, getUser, listWarrantyRegs } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

export default function AdminWarranty() {
  useDBVersion();
  const { p, locale } = useLocale();
  const w = p.adminDealer.warranty;
  const r = p.dealer.regs;
  const regs = listWarrantyRegs();

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <h3>{w.title} ({regs.length})</h3>
      <p className="form-hint" style={{ marginBottom: 14 }}>{w.note}</p>
      {regs.length === 0 ? <EmptyNote>{r.empty}</EmptyNote> : (
        <table className="data-table">
          <thead><tr><th>{w.dealer}</th><th>{r.buyer}</th><th>{r.item}</th><th>{r.soldAt}</th><th>{r.until}</th></tr></thead>
          <tbody>
            {regs.map((reg) => (
              <tr key={reg.id}>
                <td>{getUser(reg.dealerId)?.name}</td>
                <td>{reg.buyerName}<br /><span className="form-hint">{reg.buyerContact}</span></td>
                <td>{pickI18n(getCatalogItem(reg.itemId)?.name, locale)}</td>
                <td>{reg.soldAt}</td>
                <td>{reg.warrantyUntil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
