import { useState } from "react";
import { useAuth } from "../../lib/auth.jsx";
import { getCatalogItem, listCatalog, listWarrantyRegs, registerWarranty } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

export default function DealerRegs() {
  useDBVersion();
  const { p, locale } = useLocale();
  const r = p.dealer.regs;
  const { user } = useAuth();
  const regs = listWarrantyRegs({ dealerId: user.id });
  const [form, setForm] = useState({ itemId: listCatalog()[0]?.id || "", buyerName: "", buyerContact: "", soldAt: new Date().toISOString().slice(0, 10) });
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function submit(e) {
    e.preventDefault();
    registerWarranty(user.id, form);
    setForm((f) => ({ ...f, buyerName: "", buyerContact: "" }));
  }

  return (
    <>
      <p className="form-hint" style={{ marginBottom: 18 }}>{r.sub}</p>
      <form className="panel form-stack" onSubmit={submit}>
        <h3>{r.submit}</h3>
        <div className="filter-grid">
          <label className="field"><span>{r.item}</span>
            <select value={form.itemId} onChange={(e) => setF({ itemId: e.target.value })}>
              {listCatalog().map((it) => <option key={it.id} value={it.id}>{pickI18n(it.name, locale)}</option>)}
            </select></label>
          <label className="field"><span>{r.buyer}</span><input value={form.buyerName} onChange={(e) => setF({ buyerName: e.target.value })} required /></label>
          <label className="field"><span>{r.contact}</span><input value={form.buyerContact} onChange={(e) => setF({ buyerContact: e.target.value })} required /></label>
          <label className="field"><span>{r.soldAt}</span><input type="date" value={form.soldAt} onChange={(e) => setF({ soldAt: e.target.value })} required /></label>
        </div>
        <button className="button primary" type="submit">{r.submit}</button>
      </form>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{r.title} ({regs.length})</h3>
        {regs.length === 0 ? <EmptyNote>{r.empty}</EmptyNote> : (
          <table className="data-table">
            <thead><tr><th>{r.buyer}</th><th>{r.item}</th><th>{r.soldAt}</th><th>{r.until}</th></tr></thead>
            <tbody>
              {regs.map((reg) => (
                <tr key={reg.id}>
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
    </>
  );
}
