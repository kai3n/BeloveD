import { useState } from "react";
import { listPoolDiamonds, savePoolDiamond, archivePoolDiamond, listVendors } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, usd } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

const SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher", "heart"];

export default function AdminPool() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.admin.pool;
  const vendors = listVendors();
  const [filter, setFilter] = useState("");
  const all = listPoolDiamonds({ includeArchived: true });
  const stones = filter ? all.filter((s) => s.supplierId === filter) : all;
  const supplierName = (id) => vendors.find((v) => v.id === id)?.name || id;

  const [form, setForm] = useState({ supplierId: vendors[0]?.id || "", shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", igiNo: "", colorTreatment: "disclosed", procurementCostUsd: "" });
  const [media, setMedia] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editMedia, setEditMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function add(e) {
    e.preventDefault();
    savePoolDiamond({
      supplierId: form.supplierId, shape: form.shape, carat: Number(form.carat), color: form.color, clarity: form.clarity,
      growth: form.growth, lab: form.lab, certOrg: form.certOrg, igiNo: form.igiNo,
      colorTreatment: form.colorTreatment, procurementCostUsd: Number(form.procurementCostUsd) || 0,
      ...(media.length ? { media } : {}),
    });
    setForm({ ...form, igiNo: "", procurementCostUsd: "" }); setMedia([]);
  }
  function startEdit(s) { setEditId(s.id); setEditMedia(s.media || []); }
  function saveEditMedia() { savePoolDiamond({ id: editId, media: editMedia }); setEditId(null); setEditMedia([]); }

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>{t.title} · {t.count(stones.length)}</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "8px 10px" }}>
            <option value="">{t.filterAll}</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <p className="form-hint" style={{ marginTop: 6 }}>{t.sub}</p>
        <table className="data-table">
          <thead><tr><th>{t.supplier}</th><th>{t.stone}</th><th>{t.fourC}</th><th>{t.cert}</th><th>{t.cost}</th><th>{t.statusCol}</th><th>{t.photos}</th><th></th></tr></thead>
          <tbody>
            {stones.map((s) => (
              <tr key={s.id} style={{ opacity: s.archived ? 0.5 : 1 }}>
                <td>{supplierName(s.supplierId)}</td>
                <td>{p.shapes[s.shape]} {Number(s.carat).toFixed(2)}ct</td>
                <td>{s.color} · {s.clarity} · {s.growth}</td>
                <td>{s.certOrg} {s.igiNo}</td>
                <td>{usd(s.procurementCostUsd)}</td>
                <td><span className="status-badge">{t.avail[s.availability] || s.availability}{s.archived ? ` · ${t.archived}` : ""}</span></td>
                <td>{(s.media || []).length}</td>
                <td>
                  <div className="row-actions">
                    <button className="button small" onClick={() => startEdit(s)}>{t.photos}</button>
                    <button className="button small" onClick={() => archivePoolDiamond(s.id, !s.archived)}>{s.archived ? t.restore : t.archive}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <div className="panel form-stack">
          <h3>{t.edit} — {editId}</h3>
          <MediaPicker value={editMedia} onChange={setEditMedia} />
          <div className="row-actions">
            <button className="button primary small" onClick={saveEditMedia}>{t.save}</button>
            <button className="button small" onClick={() => setEditId(null)}>✕</button>
          </div>
        </div>
      )}

      <form className="panel form-stack" onSubmit={add}>
        <h3>{t.newTitle}</h3>
        <div className="filter-grid">
          <label className="field"><span>{t.supplier}</span>
            <select value={form.supplierId} onChange={(e) => setF({ supplierId: e.target.value })} required>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.shape}</span>
            <select value={form.shape} onChange={(e) => setF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{p.shapes[s]}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.carat}</span><input type="number" step="0.01" value={form.carat} onChange={(e) => setF({ carat: e.target.value })} required /></label>
          <label className="field"><span>{p.supplierPool.color}</span>
            <select value={form.color} onChange={(e) => setF({ color: e.target.value })}>{["D", "E", "F", "G", "H", "I", "J"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.clarity}</span>
            <select value={form.clarity} onChange={(e) => setF({ clarity: e.target.value })}>{["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.growth}</span>
            <select value={form.growth} onChange={(e) => setF({ growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
          <label className="field"><span>{p.supplierPool.certOrg}</span>
            <select value={form.certOrg} onChange={(e) => setF({ certOrg: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>{p.supplierPool.certNo}</span><input value={form.igiNo} onChange={(e) => setF({ igiNo: e.target.value })} required /></label>
          <label className="field"><span>{p.supplierPool.costField}</span><input type="number" step="10" value={form.procurementCostUsd} onChange={(e) => setF({ procurementCostUsd: e.target.value })} required /></label>
        </div>
        <MediaPicker value={media} onChange={setMedia} />
        <button className="button primary" type="submit">{t.addBtn}</button>
      </form>
    </>
  );
}
