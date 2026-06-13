import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { listPoolDiamonds, savePoolDiamond, archivePoolDiamond, setPoolAvailability } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, usd } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

const SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher", "heart"];
const empty = { shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", igiNo: "", colorTreatment: "disclosed", procurementCostUsd: "" };

export default function SupplierPool() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.supplierPool;
  const { user } = useAuth();
  const stones = listPoolDiamonds({ supplierId: user.id, includeArchived: true });
  const [form, setForm] = useState(empty);
  const [media, setMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function add(e) {
    e.preventDefault();
    savePoolDiamond({
      supplierId: user.id, shape: form.shape, carat: Number(form.carat), color: form.color, clarity: form.clarity,
      growth: form.growth, lab: form.lab, certOrg: form.certOrg, igiNo: form.igiNo,
      colorTreatment: form.colorTreatment, procurementCostUsd: Number(form.procurementCostUsd) || 0,
      ...(media.length ? { media } : {}),
    });
    setForm(empty); setMedia([]);
  }

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>
      <p style={{ marginTop: -28, marginBottom: 24 }}><Link className="text-link" to="/supplier">← {p.supplierP.queue}</Link></p>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{t.count(listPoolDiamonds({ supplierId: user.id }).length)}</h3>
        <table className="data-table">
          <thead><tr><th>{t.stone}</th><th>{t.fourC}</th><th>{t.cert}</th><th>{t.cost}</th><th>{t.statusCol}</th><th>{t.photos}</th><th></th></tr></thead>
          <tbody>
            {stones.map((s) => (
              <tr key={s.id} style={{ opacity: s.archived ? 0.5 : 1 }}>
                <td>{p.shapes[s.shape]} {Number(s.carat).toFixed(2)}ct</td>
                <td>{s.color} · {s.clarity} · {s.growth}</td>
                <td>{s.certOrg} {s.igiNo}</td>
                <td>{usd(s.procurementCostUsd)}</td>
                <td>
                  {s.availability === "sold" ? (
                    <span className="status-badge">{t.avail.sold}</span>
                  ) : (
                    <button className={`chip ${s.availability === "available" ? "is-active" : ""}`}
                      disabled={s.archived}
                      onClick={() => setPoolAvailability(s.id, s.availability === "available" ? "unavailable" : "available")}>
                      {s.availability === "available" ? t.avail.available : t.avail.unavailable}
                    </button>
                  )}
                </td>
                <td>{(s.media || []).length}</td>
                <td>
                  <button className="button small" onClick={() => archivePoolDiamond(s.id, !s.archived)}>
                    {s.archived ? t.restore : t.archive}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={add}>
        <h3>{t.newTitle}</h3>
        <div className="filter-grid">
          <label className="field"><span>{t.shape}</span>
            <select value={form.shape} onChange={(e) => setF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{p.shapes[s]}</option>)}</select></label>
          <label className="field"><span>{t.carat}</span><input type="number" step="0.01" value={form.carat} onChange={(e) => setF({ carat: e.target.value })} required /></label>
          <label className="field"><span>{t.color}</span>
            <select value={form.color} onChange={(e) => setF({ color: e.target.value })}>{["D", "E", "F", "G", "H", "I", "J"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{t.clarity}</span>
            <select value={form.clarity} onChange={(e) => setF({ clarity: e.target.value })}>{["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{t.growth}</span>
            <select value={form.growth} onChange={(e) => setF({ growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
          <label className="field"><span>{t.lab}</span>
            <select value={form.lab} onChange={(e) => setF({ lab: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>{t.certOrg}</span>
            <select value={form.certOrg} onChange={(e) => setF({ certOrg: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>{t.certNo}</span><input value={form.igiNo} onChange={(e) => setF({ igiNo: e.target.value })} required /></label>
          <label className="field"><span>{t.costField}</span><input type="number" step="10" value={form.procurementCostUsd} onChange={(e) => setF({ procurementCostUsd: e.target.value })} required /></label>
        </div>
        <MediaPicker value={media} onChange={setMedia} />
        <button className="button primary" type="submit">{t.addBtn}</button>
      </form>
    </div>
  );
}
