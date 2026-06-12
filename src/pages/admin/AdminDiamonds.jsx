import { useState } from "react";
import { adjustDiamondPrices, listDiamonds, saveDiamond } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, won } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

const SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher", "heart"];

const emptyForm = { shape: "round", carat: "1.0", cut: "Excellent", color: "D", clarity: "VS1", certOrg: "IGI", certNo: "", priceKrw: "" };

export default function AdminDiamonds() {
  useDBVersion();
  const { p } = useLocale();
  const diamonds = listDiamonds({ includeHidden: true });
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formMedia, setFormMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function addDiamond(e) {
    e.preventDefault();
    saveDiamond({
      shape: form.shape, carat: Number(form.carat), cut: form.cut, color: form.color,
      clarity: form.clarity, certOrg: form.certOrg, certNo: form.certNo,
      priceKrw: Number(form.priceKrw), visible: true,
      ...(formMedia.length ? { media: formMedia } : {}),
    });
    setForm(emptyForm); setFormMedia([]);
  }

  return (
    <>
      <div className="panel">
        <h3>{p.admin.dia.bulkTitle}</h3>
        <div className="row-actions">
          <input type="number" step="0.5" placeholder="%" value={bulk} onChange={(e) => setBulk(e.target.value)}
            style={{ width: 100, background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "9px 10px" }} />
          <button className="button secondary small" disabled={!bulk} onClick={() => { adjustDiamondPrices(Number(bulk)); setBulk(""); }}>
            {p.admin.dia.bulkBtn(bulk || "n")}
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: 8 }}>{p.admin.dia.bulkHint}</p>
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{p.admin.dia.invTitle} ({diamonds.length})</h3>
        <table className="data-table">
          <thead><tr><th>{p.admin.dia.stone}</th><th>{p.admin.dia.fourC}</th><th>{p.admin.dia.cert}</th><th>{p.admin.dia.priceCol}</th><th>{p.admin.dia.visibleCol}</th></tr></thead>
          <tbody>
            {diamonds.map((d) => (
              <tr key={d.id}>
                <td>{p.shapes[d.shape]} {d.carat.toFixed(1)}ct</td>
                <td>{d.cut} · {d.color} · {d.clarity}</td>
                <td>{d.certOrg} {d.certNo}</td>
                <td>
                  <input
                    type="number" step="10000" defaultValue={d.priceKrw} key={`${d.id}-${d.priceKrw}`}
                    onBlur={(e) => { const v = Number(e.target.value); if (v && v !== d.priceKrw) saveDiamond({ id: d.id, priceKrw: v }); }}
                  />
                  <span className="form-hint"> {won(d.priceKrw)}</span>
                </td>
                <td>
                  <button className={`chip ${d.visible ? "is-active" : ""}`} onClick={() => saveDiamond({ id: d.id, visible: !d.visible })}>
                    {d.visible ? p.admin.dia.pub : p.admin.dia.priv}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={addDiamond}>
        <h3>{p.admin.dia.newTitle}</h3>
        <div className="filter-grid">
          <label className="field"><span>{p.admin.dia.shape}</span>
            <select value={form.shape} onChange={(e) => setF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{p.shapes[s]}</option>)}</select></label>
          <label className="field"><span>{p.admin.dia.carat}</span><input type="number" step="0.01" value={form.carat} onChange={(e) => setF({ carat: e.target.value })} required /></label>
          <label className="field"><span>{p.admin.dia.cut}</span>
            <select value={form.cut} onChange={(e) => setF({ cut: e.target.value })}><option>Excellent</option><option>Very Good</option><option>Good</option></select></label>
          <label className="field"><span>{p.admin.dia.color}</span>
            <select value={form.color} onChange={(e) => setF({ color: e.target.value })}>{["D", "E", "F", "G", "H"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{p.admin.dia.clarity}</span>
            <select value={form.clarity} onChange={(e) => setF({ clarity: e.target.value })}>{["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{p.admin.dia.certOrg}</span>
            <select value={form.certOrg} onChange={(e) => setF({ certOrg: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>{p.admin.dia.certNo}</span><input value={form.certNo} onChange={(e) => setF({ certNo: e.target.value })} required /></label>
          <label className="field"><span>{p.admin.dia.price}</span><input type="number" step="10000" value={form.priceKrw} onChange={(e) => setF({ priceKrw: e.target.value })} required /></label>
        </div>
        <MediaPicker value={formMedia} onChange={setFormMedia} />
        <button className="button primary" type="submit">{p.admin.dia.addBtn}</button>
      </form>
    </>
  );
}
