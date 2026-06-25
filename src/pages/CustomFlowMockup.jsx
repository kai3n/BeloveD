import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Gem,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/*
  CUSTOM FLOW MOCKUP — 3 versions of the same "minimal brief -> vendor match -> approve" flow.
  Customer input = design + shape + carat (no budget, no 4C jargon).
  Self-contained: local data + scoped <style>, depends on nothing in the store. Safe to delete.
  Pulls global NOIR tokens (--serif/--accent/--bg/...) so it matches brand + day/night theme.
*/

// ── center-stone shapes (thin gold glyph) ───────────────────────────────────
const SHAPE_GLYPH = {
  round: <circle cx="20" cy="20" r="15" />,
  oval: <ellipse cx="20" cy="20" rx="11" ry="16" />,
  emerald: <polygon points="14,5 26,5 31,10 31,30 26,35 14,35 9,30 9,10" />,
  princess: <rect x="7" y="7" width="26" height="26" />,
  pear: <path d="M20 5 C27 12 31 18 31 24 C31 31 26 35 20 35 C14 35 9 31 9 24 C9 18 13 12 20 5 Z" />,
  cushion: <rect x="7" y="7" width="26" height="26" rx="9" />,
  radiant: <polygon points="13,6 27,6 34,13 34,27 27,34 13,34 6,27 6,13" />,
  marquise: <path d="M20 4 C28 10 30 16 30 20 C30 24 28 30 20 36 C12 30 10 24 10 20 C10 16 12 10 20 4 Z" />,
};
const SHAPES = [
  { key: "round", label: "Round" },
  { key: "oval", label: "Oval" },
  { key: "emerald", label: "Emerald" },
  { key: "princess", label: "Princess" },
  { key: "pear", label: "Pear" },
  { key: "cushion", label: "Cushion" },
  { key: "radiant", label: "Radiant" },
  { key: "marquise", label: "Marquise" },
];

function ShapeGlyph({ shape, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none"
      stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      {SHAPE_GLYPH[shape] || SHAPE_GLYPH.round}
    </svg>
  );
}

// ── designs (setting styles) ─────────────────────────────────────────────────
const DESIGNS = [
  { key: "solitaire", name: "Solitaire", sub: "Six-prong · the classic", settingBase: 980 },
  { key: "halo", name: "Hidden Halo", sub: "Secret sparkle underneath", settingBase: 1280 },
  { key: "three", name: "Three-Stone", sub: "Past · present · future", settingBase: 1620 },
  { key: "pave", name: "Pavé Band", sub: "Diamonds down the shank", settingBase: 1180 },
];

// ── pool of available vendor stones (mirrors seed pool shape) ────────────────
const POOL = [
  { id: "LG-700001", shape: "round", carat: 1.5, color: "D", clarity: "VVS1", cut: "Excellent", cert: "IGI", video: true },
  { id: "LG-700002", shape: "round", carat: 1.6, color: "E", clarity: "VS1", cut: "Excellent", cert: "IGI", video: true },
  { id: "LG-700003", shape: "round", carat: 1.5, color: "E", clarity: "IF", cut: "Excellent", cert: "IGI", video: false },
  { id: "LG-700004", shape: "round", carat: 1.55, color: "E", clarity: "VVS2", cut: "Excellent", cert: "GIA", video: true },
  { id: "LG-700010", shape: "round", carat: 1.0, color: "D", clarity: "VVS1", cut: "Excellent", cert: "IGI", video: false },
  { id: "LG-700011", shape: "round", carat: 2.0, color: "D", clarity: "IF", cut: "Excellent", cert: "GIA", video: true },
  { id: "LG-700020", shape: "oval", carat: 1.5, color: "E", clarity: "VS1", cut: "Excellent", cert: "IGI", video: true },
  { id: "LG-700021", shape: "oval", carat: 1.7, color: "F", clarity: "VS2", cut: "Excellent", cert: "IGI", video: false },
  { id: "LG-700022", shape: "oval", carat: 2.0, color: "E", clarity: "VS1", cut: "Excellent", cert: "GIA", video: true },
  { id: "LG-700030", shape: "emerald", carat: 2.0, color: "F", clarity: "VS1", cut: "Excellent", cert: "IGI", video: true },
  { id: "LG-700031", shape: "emerald", carat: 2.2, color: "F", clarity: "VVS2", cut: "Excellent", cert: "IGI", video: false },
  { id: "LG-700040", shape: "princess", carat: 1.3, color: "E", clarity: "VVS1", cut: "Excellent", cert: "GIA", video: false },
  { id: "LG-700041", shape: "princess", carat: 1.0, color: "E", clarity: "VS2", cut: "Very Good", cert: "IGI", video: false },
  { id: "LG-700050", shape: "pear", carat: 1.5, color: "D", clarity: "VVS2", cut: "Excellent", cert: "GIA", video: true },
  { id: "LG-700051", shape: "pear", carat: 1.2, color: "F", clarity: "VS1", cut: "Excellent", cert: "IGI", video: false },
  { id: "LG-700060", shape: "cushion", carat: 1.5, color: "F", clarity: "VS2", cut: "Excellent", cert: "IGI", video: false },
  { id: "LG-700070", shape: "radiant", carat: 1.8, color: "F", clarity: "VS2", cut: "Excellent", cert: "IGI", video: true },
  // marquise intentionally empty -> demonstrates the "curating your stones" path
];

const COLOR_ORDER = ["G", "F", "E", "D"]; // higher index = better
const CLARITY_ORDER = ["VS2", "VS1", "VVS2", "VVS1", "IF"];
const STANDARD = { color: "F", clarity: "VS2" }; // house quality floor
const gradeAtLeast = (order, have, min) => order.indexOf(have) >= order.indexOf(min);

// consistent, plausible pricing so estimates and stone prices agree
function stonePrice(carat, color, clarity) {
  const base = 1400 * Math.pow(carat, 1.84);
  const cMult = { D: 1.15, E: 1.08, F: 1.0, G: 0.9 }[color] ?? 1;
  const clMult = { IF: 1.18, VVS1: 1.12, VVS2: 1.08, VS1: 1.02, VS2: 0.96 }[clarity] ?? 1;
  return Math.round((base * cMult * clMult) / 10) * 10;
}
const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US")}`;

function matchStones(shape, carat) {
  return POOL
    .filter((s) => s.shape === shape)
    .filter((s) => s.carat >= carat - 0.05 && s.carat <= carat + 0.4)
    .filter((s) => gradeAtLeast(COLOR_ORDER, s.color, STANDARD.color))
    .filter((s) => gradeAtLeast(CLARITY_ORDER, s.clarity, STANDARD.clarity))
    .map((s) => ({ ...s, price: stonePrice(s.carat, s.color, s.clarity) }))
    .sort((a, b) => Math.abs(a.carat - carat) - Math.abs(b.carat - carat) || a.price - b.price)
    .slice(0, 3);
}

function estRange(carat, designKey) {
  const setting = DESIGNS.find((d) => d.key === designKey)?.settingBase ?? 1000;
  const total = stonePrice(carat, STANDARD.color, "VS1") + setting;
  return { low: Math.round((total * 0.92) / 10) * 10, high: Math.round((total * 1.1) / 10) * 10 };
}

// ── shared building blocks (restyled per version via parent class) ───────────
function ShapeRow({ shape, setShape }) {
  return (
    <div className="mflow-shapes" role="radiogroup" aria-label="Center stone shape">
      {SHAPES.map((s) => (
        <button key={s.key} type="button" role="radio" aria-checked={shape === s.key}
          className={`mflow-shape ${shape === s.key ? "on" : ""}`} onClick={() => setShape(s.key)}>
          <ShapeGlyph shape={s.key} />
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

function CaratSlider({ carat, setCarat }) {
  return (
    <div className="mflow-carat">
      <div className="mflow-carat-head">
        <span className="mflow-carat-num">{carat.toFixed(2)}</span>
        <span className="mflow-carat-unit">carat</span>
      </div>
      <input type="range" min="0.5" max="3" step="0.05" value={carat}
        onChange={(e) => setCarat(Number(e.target.value))} aria-label="Carat" />
      <div className="mflow-carat-scale"><span>0.5</span><span>1.5</span><span>3.0</span></div>
    </div>
  );
}

function StoneCard({ stone, best, selected, onApprove, compact }) {
  return (
    <article className={`mflow-stone ${selected ? "is-approved" : ""} ${compact ? "compact" : ""}`}>
      {best && <span className="mflow-pick"><Sparkles size={12} strokeWidth={1.8} /> BeloveD pick</span>}
      <div className="mflow-stone-vis">
        <ShapeGlyph shape={stone.shape} size={compact ? 38 : 54} />
        {stone.video && <span className="mflow-360"><Play size={11} fill="currentColor" /> 360°</span>}
      </div>
      <div className="mflow-stone-body">
        <h4>{stone.carat.toFixed(2)}ct {SHAPES.find((s) => s.key === stone.shape)?.label}</h4>
        <p className="mflow-stone-spec">{stone.color} · {stone.clarity} · {stone.cut} · {stone.cert}</p>
        <p className="mflow-stone-cert">Report {stone.id}</p>
        <div className="mflow-stone-foot">
          <strong>{fmt(stone.price)}</strong>
          <button type="button" className={`mflow-approve ${selected ? "on" : ""}`} onClick={() => onApprove(stone.id)}>
            {selected ? <><Check size={13} strokeWidth={2.4} /> Approved</> : "Approve this stone"}
          </button>
        </div>
      </div>
    </article>
  );
}

function Curating() {
  return (
    <div className="mflow-curating">
      <Clock size={18} strokeWidth={1.6} />
      <div>
        <strong>Curating your stones</strong>
        <p>No exact match in stock right now — our diamond desk is sourcing options for this shape. Usually 1–2 days.</p>
      </div>
    </div>
  );
}

const QUALITY_LINE = "Every match is IGI/GIA-certified, F color / VS clarity or better.";

// ══ VERSION A — ATELIER (editorial / concierge) ══════════════════════════════
function VersionAtelier(props) {
  const { design, setDesign, shape, setShape, carat, setCarat, matches, approved, setApproved } = props;
  return (
    <div className="mflow-a">
      <header className="mflow-a-hero">
        <span className="mflow-eyebrow">The Atelier · Made to order</span>
        <h2>Tell us three things.<br /><em>We compose the rest.</em></h2>
        <p>No budgets, no grading charts. Choose a silhouette, a shape, and a size — your diamond desk does the matching.</p>
      </header>

      <section className="mflow-a-act">
        <span className="mflow-num">I</span>
        <div className="mflow-a-actbody">
          <h3>Your silhouette</h3>
          <div className="mflow-a-designs">
            {DESIGNS.map((d) => (
              <button key={d.key} type="button" className={`mflow-a-design ${design === d.key ? "on" : ""}`} onClick={() => setDesign(d.key)}>
                <span className="mflow-a-dname">{d.name}</span>
                <span className="mflow-a-dsub">{d.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mflow-a-act">
        <span className="mflow-num">II</span>
        <div className="mflow-a-actbody">
          <h3>Its shape</h3>
          <ShapeRow shape={shape} setShape={setShape} />
        </div>
      </section>

      <section className="mflow-a-act">
        <span className="mflow-num">III</span>
        <div className="mflow-a-actbody">
          <h3>Its presence</h3>
          <CaratSlider carat={carat} setCarat={setCarat} />
        </div>
      </section>

      <section className="mflow-a-reveal">
        <div className="mflow-a-reveal-head">
          <span className="mflow-eyebrow">The atelier selects</span>
          <h3>{matches.length ? "Three stones, chosen for you." : "We're on it."}</h3>
          <p className="mflow-quality"><ShieldCheck size={14} strokeWidth={1.7} /> {QUALITY_LINE}</p>
        </div>
        {matches.length ? (
          <div className="mflow-a-stones">
            {matches.map((s, i) => (
              <StoneCard key={s.id} stone={s} best={i === 0} selected={approved === s.id} onApprove={setApproved} />
            ))}
          </div>
        ) : <Curating />}
        <p className="mflow-a-foot">No payment until you approve a stone and accept your quote.</p>
      </section>
    </div>
  );
}

// ══ VERSION B — STUDIO (guided builder + sticky rail) ════════════════════════
function VersionStudio(props) {
  const { design, setDesign, shape, setShape, carat, setCarat, matches, approved, setApproved, est } = props;
  const [step, setStep] = useState(0);
  const steps = ["Design", "Diamond", "Approve"];
  const designName = DESIGNS.find((d) => d.key === design)?.name;
  const approvedStone = matches.find((s) => s.id === approved);

  return (
    <div className="mflow-b">
      <div className="mflow-b-main">
        <ol className="mflow-b-steps">
          {steps.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "current" : ""}>
              <span className="mflow-b-dot">{i < step ? <Check size={12} strokeWidth={2.6} /> : i + 1}</span>{s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="mflow-b-panel">
            <p className="mflow-label">Choose your setting</p>
            <div className="mflow-b-designs">
              {DESIGNS.map((d) => (
                <button key={d.key} type="button" className={`mflow-b-design ${design === d.key ? "on" : ""}`} onClick={() => setDesign(d.key)}>
                  <span className="mflow-a-dname">{d.name}</span>
                  <span className="mflow-a-dsub">{d.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mflow-b-panel">
            <p className="mflow-label">Shape & size</p>
            <ShapeRow shape={shape} setShape={setShape} />
            <div className="mflow-b-carat"><CaratSlider carat={carat} setCarat={setCarat} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="mflow-b-panel">
            <p className="mflow-label">Your matched diamonds</p>
            <p className="mflow-quality"><ShieldCheck size={14} strokeWidth={1.7} /> {QUALITY_LINE}</p>
            {matches.length ? (
              <div className="mflow-b-stones">
                {matches.map((s, i) => (
                  <StoneCard key={s.id} stone={s} best={i === 0} selected={approved === s.id} onApprove={setApproved} />
                ))}
              </div>
            ) : <Curating />}
          </div>
        )}

        <div className="mflow-b-nav">
          {step > 0 ? <button type="button" className="mflow-btn ghost" onClick={() => setStep((s) => s - 1)}>Back</button> : <span />}
          {step < 2
            ? <button type="button" className="mflow-btn solid" onClick={() => setStep((s) => s + 1)}>Continue <ArrowRight size={15} strokeWidth={1.7} /></button>
            : <button type="button" className="mflow-btn solid" disabled={!approved}>Request quote <ArrowRight size={15} strokeWidth={1.7} /></button>}
        </div>
      </div>

      <aside className="mflow-b-rail">
        <p className="mflow-label">Your piece</p>
        <dl className="mflow-b-summary">
          <div><dt>Setting</dt><dd>{designName}</dd></div>
          <div><dt>Shape</dt><dd>{SHAPES.find((s) => s.key === shape)?.label}</dd></div>
          <div><dt>Carat</dt><dd>{carat.toFixed(2)}ct</dd></div>
          <div><dt>Diamond</dt><dd>{approvedStone ? `${approvedStone.color}·${approvedStone.clarity}` : "Matching…"}</dd></div>
        </dl>
        <div className="mflow-b-est">
          <span>Estimated total</span>
          <strong>{approvedStone ? fmt(approvedStone.price + (DESIGNS.find((d) => d.key === design)?.settingBase ?? 0)) : `${fmt(est.low)} – ${fmt(est.high)}`}</strong>
          <small>Confirmed in your quote</small>
        </div>
        <p className="mflow-b-trust"><ShieldCheck size={13} strokeWidth={1.7} /> No payment until you accept the quote</p>
      </aside>
    </div>
  );
}

// ══ VERSION C — COUNTER (transparent / single screen) ════════════════════════
function VersionCounter(props) {
  const { design, setDesign, shape, setShape, carat, setCarat, matches, approved, setApproved, est } = props;
  const retailLow = Math.round((est.low * 1.7) / 10) * 10;
  const retailHigh = Math.round((est.high * 2.05) / 10) * 10;

  return (
    <div className="mflow-c">
      <div className="mflow-c-brief">
        <p className="mflow-label">Design</p>
        <div className="mflow-c-designs">
          {DESIGNS.map((d) => (
            <button key={d.key} type="button" className={`mflow-chip ${design === d.key ? "on" : ""}`} onClick={() => setDesign(d.key)}>{d.name}</button>
          ))}
        </div>
        <p className="mflow-label">Shape</p>
        <ShapeRow shape={shape} setShape={setShape} />
        <p className="mflow-label">Carat</p>
        <CaratSlider carat={carat} setCarat={setCarat} />
      </div>

      <div className="mflow-c-side">
        <div className="mflow-c-est">
          <span className="mflow-label">Estimated total · confirmed in quote</span>
          <strong>{fmt(est.low)} – {fmt(est.high)}</strong>
          <div className="mflow-c-bars">
            <div className="mflow-c-bar">
              <span className="mflow-c-bartag">Typical retail</span>
              <span className="mflow-c-track"><i className="r" style={{ width: "100%" }} /></span>
              <span className="mflow-c-barval">{fmt(retailLow)}–{fmt(retailHigh)}</span>
            </div>
            <div className="mflow-c-bar">
              <span className="mflow-c-bartag">BeloveD</span>
              <span className="mflow-c-track"><i className="b" style={{ width: "46%" }} /></span>
              <span className="mflow-c-barval">{fmt(est.low)}–{fmt(est.high)}</span>
            </div>
          </div>
          <p className="mflow-quality"><BadgeCheck size={14} strokeWidth={1.7} /> {QUALITY_LINE}</p>
        </div>

        <div className="mflow-c-reco">
          <div className="mflow-c-reco-head">
            <span className="mflow-label">Matched & available now</span>
            <span className="mflow-c-count">{matches.length ? `${matches.length} stones` : "sourcing"}</span>
          </div>
          {matches.length ? (
            <div className="mflow-c-stones">
              {matches.map((s, i) => (
                <StoneCard key={s.id} stone={s} best={i === 0} selected={approved === s.id} onApprove={setApproved} compact />
              ))}
            </div>
          ) : <Curating />}
        </div>
      </div>
    </div>
  );
}

// ── version chrome ───────────────────────────────────────────────────────────
const VERSIONS = [
  { key: "a", tag: "A · Atelier", desc: "Editorial concierge — vertical, theatrical, “we select for you” (Tiffany-lean)" },
  { key: "b", tag: "B · Studio", desc: "Guided builder — stepper + sticky live-estimate rail (Brilliant-Earth-lean)" },
  { key: "c", tag: "C · Counter", desc: "Transparent quick brief — one screen, retail-markup bar, instant (Rare-Carat-lean)" },
];

export default function CustomFlowMockup() {
  const [version, setVersion] = useState("a");
  const [design, setDesign] = useState("solitaire");
  const [shape, setShape] = useState("round");
  const [carat, setCarat] = useState(1.5);
  const [approved, setApproved] = useState(null);

  const matches = useMemo(() => matchStones(shape, carat), [shape, carat]);
  const est = useMemo(() => estRange(carat, design), [carat, design]);
  // an approval only stands while its stone is still in the matched set (derive, don't reset in render)
  const effApproved = matches.some((m) => m.id === approved) ? approved : null;

  const shared = { design, setDesign, shape, setShape, carat, setCarat, matches, approved: effApproved, setApproved, est };
  const active = VERSIONS.find((v) => v.key === version);

  return (
    <div className="page mflow-root">
      <style>{MFLOW_CSS}</style>

      <div className="mflow-topbar">
        <div>
          <p className="mflow-eyebrow">Custom flow · mockup</p>
          <h1 className="mflow-title">Three ways to design yours</h1>
        </div>
        <div className="mflow-switch" role="tablist" aria-label="Mockup version">
          {VERSIONS.map((v) => (
            <button key={v.key} role="tab" aria-selected={version === v.key}
              className={version === v.key ? "on" : ""} onClick={() => setVersion(v.key)}>{v.tag}</button>
          ))}
        </div>
      </div>
      <p className="mflow-vdesc">{active.desc}</p>

      <div className="mflow-stage">
        {version === "a" && <VersionAtelier {...shared} />}
        {version === "b" && <VersionStudio {...shared} />}
        {version === "c" && <VersionCounter {...shared} />}
      </div>

      <p className="mflow-back"><Link to="/">← Back to site</Link> · <span>Mockup only — design + shape + carat → vendor match → approve</span></p>
    </div>
  );
}

// ── scoped styles (everything under .mflow-root) ─────────────────────────────
const MFLOW_CSS = `
.mflow-root { max-width: 1080px; }
.mflow-root *, .mflow-root *::before, .mflow-root *::after { box-sizing: border-box; }
.mflow-eyebrow { font-family: var(--sans); font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--accent); margin: 0 0 12px; }
.mflow-title { font-family: var(--serif); font-weight: 500; font-size: clamp(26px, 4vw, 40px); margin: 0; letter-spacing: .01em; }
.mflow-label { font-family: var(--sans); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--quiet); margin: 0 0 14px; }
.mflow-quality { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--muted); margin: 14px 0 0; }
.mflow-quality svg { color: var(--accent); flex: none; }

.mflow-topbar { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; }
.mflow-switch { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; padding: 4px; background: var(--bg-2); }
.mflow-switch button { border: none; background: none; cursor: pointer; font-family: var(--sans); font-size: 12.5px; letter-spacing: .04em; color: var(--muted); padding: 8px 16px; border-radius: 999px; transition: all .18s ease; white-space: nowrap; }
.mflow-switch button:hover { color: var(--text); }
.mflow-switch button.on { background: var(--accent); color: #15120c; }
.mflow-vdesc { color: var(--quiet); font-size: 13px; margin: 14px 0 0; }
.mflow-stage { margin-top: 30px; border-top: 1px solid var(--hair); padding-top: 30px; }
.mflow-back { margin-top: 40px; font-size: 12px; color: var(--quiet); }
.mflow-back a { color: var(--accent); text-decoration: none; }

/* shared: shapes */
.mflow-shapes { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
.mflow-shape { display: grid; justify-items: center; gap: 7px; padding: 12px 4px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg-2); color: var(--muted); cursor: pointer; transition: all .18s ease; }
.mflow-shape svg { color: var(--silver); transition: color .18s ease; }
.mflow-shape span { font-size: 10.5px; letter-spacing: .04em; }
.mflow-shape:hover { border-color: var(--line-strong); color: var(--text); transform: translateY(-2px); }
.mflow-shape.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; color: var(--text); }
.mflow-shape.on svg { color: var(--accent-bright); }

/* shared: carat slider */
.mflow-carat-head { display: flex; align-items: baseline; gap: 8px; }
.mflow-carat-num { font-family: var(--serif); font-size: 40px; color: var(--accent-bright); font-variant-numeric: lining-nums tabular-nums; line-height: 1; }
.mflow-carat-unit { font-family: var(--sans); font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: var(--quiet); }
.mflow-carat input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 2px; background: var(--line-strong); margin: 20px 0 8px; cursor: pointer; }
.mflow-carat input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); border: 3px solid var(--bg); box-shadow: 0 0 0 1px var(--accent); }
.mflow-carat input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--accent); border: 3px solid var(--bg); }
.mflow-carat-scale { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--quiet); font-variant-numeric: tabular-nums; }

/* shared: stone card */
.mflow-stone { position: relative; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); padding: 18px; display: flex; flex-direction: column; gap: 14px; transition: border-color .18s ease, box-shadow .18s ease; }
.mflow-stone.is-approved { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), var(--shadow); }
.mflow-pick { position: absolute; top: -10px; left: 16px; display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: #15120c; background: var(--accent); padding: 4px 9px; border-radius: 999px; }
.mflow-stone-vis { position: relative; display: grid; place-items: center; height: 96px; border-radius: 10px; background: radial-gradient(circle at 50% 38%, rgba(235,216,170,.14), transparent 70%); color: var(--accent-bright); }
.mflow-stone.compact .mflow-stone-vis { height: 70px; }
.mflow-360 { position: absolute; bottom: 6px; right: 6px; display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 2px 7px; }
.mflow-stone-body h4 { font-family: var(--serif); font-weight: 500; font-size: 18px; margin: 0 0 5px; }
.mflow-stone-spec { font-size: 12.5px; color: var(--muted); margin: 0 0 3px; }
.mflow-stone-cert { font-size: 11px; color: var(--quiet); margin: 0; }
.mflow-stone-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--hair); }
.mflow-stone-foot strong { font-family: var(--serif); font-size: 19px; color: var(--accent-bright); font-variant-numeric: tabular-nums; }
.mflow-approve { font-family: var(--sans); font-size: 12px; letter-spacing: .03em; border: 1px solid var(--line-strong); background: none; color: var(--text); padding: 8px 14px; border-radius: 999px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all .18s ease; }
.mflow-approve:hover { border-color: var(--accent); color: var(--accent-bright); }
.mflow-approve.on { background: var(--accent); border-color: var(--accent); color: #15120c; }

.mflow-curating { display: flex; gap: 14px; align-items: flex-start; border: 1px dashed var(--line-strong); border-radius: 14px; padding: 20px; background: var(--bg-2); }
.mflow-curating svg { color: var(--accent); margin-top: 2px; flex: none; }
.mflow-curating strong { font-family: var(--serif); font-size: 16px; display: block; margin-bottom: 4px; }
.mflow-curating p { font-size: 13px; color: var(--muted); margin: 0; line-height: 1.55; max-width: 46ch; }

/* shared buttons */
.mflow-btn { font-family: var(--sans); font-size: 13px; letter-spacing: .04em; border-radius: 999px; padding: 12px 22px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all .18s ease; }
.mflow-btn.solid { background: var(--accent); border: 1px solid var(--accent); color: #15120c; }
.mflow-btn.solid:hover { background: var(--accent-bright); border-color: var(--accent-bright); }
.mflow-btn.solid:disabled { opacity: .4; cursor: not-allowed; }
.mflow-btn.ghost { background: none; border: 1px solid var(--line-strong); color: var(--text); }
.mflow-btn.ghost:hover { border-color: var(--accent); }
.mflow-chip { font-family: var(--sans); font-size: 12.5px; border: 1px solid var(--line); background: var(--bg-2); color: var(--muted); padding: 8px 15px; border-radius: 999px; cursor: pointer; transition: all .16s ease; }
.mflow-chip:hover { border-color: var(--line-strong); color: var(--text); }
.mflow-chip.on { background: var(--accent); border-color: var(--accent); color: #15120c; }

/* shared design tiles */
.mflow-a-dname { font-family: var(--serif); font-size: 17px; display: block; }
.mflow-a-dsub { font-size: 11.5px; color: var(--quiet); display: block; margin-top: 3px; }

/* ── VERSION A ── */
.mflow-a-hero { text-align: center; max-width: 620px; margin: 8px auto 56px; }
.mflow-a-hero h2 { font-family: var(--serif); font-weight: 500; font-size: clamp(30px, 5vw, 52px); line-height: 1.06; margin: 0 0 18px; }
.mflow-a-hero h2 em { font-style: italic; color: var(--accent-bright); }
.mflow-a-hero p { color: var(--muted); font-size: 15px; line-height: 1.65; margin: 0; }
.mflow-a-act { display: grid; grid-template-columns: 64px 1fr; gap: 22px; padding: 38px 0; border-top: 1px solid var(--hair); }
.mflow-num { font-family: var(--serif); font-style: italic; font-size: 30px; color: var(--accent); opacity: .6; }
.mflow-a-actbody h3 { font-family: var(--serif); font-weight: 500; font-size: 23px; margin: 0 0 20px; }
.mflow-a-designs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.mflow-a-design { text-align: left; padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--bg-2); cursor: pointer; transition: all .18s ease; }
.mflow-a-design:hover { border-color: var(--line-strong); transform: translateY(-2px); }
.mflow-a-design.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.mflow-a-reveal { margin-top: 30px; padding: 44px; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(160deg, var(--surface), var(--bg-2)); }
.mflow-a-reveal-head { text-align: center; margin-bottom: 30px; }
.mflow-a-reveal-head h3 { font-family: var(--serif); font-weight: 500; font-size: 27px; margin: 0; }
.mflow-a-stones { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.mflow-a-foot { text-align: center; font-size: 12px; color: var(--quiet); margin: 28px 0 0; }

/* ── VERSION B ── */
.mflow-b { display: grid; grid-template-columns: 1fr 300px; gap: 28px; align-items: start; }
.mflow-b-steps { display: flex; gap: 10px; list-style: none; padding: 0; margin: 0 0 30px; }
.mflow-b-steps li { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--quiet); flex: 1; }
.mflow-b-dot { width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line-strong); display: grid; place-items: center; font-size: 12px; flex: none; }
.mflow-b-steps li.current { color: var(--text); }
.mflow-b-steps li.current .mflow-b-dot { border-color: var(--accent); color: var(--accent-bright); }
.mflow-b-steps li.done { color: var(--muted); }
.mflow-b-steps li.done .mflow-b-dot { background: var(--accent); border-color: var(--accent); color: #15120c; }
.mflow-b-panel { border: 1px solid var(--line); border-radius: 16px; background: var(--surface); padding: 26px; min-height: 280px; }
.mflow-b-designs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mflow-b-design { text-align: left; padding: 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg-2); cursor: pointer; transition: all .18s ease; }
.mflow-b-design:hover { border-color: var(--line-strong); }
.mflow-b-design.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.mflow-b-carat { margin-top: 26px; max-width: 320px; }
.mflow-b-stones { display: grid; gap: 14px; }
.mflow-b-nav { display: flex; justify-content: space-between; margin-top: 22px; }
.mflow-b-rail { position: sticky; top: 96px; border: 1px solid var(--line); border-radius: 16px; background: var(--bg-2); padding: 24px; }
.mflow-b-summary { margin: 0 0 20px; display: grid; gap: 12px; }
.mflow-b-summary div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding-bottom: 11px; border-bottom: 1px solid var(--hair); }
.mflow-b-summary dt { color: var(--quiet); margin: 0; }
.mflow-b-summary dd { margin: 0; color: var(--text); text-align: right; }
.mflow-b-est { border: 1px solid var(--line-strong); border-radius: 12px; padding: 16px; text-align: center; background: var(--surface); }
.mflow-b-est span { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--quiet); }
.mflow-b-est strong { display: block; font-family: var(--serif); font-size: 26px; color: var(--accent-bright); margin: 6px 0 2px; font-variant-numeric: tabular-nums; }
.mflow-b-est small { font-size: 11px; color: var(--quiet); }
.mflow-b-trust { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--muted); margin: 16px 0 0; }
.mflow-b-trust svg { color: var(--accent); flex: none; }

/* ── VERSION C ── */
.mflow-c { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.mflow-c-brief { border: 1px solid var(--line); border-radius: 16px; background: var(--surface); padding: 26px; }
.mflow-c-brief .mflow-label:not(:first-child) { margin-top: 26px; }
.mflow-c-designs { display: flex; flex-wrap: wrap; gap: 8px; }
.mflow-c .mflow-shapes { grid-template-columns: repeat(4, 1fr); }
.mflow-c-side { display: grid; gap: 18px; }
.mflow-c-est { border: 1px solid var(--line); border-radius: 16px; background: var(--bg-2); padding: 24px; }
.mflow-c-est > strong { display: block; font-family: var(--serif); font-size: 34px; color: var(--accent-bright); margin: 4px 0 18px; font-variant-numeric: tabular-nums; }
.mflow-c-bars { display: grid; gap: 12px; }
.mflow-c-bar { display: grid; grid-template-columns: 88px 1fr auto; align-items: center; gap: 12px; }
.mflow-c-bartag { font-size: 11px; color: var(--quiet); text-transform: uppercase; letter-spacing: .08em; }
.mflow-c-track { height: 7px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.mflow-c-track i { display: block; height: 100%; border-radius: 999px; }
.mflow-c-track i.r { background: var(--line-strong); }
.mflow-c-track i.b { background: linear-gradient(90deg, var(--gold-deep), var(--accent-bright)); }
.mflow-c-barval { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.mflow-c-reco { border: 1px solid var(--line); border-radius: 16px; background: var(--surface); padding: 22px; }
.mflow-c-reco-head { display: flex; justify-content: space-between; align-items: baseline; }
.mflow-c-reco-head .mflow-label { margin-bottom: 16px; }
.mflow-c-count { font-size: 11px; color: var(--accent); letter-spacing: .06em; }
.mflow-c-stones { display: grid; gap: 12px; }

@media (max-width: 860px) {
  .mflow-b, .mflow-c { grid-template-columns: 1fr; }
  .mflow-b-rail { position: static; }
  .mflow-a-designs, .mflow-a-stones { grid-template-columns: 1fr 1fr; }
  .mflow-shapes, .mflow-c .mflow-shapes { grid-template-columns: repeat(4, 1fr); }
  .mflow-a-act { grid-template-columns: 40px 1fr; gap: 14px; }
}
@media (max-width: 540px) {
  .mflow-a-designs, .mflow-a-stones, .mflow-b-designs { grid-template-columns: 1fr; }
  .mflow-shapes, .mflow-c .mflow-shapes { grid-template-columns: repeat(2, 1fr); }
  .mflow-topbar { flex-direction: column; align-items: flex-start; }
}
`;
