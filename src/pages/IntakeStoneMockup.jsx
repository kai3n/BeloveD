import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import StoneEduPanel from "../components/StoneEducation.jsx";
import RingSizeHelp from "../components/RingSizeHelp.jsx";

/*
  MOCKUP — keep the Product and Center-stone steps in their DEFAULT design,
  and add ONE thing: a live competitor price-comparison card in the side rail
  that reflects the current setup (Blue Nile / Brilliant Earth vs BeloveD).
  Self-contained: local pricing + scoped <style>. Uses global form classes so it reads native.
*/

const SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher", "heart"];
const SHAPE_LABEL = {
  round: "Round", oval: "Oval", princess: "Princess", emerald: "Emerald", pear: "Pear",
  marquise: "Marquise", cushion: "Cushion", radiant: "Radiant", asscher: "Asscher", heart: "Heart",
};
const COLORS = ["D", "E", "F", "G"];
const CLARITIES = ["IF", "VVS1", "VVS2", "VS1", "VS2"];
const CATEGORIES = { ring: "Ring", earrings: "Earrings", necklace: "Necklace / Pendant", bangle: "Bracelet" };
const METALS = { "18kw": "18K White Gold", "18ky": "18K Yellow Gold", "18kr": "18K Rose Gold", plat: "Platinum", "14kw": "14K White Gold" };
const PRODUCT_LINES = { solitaire: "Solitaire (single center stone)", multi: "Multi-stone" };

const SETTING_BY_CAT = { ring: 1100, earrings: 1300, necklace: 900, bangle: 1500 };
const METAL_MULT = { "18kw": 1, "18ky": 1, "18kr": 1, plat: 1.35, "14kw": 0.85 };
const STONE_QTY = { ring: 1, earrings: 2, necklace: 1, bangle: 1 };

const usd = (n) => `$${(Math.round(Number(n || 0) / 10) * 10).toLocaleString("en-US")}`;

function stonePrice(carat, color, clarity) {
  const base = 1400 * Math.pow(Number(carat) || 1, 1.84);
  const cMult = { D: 1.15, E: 1.08, F: 1.0, G: 0.9 }[color] ?? 1;
  const clMult = { IF: 1.18, VVS1: 1.12, VVS2: 1.08, VS1: 1.02, VS2: 0.96 }[clarity] ?? 1;
  return base * cMult * clMult;
}

function belovedTotal(s) {
  const stone = stonePrice(s.carat, s.color, s.clarity) * (STONE_QTY[s.category] || 1);
  const setting = (SETTING_BY_CAT[s.category] || 1100) * (METAL_MULT[s.metal] || 1);
  return stone + setting;
}

// competitor ranges as multiples of the BeloveD mid total (mirrors the home comparison board)
function priceBoard(s) {
  const total = belovedTotal(s);
  const rows = [
    { name: "Blue Nile", lo: total * 1.82, hi: total * 2.24, cert: "GIA / IGI" },
    { name: "Brilliant Earth", lo: total * 1.52, hi: total * 1.9, cert: "IGI / GIA" },
    { name: "BeloveD", lo: total * 0.92, hi: total * 1.1, cert: "IGI / GIA", me: true },
  ];
  const max = rows[0].hi;
  const beloved = rows.find((r) => r.me);
  const save = rows[0].hi - beloved.lo;
  return { rows: rows.map((r) => ({ ...r, width: Math.round((r.hi / max) * 100) })), beloved, save };
}

function PriceBoard({ setup, preliminary }) {
  const { rows, beloved, save } = useMemo(() => priceBoard(setup), [setup]);
  return (
    <section className="pcmp-band" aria-label="Competitor price comparison">
      <header className="pcmp-band-head">
        <div>
          <p className="pcmp-kicker">{preliminary ? "Preliminary total · refined at center stone" : "Estimated total · confirmed in quote"}</p>
          <strong className="pcmp-num">{usd(beloved.lo)} – {usd(beloved.hi)}</strong>
        </div>
        <span className="pcmp-save">Up to {usd(save)} less than Blue Nile</span>
      </header>

      <div className="pcmp-rows" role="list" aria-label="Price comparison with competitors">
        {rows.map((r) => (
          <div className={`pcmp-row ${r.me ? "me" : ""}`} role="listitem" key={r.name}>
            <span className="pcmp-name">{r.name}{r.me && <em>Lowest</em>}</span>
            <span className="pcmp-track"><i style={{ width: `${r.width}%` }} /></span>
            <span className="pcmp-range">{usd(r.lo)}–{usd(r.hi)}</span>
          </div>
        ))}
      </div>

      <p className="pcmp-foot"><BadgeCheck size={13} strokeWidth={1.7} /> Comparable spec · stone + setting. Final price confirmed in your quote.</p>
    </section>
  );
}

const TABS = [
  { key: "product", label: "Product step" },
  { key: "stone", label: "Center stone step" },
];

export default function IntakeStoneMockup() {
  const [tab, setTab] = useState("stone");
  const [eduField, setEduField] = useState("carat"); // guide box follows the focused field
  const [setup, setSetup] = useState({
    productLine: "solitaire", category: "ring", metal: "18kw",
    shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD",
  });
  const set = (patch) => setSetup((s) => ({ ...s, ...patch }));
  const stepIndex = tab === "product" ? 0 : 1;
  const steps = ["Product", "Center stone", "References", "Review"];

  return (
    <div className="page pcmp-root" style={{ maxWidth: 1020 }}>
      <style>{PCMP_CSS}</style>

      <h1 className="page-title">Custom Order Request</h1>
      <p className="page-sub" style={{ marginBottom: 26 }}>
        Tell us what you want to create. An Order ID and a private tracking code are issued on submission — no payment until you accept the quote.
      </p>

      <div className="pcmp-tabs" role="tablist" aria-label="Mockup step">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
        <span className="pcmp-tabnote">Mockup — default form, with a live competitor price card in the rail</span>
      </div>

      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={s} className={i < stepIndex ? "done" : i === stepIndex ? "current" : ""}><span className="dot" />{s}</li>
        ))}
      </ol>
      <p className="form-hint intake-meta-note" style={{ textAlign: "right" }}>* Required field · Draft saved automatically</p>

      <div className="intake-layout has-edu">
        {/* ── LEFT: default form controls ── */}
        <form className="panel form-stack" onSubmit={(e) => e.preventDefault()}>
          {tab === "product" ? (
            <>
              <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label className="field"><span>Product line</span>
                  <select value={setup.productLine} onChange={(e) => set({ productLine: e.target.value })}>
                    {Object.entries(PRODUCT_LINES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></label>
                <label className="field"><span>Category</span>
                  <select value={setup.category} onChange={(e) => set({ category: e.target.value })}>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></label>
                <label className="field"><span>Style</span>
                  <select defaultValue=""><option value="">No specific style</option><option>RING-001 — Solitaire</option><option>RING-003 — Hidden Halo</option></select></label>
                <label className="field"><span>Metal</span>
                  <select value={setup.metal} onChange={(e) => set({ metal: e.target.value })}>
                    {Object.entries(METALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></label>
                <label className="field"><span>Budget</span><input type="number" step="100" placeholder="Flexible" /></label>
                <label className="field"><span>Target date</span><input type="date" /></label>
                <label className="field"><span>Country <span className="req">*</span></span><input placeholder="United States" /></label>
              </div>
              {setup.category === "ring" && (
                <label className="field"><span>Ring size <span className="req">*</span></span><input placeholder="6 US" /></label>
              )}
            </>
          ) : (
            <>
              <h3 style={{ margin: 0 }}>Center stone preferences <span className="pcmp-tag">solitaire</span></h3>
              <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <label className="field"><span>Shape</span>
                  <select value={setup.shape} onFocus={() => setEduField("shape")} onChange={(e) => set({ shape: e.target.value })}>
                    {SHAPES.map((sh) => <option key={sh} value={sh}>{SHAPE_LABEL[sh]}</option>)}
                  </select></label>
                <label className="field"><span>Carat</span>
                  <input type="number" step="0.1" value={setup.carat} onFocus={() => setEduField("carat")} onChange={(e) => set({ carat: e.target.value })} /></label>
                <label className="field"><span>Color</span>
                  <select value={setup.color} onFocus={() => setEduField("color")} onChange={(e) => set({ color: e.target.value })}>
                    {COLORS.map((c) => <option key={c}>{c}</option>)}
                  </select></label>
                <label className="field"><span>Clarity</span>
                  <select value={setup.clarity} onFocus={() => setEduField("clarity")} onChange={(e) => set({ clarity: e.target.value })}>
                    {CLARITIES.map((c) => <option key={c}>{c}</option>)}
                  </select></label>
                <label className="field"><span>Growth method</span>
                  <select value={setup.growth} onFocus={() => setEduField("growth")} onChange={(e) => set({ growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
              </div>
              <details className="more-prefs">
                <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "4px 0" }}>More preferences (optional)</summary>
                <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 12 }}>
                  <label className="field"><span>Lab</span><input defaultValue="IGI India" /></label>
                  <label className="field"><span>Fluorescence</span><select><option>None</option><option>Faint</option><option>Medium</option></select></label>
                  <label className="field"><span>L/W ratio</span><input placeholder="1.0" /></label>
                </div>
              </details>
            </>
          )}

          <div className="wizard-nav">
            <button type="button" className="button secondary">Back</button>
            <button type="button" className="button primary">Next</button>
          </div>
        </form>

        {/* ── RIGHT: the original guide box (core) ── */}
        <aside className="pcmp-aside">
          {tab === "stone"
            ? <StoneEduPanel field={eduField} prefs={{ ...setup, carat: Number(setup.carat) || 0, fluorescence: "none", lwRatio: "" }} />
            : (setup.category === "ring" ? <RingSizeHelp /> : null)}
        </aside>
      </div>

      {/* full-width competitor price comparison — reads like the home "retail markup, made visible" board */}
      <PriceBoard setup={setup} preliminary={tab === "product"} />

      <p style={{ marginTop: 18 }}><Link className="text-link" to="/custom/flow-mockup">← Back to the 3-version flow mockup</Link></p>
    </div>
  );
}

const PCMP_CSS = `
.pcmp-root *, .pcmp-root *::before, .pcmp-root *::after { box-sizing: border-box; }
.pcmp-tag { font-family: var(--sans); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--quiet); margin-left: 8px; }

.pcmp-tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 24px; flex-wrap: wrap; }
.pcmp-tabs button { border: 1px solid var(--line); background: var(--bg-2); color: var(--muted); font-family: var(--sans); font-size: 12.5px; padding: 8px 16px; border-radius: 999px; cursor: pointer; transition: all .16s ease; }
.pcmp-tabs button:hover { color: var(--text); border-color: var(--line-strong); }
.pcmp-tabs button.on { background: var(--accent); border-color: var(--accent); color: #15120c; }
.pcmp-tabnote { font-size: 11px; color: var(--quiet); margin-left: 4px; }

.pcmp-aside { flex: 0 0 300px; }

/* full-width competitor price band */
.pcmp-band { border: 1px solid var(--line); background: var(--bg-2); padding: 26px 28px; margin-top: 24px; }
.pcmp-band-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 1px solid var(--hair); }
.pcmp-kicker { font-family: var(--sans); font-size: 10.5px; letter-spacing: .2em; text-transform: uppercase; color: var(--accent); margin: 0 0 9px; }
.pcmp-num { display: block; font-family: var(--serif); font-weight: 500; font-size: 30px; color: var(--accent-bright); font-variant-numeric: tabular-nums; line-height: 1; }
.pcmp-save { font-size: 11.5px; letter-spacing: .04em; color: #15120c; background: var(--accent); padding: 7px 13px; white-space: nowrap; }

.pcmp-rows { display: grid; gap: 15px; }
.pcmp-row { display: grid; grid-template-columns: 150px 1fr 128px; align-items: center; gap: 18px; }
.pcmp-name { font-size: 13px; color: var(--muted); display: inline-flex; align-items: center; gap: 8px; }
.pcmp-name em { font-style: normal; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: #15120c; background: var(--accent); padding: 2px 6px; }
.pcmp-range { font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.pcmp-row.me .pcmp-name { color: var(--text); font-weight: 500; }
.pcmp-row.me .pcmp-range { color: var(--accent-bright); }
.pcmp-track { height: 9px; background: var(--surface-2); overflow: hidden; }
.pcmp-track i { display: block; height: 100%; background: var(--line-strong); }
.pcmp-row.me .pcmp-track i { background: linear-gradient(90deg, var(--gold-deep), var(--accent-bright)); }

.pcmp-foot { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--quiet); margin: 22px 0 0; }
.pcmp-foot svg { color: var(--accent); flex: none; }

@media (max-width: 700px) {
  .pcmp-row { grid-template-columns: 104px 1fr; }
  .pcmp-range { grid-column: 2; text-align: left; }
}
`;
