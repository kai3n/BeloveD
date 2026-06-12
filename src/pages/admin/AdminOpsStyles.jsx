import { useState } from "react";
import { listOpsStyles, listStyleSpecs, saveOpsStyle, saveStyleSpec } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

export default function AdminOpsStyles() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.opsA.styles;
  const styles = listOpsStyles();
  const specs = listStyleSpecs();
  const [f, setF] = useState({ name: "", category: "ring", estWeightG: "", laborUsd: "", leadDays: "" });
  const [sp, setSp] = useState({ styleId: "", metal: "18kw", size: "", centerStoneSpec: "", estWeightG: "", variancePct: 6, laborUsd: "", materialsUsd: "" });

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{t.title} ({styles.length})</h3>
        <table className="data-table">
          <thead><tr><th>ID</th><th>{p.admin.tpl.name}</th><th>{t.estW}</th><th>{t.labor}</th><th>{t.leadDays}</th><th>{t.available}</th><th>{t.published}</th></tr></thead>
          <tbody>
            {styles.map((st) => (
              <tr key={st.id}>
                <td>{st.id}</td>
                <td>{pickI18n(st.name, locale)}</td>
                <td>{st.estWeightG}g</td>
                <td>{usd(st.laborUsd)}</td>
                <td>{st.leadDays}</td>
                <td><button className={`chip ${st.availableForSale ? "is-active" : ""}`} onClick={() => saveOpsStyle({ id: st.id, availableForSale: !st.availableForSale })}>{t.available}</button></td>
                <td><button className={`chip ${st.published ? "is-active" : ""}`} onClick={() => saveOpsStyle({ id: st.id, published: !st.published })}>{t.published}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={(e) => {
        e.preventDefault();
        saveOpsStyle({
          name: { ko: f.name, en: f.name, zh: f.name, es: f.name }, category: f.category,
          coverImage: "/assets/lab-diamond-tweezers.png", metalOptions: ["18kw", "18ky"],
          estWeightG: Number(f.estWeightG), laborUsd: Number(f.laborUsd), leadDays: Number(f.leadDays),
        });
        setF({ name: "", category: "ring", estWeightG: "", laborUsd: "", leadDays: "" });
      }}>
        <h3>{t.addStyle}</h3>
        <div className="filter-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
          <label className="field"><span>{p.admin.tpl.name}</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
          <label className="field"><span>{p.admin.tpl.category}</span>
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(p.opsCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="field"><span>{t.estW}</span><input type="number" step="0.1" value={f.estWeightG} onChange={(e) => setF({ ...f, estWeightG: e.target.value })} required /></label>
          <label className="field"><span>{t.labor}</span><input type="number" value={f.laborUsd} onChange={(e) => setF({ ...f, laborUsd: e.target.value })} required /></label>
          <label className="field"><span>{t.leadDays}</span><input type="number" value={f.leadDays} onChange={(e) => setF({ ...f, leadDays: e.target.value })} required /></label>
        </div>
        <button className="button secondary small" type="submit">{p.common.add}</button>
      </form>

      <div className="panel form-stack">
        <h3>{t.specs} ({specs.length})</h3>
        {specs.map((s) => (
          <p key={s.id} className="form-hint">
            {s.styleId} + {p.opsMetals[s.metal] || s.metal} + {s.size} + {s.centerStoneSpec} → {s.estWeightG}g ±{s.variancePct}% · {usd(s.laborUsd)} · {s.status}
          </p>
        ))}
        <h3 style={{ marginTop: 10 }}>{t.newSpec}</h3>
        <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <label className="field"><span>Style</span>
            <select value={sp.styleId} onChange={(e) => setSp({ ...sp, styleId: e.target.value })}>
              <option value="" disabled>—</option>
              {styles.map((st) => <option key={st.id} value={st.id}>{st.id}</option>)}
            </select></label>
          <label className="field"><span>{p.intake.metal}</span>
            <select value={sp.metal} onChange={(e) => setSp({ ...sp, metal: e.target.value })}>
              {Object.entries(p.opsMetals).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="field"><span>Size</span><input value={sp.size} onChange={(e) => setSp({ ...sp, size: e.target.value })} /></label>
          <label className="field"><span>{t.combo}</span><input value={sp.centerStoneSpec} onChange={(e) => setSp({ ...sp, centerStoneSpec: e.target.value })} /></label>
          <label className="field"><span>{t.estW}</span><input type="number" step="0.1" value={sp.estWeightG} onChange={(e) => setSp({ ...sp, estWeightG: e.target.value })} /></label>
          <label className="field"><span>{t.variance}</span><input type="number" value={sp.variancePct} onChange={(e) => setSp({ ...sp, variancePct: e.target.value })} /></label>
          <label className="field"><span>{t.labor}</span><input type="number" value={sp.laborUsd} onChange={(e) => setSp({ ...sp, laborUsd: e.target.value })} /></label>
          <label className="field"><span>{t.materials}</span><input type="number" value={sp.materialsUsd} onChange={(e) => setSp({ ...sp, materialsUsd: e.target.value })} /></label>
        </div>
        <button className="button secondary small" disabled={!sp.styleId}
          onClick={() => { saveStyleSpec({ ...sp, estWeightG: Number(sp.estWeightG), variancePct: Number(sp.variancePct), laborUsd: Number(sp.laborUsd), materialsUsd: Number(sp.materialsUsd) || 0 }); }}>
          {p.common.add}
        </button>
      </div>
    </>
  );
}
