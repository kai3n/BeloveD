import { useState } from "react";
import { getSettings, listCatalog, saveCatalogItem, updateSettings } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

export default function AdminCatalogW() {
  useDBVersion();
  const { p, locale } = useLocale();
  const c = p.adminDealer.catalog;
  const settings = getSettings();
  const items = listCatalog({ includeHidden: true });
  const [form, setForm] = useState({ name: "", category: "ring", msrpUsd: "", stoneWholesaleT1: "", stoneWholesaleT2: "", metalGrams: "", laborUsd: "" });
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  const numCell = (item, field, step = 10) => (
    <input type="number" step={step} defaultValue={item[field]} key={`${item.id}-${field}-${item[field]}`}
      onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== item[field]) saveCatalogItem({ id: item.id, [field]: v }); }} />
  );

  function addSku(e) {
    e.preventDefault();
    saveCatalogItem({
      name: { ko: form.name, en: form.name, zh: form.name, es: form.name },
      category: form.category, image: "/assets/lab-diamond-tweezers.png",
      msrpUsd: Number(form.msrpUsd), stoneWholesaleT1: Number(form.stoneWholesaleT1), stoneWholesaleT2: Number(form.stoneWholesaleT2),
      metalGrams: Number(form.metalGrams), laborUsd: Number(form.laborUsd), resizable: true, visible: true,
    });
    setForm({ name: "", category: "ring", msrpUsd: "", stoneWholesaleT1: "", stoneWholesaleT2: "", metalGrams: "", laborUsd: "" });
  }

  return (
    <>
      <div className="panel form-stack" style={{ maxWidth: 420 }}>
        <h3>{c.goldSpot}</h3>
        <input type="number" step="0.5" defaultValue={settings.goldSpotPerGram} key={settings.goldSpotPerGram}
          onBlur={(e) => updateSettings({ goldSpotPerGram: Number(e.target.value) })}
          style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "10px 12px" }} />
        <p className="form-hint">{c.applied}</p>
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{c.title} ({items.length})</h3>
        <table className="data-table">
          <thead><tr><th>{c.name}</th><th>{c.msrp}</th><th>{c.t1}</th><th>{c.t2}</th><th>{c.grams}</th><th>{c.labor}</th><th>{c.resizable}</th><th /></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{pickI18n(item.name, locale)}<br /><span className="form-hint">{usd(item.msrpUsd)} MSRP</span></td>
                <td>{numCell(item, "msrpUsd")}</td>
                <td>{numCell(item, "stoneWholesaleT1")}</td>
                <td>{numCell(item, "stoneWholesaleT2")}</td>
                <td>{numCell(item, "metalGrams", 0.1)}</td>
                <td>{numCell(item, "laborUsd", 5)}</td>
                <td>
                  <button className={`chip ${item.resizable ? "is-active" : ""}`} onClick={() => saveCatalogItem({ id: item.id, resizable: !item.resizable })}>
                    {item.resizable ? c.yes : c.no}
                  </button>
                </td>
                <td>
                  <button className={`chip ${item.visible ? "is-active" : ""}`} onClick={() => saveCatalogItem({ id: item.id, visible: !item.visible })}>
                    {item.visible ? p.admin.dia.pub : p.admin.dia.priv}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={addSku}>
        <h3>{c.newTitle}</h3>
        <div className="filter-grid">
          <label className="field"><span>{c.name}</span><input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></label>
          <label className="field"><span>{p.admin.tpl.category}</span>
            <select value={form.category} onChange={(e) => setF({ category: e.target.value })}>
              {Object.entries(p.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="field"><span>{c.msrp}</span><input type="number" value={form.msrpUsd} onChange={(e) => setF({ msrpUsd: e.target.value })} required /></label>
          <label className="field"><span>{c.t1}</span><input type="number" value={form.stoneWholesaleT1} onChange={(e) => setF({ stoneWholesaleT1: e.target.value })} required /></label>
          <label className="field"><span>{c.t2}</span><input type="number" value={form.stoneWholesaleT2} onChange={(e) => setF({ stoneWholesaleT2: e.target.value })} required /></label>
          <label className="field"><span>{c.grams}</span><input type="number" step="0.1" value={form.metalGrams} onChange={(e) => setF({ metalGrams: e.target.value })} required /></label>
          <label className="field"><span>{c.labor}</span><input type="number" value={form.laborUsd} onChange={(e) => setF({ laborUsd: e.target.value })} required /></label>
        </div>
        <button className="button primary" type="submit">{p.common.add}</button>
      </form>
    </>
  );
}
