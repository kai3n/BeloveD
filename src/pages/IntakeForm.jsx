import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { CHAIN_LENGTHS, OPS_CATEGORIES, OPS_METALS, PRODUCT_LINES, BENCHMARK_SHAPES } from "../lib/ops.js";
import { createIntake, getDiamond, listOpsStyles } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { pickI18n, useLocale } from "../i18n.jsx";
import { MediaPicker } from "../components/ui.jsx";
import PinAnnotator from "../components/PinAnnotator.jsx";
import StoneEduPanel from "../components/StoneEducation.jsx";
import RingSizeHelp from "../components/RingSizeHelp.jsx";

export default function IntakeForm() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.intake;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const styles = listOpsStyles({ publishedOnly: true });
  // 쇼케이스 다이아에서 진입 시 스톤 선호 프리필
  const refDiamond = params.get("diamond") ? getDiamond(params.get("diamond")) : null;

  const [form, setForm] = useState({
    name: user?.name || "", contact: user?.email || "", productLine: "solitaire", category: "ring",
    styleId: params.get("style") || "", budget: "", metal: "18kw",
    conditional: {},
    stonePrefs: {
      shape: refDiamond?.shape || "round", carat: String(refDiamond?.carat || "1.5"),
      color: refDiamond?.color || "E", clarity: refDiamond?.clarity || "VS1",
      growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "",
    },
    multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
    requiredDate: "", country: "", termsAccepted: false,
  });
  const [done, setDone] = useState(null);
  const [refs, setRefs] = useState([]); // [{kind, src, annotations[]}]
  const [annotIdx, setAnnotIdx] = useState(0);
  const [eduField, setEduField] = useState("shape"); // 교육 패널이 따라가는 포커스 필드
  const [step, setStep] = useState(0); // 위저드 단계 0:제품 1:센터스톤 2:레퍼런스
  const [stepError, setStepError] = useState(false);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setC = (patch) => setForm((f) => ({ ...f, conditional: { ...f.conditional, ...patch } }));
  const setS = (patch) => setForm((f) => ({ ...f, stonePrefs: { ...f.stonePrefs, ...patch } }));
  const setM = (patch) => setForm((f) => ({ ...f, multiSpec: { ...f.multiSpec, ...patch } }));

  function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      budget: Number(form.budget) || null,
      stonePrefs: form.productLine === "solitaire" ? { ...form.stonePrefs, carat: Number(form.stonePrefs.carat) || null } : null,
      multiSpec: form.productLine === "multi" ? form.multiSpec : null,
      referenceMedia: refs,
    };
    const { order } = createIntake(payload, user?.id || null);
    setDone(order);
  }

  // 단계 진행 전 현재 단계 필수값 검증 (HTML required는 단계 이동을 막지 못함)
  function validateStep(s) {
    if (s === 0) {
      if (!form.country.trim()) return false;
      const c = form.category;
      if (c === "ring" && !(form.conditional.ringSize || "").trim()) return false;
      if (c === "necklace" && !(form.conditional.chainStyle || "").trim()) return false;
      if (c === "bangle" && !(form.conditional.wristSize || "").trim()) return false;
      if (c === "earrings" && !(form.conditional.earringDetails || "").trim()) return false;
      return true;
    }
    if (s === 1 && form.productLine === "multi") {
      return Boolean(form.multiSpec.meleeSpec.trim() && form.multiSpec.overallDims.trim());
    }
    return true; // 솔리테어 센터스톤은 기본값이 채워져 있음
  }
  function goNext() {
    if (validateStep(step)) { setStepError(false); setStep((s) => s + 1); } else setStepError(true);
  }

  if (done) {
    return (
      <div className="page page-narrow">
        <h1 className="page-title">{t.doneTitle}</h1>
        <div className="panel form-stack">
          <div className="summary-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="summary-card"><div className="num" style={{ fontSize: 24 }}>{done.id}</div><div className="lbl">{t.orderIdLbl}</div></div>
            <div className="summary-card"><div className="num" style={{ fontSize: 24 }}>{done.queryCode}</div><div className="lbl">{t.codeLbl}</div></div>
          </div>
          <p className="form-hint">{t.doneNote}</p>
          <button className="button primary" onClick={() => navigate(`/track/${done.id}?code=${done.queryCode}`)}>{t.goPortal}</button>
        </div>
      </div>
    );
  }

  const cat = form.category;
  const solitaire = form.productLine === "solitaire";
  const bigStone = solitaire && Number(form.stonePrefs.carat) >= 2;

  const showEdu = solitaire && step === 1; // 센터스톤 단계: 교육 사이드패널
  const showRingHelp = cat === "ring" && step === 0; // 제품 단계 + 링: 사이즈 도움말
  const sidePanel = showEdu ? "stone" : showRingHelp ? "ring" : null;

  return (
    <div className="page page-narrow" style={{ maxWidth: sidePanel ? 1020 : 680 }}>
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>

      <ol className="stepper">
        {t.wizardSteps.map((label, i) => (
          <li key={label} className={i === step ? "current" : i < step ? "done" : ""}><span className="dot" />{label}</li>
        ))}
      </ol>

      <div className={`intake-layout ${sidePanel ? "has-edu" : ""}`}>
      <form className="panel form-stack" onSubmit={submit}>

        {/* ── Step 1: 제품 ── */}
        {step === 0 && (
          <>
            <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="field"><span>{t.productLine}</span>
                <select value={form.productLine} onChange={(e) => setF({ productLine: e.target.value })}>
                  {PRODUCT_LINES.map((pl) => <option key={pl} value={pl}>{p.productLines[pl]}</option>)}
                </select></label>
              <label className="field"><span>{t.category}</span>
                <select value={form.category} onChange={(e) => setF({ category: e.target.value, conditional: {} })}>
                  {OPS_CATEGORIES.map((c) => <option key={c} value={c}>{p.opsCategories[c]}</option>)}
                </select></label>
              <label className="field"><span>{t.style}</span>
                <select value={form.styleId} onChange={(e) => setF({ styleId: e.target.value })}>
                  <option value="">{t.noStyle}</option>
                  {styles.map((st) => <option key={st.id} value={st.id}>{st.id} — {pickI18n(st.name, locale)}</option>)}
                </select></label>
              <label className="field"><span>{t.metal}</span>
                <select value={form.metal} onChange={(e) => setF({ metal: e.target.value })}>
                  {Object.keys(OPS_METALS ? p.opsMetals : {}).map((m) => <option key={m} value={m}>{p.opsMetals[m]}</option>)}
                </select></label>
              <label className="field"><span>{t.budget}</span><input type="number" step="100" value={form.budget} onChange={(e) => setF({ budget: e.target.value })} /></label>
              <label className="field"><span>{t.requiredDate}</span><input type="date" value={form.requiredDate} onChange={(e) => setF({ requiredDate: e.target.value })} /></label>
              <label className="field"><span>{t.country}</span><input value={form.country} onChange={(e) => setF({ country: e.target.value })} required /></label>
            </div>
            {cat === "ring" && (
              <>
                <label className="field"><span>{t.ringSize}</span><input value={form.conditional.ringSize || ""} onChange={(e) => setC({ ringSize: e.target.value })} required /></label>
                <div className="stone-edu-inline"><RingSizeHelp /></div>
              </>
            )}
            {cat === "necklace" && (
              <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <label className="field"><span>{t.chainStyle}</span><input value={form.conditional.chainStyle || ""} onChange={(e) => setC({ chainStyle: e.target.value })} required /></label>
                <label className="field"><span>{t.chainLength}</span>
                  <select value={form.conditional.chainLength || "18in"} onChange={(e) => setC({ chainLength: e.target.value })}>
                    {CHAIN_LENGTHS.map((l) => <option key={l} value={l}>{l === "16in" ? "16 in / 40 cm" : l === "18in" ? "18 in / 45 cm" : "20 in / 50 cm"}</option>)}
                  </select></label>
                <label className="field"><span>{t.clasp}</span><input value={form.conditional.clasp || ""} onChange={(e) => setC({ clasp: e.target.value })} /></label>
              </div>
            )}
            {cat === "bangle" && (
              <label className="field"><span>{t.wristSize}</span><input value={form.conditional.wristSize || ""} onChange={(e) => setC({ wristSize: e.target.value })} required /></label>
            )}
            {cat === "earrings" && (
              <label className="field"><span>{t.earringDetails}</span><input value={form.conditional.earringDetails || ""} onChange={(e) => setC({ earringDetails: e.target.value })} required /></label>
            )}
          </>
        )}

        {/* ── Step 2: 센터스톤 / 멀티스펙 ── */}
        {step === 1 && solitaire && (
          <>
            <h3 style={{ margin: "0" }}>{t.stoneTitle}</h3>
            <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label className="field"><span>{t.shape}</span>
                <select value={form.stonePrefs.shape} onFocus={() => setEduField("shape")} onChange={(e) => setS({ shape: e.target.value })}>
                  {BENCHMARK_SHAPES.map((sh) => <option key={sh} value={sh}>{p.shapes[sh] || sh}</option>)}
                </select></label>
              <label className="field"><span>{t.carat}</span><input type="number" step="0.1" value={form.stonePrefs.carat} onFocus={() => setEduField("carat")} onChange={(e) => setS({ carat: e.target.value })} /></label>
              <label className="field"><span>{t.color}</span>
                <select value={form.stonePrefs.color} onFocus={() => setEduField("color")} onChange={(e) => setS({ color: e.target.value })}>{["D", "E", "F", "G"].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>{t.clarity}</span>
                <select value={form.stonePrefs.clarity} onFocus={() => setEduField("clarity")} onChange={(e) => setS({ clarity: e.target.value })}>{["IF", "VVS1", "VVS2", "VS1", "VS2"].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>{t.growth}</span>
                <select value={form.stonePrefs.growth} onFocus={() => setEduField("growth")} onChange={(e) => setS({ growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
            </div>
            <details className="more-prefs">
              <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "4px 0" }}>{t.morePrefs}</summary>
              <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 12 }}>
                <label className="field"><span>{t.lab}</span><input value={form.stonePrefs.lab} onFocus={() => setEduField("lab")} onChange={(e) => setS({ lab: e.target.value })} /></label>
                <label className="field"><span>{t.fluorescence}</span>
                  <select value={form.stonePrefs.fluorescence} onFocus={() => setEduField("fluorescence")} onChange={(e) => setS({ fluorescence: e.target.value })}><option value="none">None</option><option value="faint">Faint</option><option value="medium">Medium</option></select></label>
                <label className="field"><span>{t.lwRatio}</span><input value={form.stonePrefs.lwRatio} onFocus={() => setEduField("lwRatio")} onChange={(e) => setS({ lwRatio: e.target.value })} placeholder="1.0" /></label>
              </div>
            </details>
            {bigStone && <p className="warn-note">{t.bigStoneNote}</p>}
            <div className="stone-edu-inline">
              <StoneEduPanel field={eduField} prefs={form.stonePrefs} />
            </div>
          </>
        )}
        {step === 1 && !solitaire && (
          <>
            <h3 style={{ margin: "0" }}>{t.multiTitle}</h3>
            <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="field"><span>{t.meleeSpec}</span><input value={form.multiSpec.meleeSpec} onChange={(e) => setM({ meleeSpec: e.target.value })} required /></label>
              <label className="field"><span>{t.overallDims}</span><input value={form.multiSpec.overallDims} onChange={(e) => setM({ overallDims: e.target.value })} required /></label>
              <label className="field"><span>{t.arrangement}</span><input value={form.multiSpec.arrangement} onChange={(e) => setM({ arrangement: e.target.value })} /></label>
              <label className="field"><span>{t.multiStandard}</span><input value={form.multiSpec.standard} onChange={(e) => setM({ standard: e.target.value })} /></label>
            </div>
          </>
        )}

        {/* ── Step 3: 레퍼런스 + 연락처 + 약관 ── */}
        {step === 2 && (
          <>
            <h3 style={{ margin: "0" }}>{p.visual.refTitle}</h3>
            <p className="form-hint">{p.visual.refHint}</p>
            <MediaPicker value={refs} onChange={(v) => {
              setRefs(v.map((m) => refs.find((r) => r.src === m.src) || { ...m, annotations: [] }));
              setAnnotIdx(0);
            }} />
            {refs.length > 1 && (
              <div className="row-actions">
                {refs.map((m, i) => (
                  <button type="button" key={m.src} className={`chip ${i === annotIdx ? "is-active" : ""}`} onClick={() => setAnnotIdx(i)}>#{i + 1}</button>
                ))}
              </div>
            )}
            {refs[annotIdx] && (
              <PinAnnotator src={refs[annotIdx].src} annotations={refs[annotIdx].annotations || []}
                onChange={(ann) => setRefs(refs.map((m, i) => (i === annotIdx ? { ...m, annotations: ann } : m)))} />
            )}

            <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="field"><span>{t.name}</span><input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></label>
              <label className="field"><span>{t.contact}</span><input value={form.contact} onChange={(e) => setF({ contact: e.target.value })} required /></label>
            </div>

            <div className="panel" style={{ background: "var(--bg-2)" }}>
              {t.termsBlocks.map((b, i) => <p key={i} className="form-hint" style={{ margin: "4px 0" }}>· {b}</p>)}
            </div>
            <label className="field" style={{ flexDirection: "row", display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={form.termsAccepted} onChange={(e) => setF({ termsAccepted: e.target.checked })} style={{ width: "auto" }} required />
              <span>{t.terms}</span>
            </label>
            <p className="form-hint">{p.ftc}</p>
          </>
        )}

        {/* ── 위저드 네비게이션 ── */}
        {stepError && <p className="form-error">{p.common?.required || "필수 항목을 입력하세요."}</p>}
        <div className="wizard-nav">
          {step > 0 ? <button type="button" className="button secondary" onClick={() => setStep((s) => s - 1)}>{t.back}</button> : <span />}
          {step < 2
            ? <button type="button" className="button primary" onClick={goNext}>{t.next}</button>
            : <button className="button primary" type="submit" disabled={!form.termsAccepted}>{t.submit}</button>}
        </div>
      </form>
      {sidePanel === "stone" && (
        <aside className="stone-edu-aside">
          <StoneEduPanel field={eduField} prefs={form.stonePrefs} />
        </aside>
      )}
      {sidePanel === "ring" && (
        <aside className="stone-edu-aside"><RingSizeHelp /></aside>
      )}
      </div>
      <p style={{ marginTop: 16 }}><Link className="text-link" to="/styles">{p.styleCat.title} →</Link></p>
    </div>
  );
}
