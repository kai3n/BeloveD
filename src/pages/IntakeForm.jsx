import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, X } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import {
  BENCHMARK_SHAPES,
  BRACELET_WRIST_OPTIONS,
  CHAIN_LENGTHS,
  CHAIN_STYLE_OPTIONS,
  CLASP_OPTIONS,
  EARRING_PAIRING_OPTIONS,
  OPS_CATEGORIES,
  OPS_METALS,
  PRODUCT_LINES,
} from "../lib/ops.js";
import { createIntake, getDiamond, listOpsStyles } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { pickI18n, useLocale } from "../i18n.jsx";
import { LuxuryDatePicker, LuxurySelect, MediaPicker, MediaThumb } from "../components/ui.jsx";
import PinAnnotator from "../components/PinAnnotator.jsx";
import StoneEduPanel from "../components/StoneEducation.jsx";
import CategoryGuide from "../components/CategoryGuide.jsx";
import QuoteCompare from "../components/QuoteCompare.jsx";

const DRAFT_KEY = "lumina-intake-draft";
const RING_SIZE_OPTIONS = Array.from({ length: 21 }, (_, i) => String(3 + i * 0.5).replace(/\.0$/, ""));

function categoryDefaults(category) {
  if (category === "ring") return { ringSize: "" };
  if (category === "necklace") return { chainStyle: "", chainLength: "18in", clasp: "" };
  if (category === "bangle") return { wristSize: "" };
  if (category === "earrings") return { earringDetails: "" };
  return {};
}

function styleMedia(style) {
  if (!style) return null;
  if (Array.isArray(style.media) && style.media.length > 0) return style.media[0];
  if (style.coverImage) return { kind: style.coverImage.endsWith(".mp4") ? "video" : "image", src: style.coverImage };
  return null;
}

function intakeOption(options, labels = {}, descriptions = {}) {
  return options.map((value) => ({
    value,
    label: descriptions[value] ? `${labels[value] || value} · ${descriptions[value]}` : labels[value] || value,
  }));
}

function chainLengthLabel(value) {
  if (value === "16in") return "16 in / 40 cm";
  if (value === "18in") return "18 in / 45 cm";
  return "20 in / 50 cm";
}

function readDraft() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

export default function IntakeForm() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.intake;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const styles = listOpsStyles({ publishedOnly: true });
  const styleParam = params.get("style") || "";
  const styleFromParam = styles.find((st) => st.id === styleParam);
  // 쇼케이스 다이아에서 진입 시 스톤 선호 프리필
  const refDiamond = params.get("diamond") ? getDiamond(params.get("diamond")) : null;
  const draft = readDraft();

  const baseForm = {
    name: user?.name || "", contact: user?.email || "", productLine: "solitaire", category: styleFromParam?.category || "ring",
    styleId: styleParam, metal: "18kw",
    conditional: categoryDefaults(styleFromParam?.category || "ring"),
    stonePrefs: {
      shape: refDiamond?.shape || "round", carat: String(refDiamond?.carat || "1.5"),
      color: refDiamond?.color || "E", clarity: refDiamond?.clarity || "VS1",
      growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "",
    },
    multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
    requiredDate: "", termsAccepted: false,
  };
  const [form, setForm] = useState(() => {
    if (!draft?.form) return baseForm;
    return {
      ...baseForm,
      ...draft.form,
      category: styleFromParam?.category || draft.form.category || baseForm.category,
      styleId: styleParam || draft.form.styleId || baseForm.styleId,
      conditional: { ...baseForm.conditional, ...draft.form.conditional },
      stonePrefs: { ...baseForm.stonePrefs, ...draft.form.stonePrefs },
      multiSpec: { ...baseForm.multiSpec, ...draft.form.multiSpec },
    };
  });
  const [done, setDone] = useState(null);
  const [refs, setRefs] = useState(() => draft?.refs || []); // [{kind, src, annotations[]}]
  const [annotIdx, setAnnotIdx] = useState(0);
  const [eduField, setEduField] = useState("shape"); // 교육 패널이 따라가는 포커스 필드
  const [step, setStep] = useState(0); // 0:제품 1:센터스톤 2:레퍼런스 3:리뷰
  const [stepError, setStepError] = useState(false);
  const [stylePreviewOpen, setStylePreviewOpen] = useState(false);
  const wizardSteps = [...t.wizardSteps, t.reviewStep];
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setC = (patch) => setForm((f) => ({ ...f, conditional: { ...f.conditional, ...patch } }));
  const setS = (patch) => setForm((f) => ({ ...f, stonePrefs: { ...f.stonePrefs, ...patch } }));
  const setM = (patch) => setForm((f) => ({ ...f, multiSpec: { ...f.multiSpec, ...patch } }));
  const stylesForCategory = styles.filter((st) => st.category === form.category);
  const selectedStyle = styles.find((st) => st.id === form.styleId) || null;
  const selectedStyleThumb = styleMedia(selectedStyle);
  const selectedStyleName = selectedStyle ? pickI18n(selectedStyle.name, locale) : "";
  const ringSizeValue = RING_SIZE_OPTIONS.includes(form.conditional.ringSize || "") ? form.conditional.ringSize : "";
  const chainStyleValue = CHAIN_STYLE_OPTIONS.includes(form.conditional.chainStyle || "") ? form.conditional.chainStyle : "";
  const claspValue = CLASP_OPTIONS.includes(form.conditional.clasp || "") ? form.conditional.clasp : "";
  const earringDetailsValue = EARRING_PAIRING_OPTIONS.includes(form.conditional.earringDetails || "") ? form.conditional.earringDetails : "";
  const wristSizeValue = BRACELET_WRIST_OPTIONS.includes(form.conditional.wristSize || "") ? form.conditional.wristSize : "";
  const optionLabels = t.optionLabels || {};
  const optionDescriptions = t.optionDescriptions || {};
  const chainStyleOptions = intakeOption(CHAIN_STYLE_OPTIONS, optionLabels.chainStyles, optionDescriptions.chainStyles);
  const claspOptions = intakeOption(CLASP_OPTIONS, optionLabels.clasps, optionDescriptions.clasps);
  const earringOptions = intakeOption(EARRING_PAIRING_OPTIONS, optionLabels.earringPairing, optionDescriptions.earringPairing);
  const wristOptions = intakeOption(BRACELET_WRIST_OPTIONS, optionLabels.braceletWrist, optionDescriptions.braceletWrist);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, refs, savedAt: new Date().toISOString() }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form, refs]);

  useEffect(() => {
    if (stylesForCategory.length === 0) {
      if (form.styleId) setF({ styleId: "" });
      return;
    }
    if (!stylesForCategory.some((st) => st.id === form.styleId)) {
      setF({ styleId: stylesForCategory[0].id });
    }
  }, [form.category, form.styleId, stylesForCategory]);

  useEffect(() => {
    if (form.category === "ring" && form.conditional.ringSize && !RING_SIZE_OPTIONS.includes(form.conditional.ringSize)) {
      setC({ ringSize: "" });
    }
  }, [form.category, form.conditional.ringSize]);

  useEffect(() => {
    if (form.category === "necklace") {
      const patch = {};
      if (form.conditional.chainStyle && !CHAIN_STYLE_OPTIONS.includes(form.conditional.chainStyle)) patch.chainStyle = "";
      if (form.conditional.clasp && !CLASP_OPTIONS.includes(form.conditional.clasp)) patch.clasp = "";
      if (Object.keys(patch).length > 0) setC(patch);
    }
    if (form.category === "earrings" && form.conditional.earringDetails && !EARRING_PAIRING_OPTIONS.includes(form.conditional.earringDetails)) {
      setC({ earringDetails: "" });
    }
    if (form.category === "bangle" && form.conditional.wristSize && !BRACELET_WRIST_OPTIONS.includes(form.conditional.wristSize)) {
      setC({ wristSize: "" });
    }
  }, [form.category, form.conditional.chainStyle, form.conditional.clasp, form.conditional.earringDetails, form.conditional.wristSize]);

  useEffect(() => {
    if (!stylePreviewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [stylePreviewOpen]);

  function submit(e) {
    e.preventDefault();
    // 마지막(리뷰) 단계가 아니면 제출하지 않는다. 단계 0의 텍스트형 입력이 하나뿐일 때
    // 브라우저가 Enter로 폼을 암묵적 제출해 위저드(리뷰 포함)를 건너뛰는 것을 방어 — Enter는 "다음"으로 동작.
    if (step < 3) { goNext(); return; }
    const payload = {
      ...form,
      stonePrefs: form.productLine === "solitaire" ? { ...form.stonePrefs, carat: Number(form.stonePrefs.carat) || null } : null,
      multiSpec: form.productLine === "multi" ? form.multiSpec : null,
      referenceMedia: refs,
    };
    const { order } = createIntake(payload, user?.id || null);
    window.localStorage.removeItem(DRAFT_KEY);
    setDone(order);
  }

  // 단계 진행 전 현재 단계 필수값 검증 (HTML required는 단계 이동을 막지 못함)
  function validateStep(s) {
    if (s === 0) {
      const c = form.category;
      if (c === "ring" && !RING_SIZE_OPTIONS.includes(form.conditional.ringSize || "")) return false;
      if (c === "necklace" && !CHAIN_STYLE_OPTIONS.includes(form.conditional.chainStyle || "")) return false;
      if (c === "necklace" && !CLASP_OPTIONS.includes(form.conditional.clasp || "")) return false;
      if (c === "bangle" && !BRACELET_WRIST_OPTIONS.includes(form.conditional.wristSize || "")) return false;
      if (c === "earrings" && !EARRING_PAIRING_OPTIONS.includes(form.conditional.earringDetails || "")) return false;
      return true;
    }
    if (s === 1 && form.productLine === "multi") {
      return Boolean(form.multiSpec.meleeSpec.trim() && form.multiSpec.overallDims.trim());
    }
    if (s === 2) {
      return Boolean(form.name.trim() && form.contact.trim() && form.termsAccepted);
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
          <button className="button primary" onClick={() => navigate(`/orders/${done.id}?code=${done.queryCode}`)}>{t.goPortal}</button>
        </div>
      </div>
    );
  }

  const cat = form.category;
  const solitaire = form.productLine === "solitaire";
  const bigStone = solitaire && Number(form.stonePrefs.carat) >= 2;

  const showEdu = solitaire && step === 1; // 센터스톤 단계: 교육 사이드패널
  const showGuide = step === 0; // 제품 단계: 카테고리별 사이즈/디자인 가이드
  const sidePanel = showEdu ? "stone" : showGuide ? "guide" : null;

  return (
    <div className="page page-narrow" style={{ maxWidth: sidePanel ? 1020 : 680 }}>
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>

      <ol className="stepper">
        {wizardSteps.map((label, i) => (
          <li key={label} className={i === step ? "current" : i < step ? "done" : ""}><span className="dot" />{label}</li>
        ))}
      </ol>
      <p className="form-hint intake-meta-note">
        {t.requiredNote} · {t.savedNote}
      </p>

      <div className={`intake-layout ${sidePanel ? "has-edu" : ""}`}>
      <form className="panel form-stack" onSubmit={submit}>

        {/* ── Step 1: 제품 ── */}
        {step === 0 && (
          <>
            <div className="filter-grid intake-product-grid">
              <label className="field"><span>{t.category}</span>
                <LuxurySelect
                  value={form.category}
                  ariaLabel={t.category}
                  options={OPS_CATEGORIES.map((c) => ({ value: c, label: p.opsCategories[c] }))}
                  onChange={(value) => setF({ category: value, conditional: categoryDefaults(value), styleId: "" })}
                />
              </label>
              <label className="field design-select-field"><span>{t.style}</span>
                <LuxurySelect
                  value={form.styleId}
                  ariaLabel={t.style}
                  placeholder={t.noStyle}
                  className="style-select-control"
                  options={stylesForCategory.length === 0
                    ? [{ value: "", label: t.noStyle, disabled: true }]
                    : stylesForCategory.map((st) => ({ value: st.id, label: pickI18n(st.name, locale) }))}
                  onChange={(value) => setF({ styleId: value })}
                />
              </label>
              <label className="field"><span>{t.productLine}</span>
                <LuxurySelect
                  value={form.productLine}
                  ariaLabel={t.productLine}
                  options={PRODUCT_LINES.map((pl) => ({ value: pl, label: p.productLines[pl] }))}
                  onChange={(value) => setF({ productLine: value })}
                />
              </label>
              <label className="field"><span>{t.metal}</span>
                <LuxurySelect
                  value={form.metal}
                  ariaLabel={t.metal}
                  options={Object.keys(OPS_METALS ? p.opsMetals : {}).map((m) => ({ value: m, label: p.opsMetals[m] }))}
                  onChange={(value) => setF({ metal: value })}
                />
              </label>
              {cat === "ring" && (
                <label className="field"><span>{t.ringSize} <span className="req">*</span></span>
                  <LuxurySelect
                    value={ringSizeValue}
                    ariaLabel={t.ringSize}
                    placeholder={t.ringSizeSelect}
                    options={RING_SIZE_OPTIONS.map((size) => ({ value: size, label: `US ${size}` }))}
                    onChange={(value) => setC({ ringSize: value })}
                  />
                </label>
              )}
              {cat === "bangle" && (
                <label className="field"><span>{t.wristSize} <span className="req">*</span></span>
                  <LuxurySelect
                    value={wristSizeValue}
                    ariaLabel={t.wristSize}
                    placeholder={t.wristSizeSelect}
                    options={wristOptions}
                    onChange={(value) => setC({ wristSize: value })}
                  />
                </label>
              )}
              {cat === "earrings" && (
                <label className="field"><span>{t.earringDetails} <span className="req">*</span></span>
                  <LuxurySelect
                    value={earringDetailsValue}
                    ariaLabel={t.earringDetails}
                    placeholder={t.earringDetailsSelect}
                    options={earringOptions}
                    onChange={(value) => setC({ earringDetails: value })}
                  />
                </label>
              )}
              {cat === "necklace" && (
                <label className="field"><span>{t.chainStyle} <span className="req">*</span></span>
                  <LuxurySelect
                    value={chainStyleValue}
                    ariaLabel={t.chainStyle}
                    placeholder={t.chainStyleSelect}
                    options={chainStyleOptions}
                    onChange={(value) => setC({ chainStyle: value })}
                  />
                </label>
              )}
              <label className="field"><span>{t.requiredDate}</span>
                <LuxuryDatePicker
                  value={form.requiredDate}
                  ariaLabel={t.requiredDate}
                  onChange={(value) => setF({ requiredDate: value })}
                />
              </label>
              {cat === "necklace" && (
                <label className="field"><span>{t.chainLength}</span>
                  <LuxurySelect
                    value={form.conditional.chainLength || "18in"}
                    ariaLabel={t.chainLength}
                    options={CHAIN_LENGTHS.map((l) => ({ value: l, label: chainLengthLabel(l) }))}
                    onChange={(value) => setC({ chainLength: value })}
                  />
                </label>
              )}
              {cat === "necklace" && (
                <label className="field"><span>{t.clasp} <span className="req">*</span></span>
                  <LuxurySelect
                    value={claspValue}
                    ariaLabel={t.clasp}
                    placeholder={t.claspSelect}
                    options={claspOptions}
                    onChange={(value) => setC({ clasp: value })}
                  />
                </label>
              )}
            </div>
            {selectedStyle && (
              <div className="selected-design-row">
                <button
                  type="button"
                  className="selected-design-thumb"
                  aria-label={`${t.preview} ${selectedStyleName}`}
                  disabled={!selectedStyleThumb}
                  onClick={() => selectedStyleThumb && setStylePreviewOpen(true)}
                >
                  {selectedStyleThumb ? <MediaThumb media={selectedStyleThumb} alt="" /> : <span />}
                </button>
                <div className="selected-design-copy">
                  <span>{t.selectedDesign}</span>
                  <strong>{selectedStyleName}</strong>
                </div>
                {selectedStyleThumb && (
                  <button
                    type="button"
                    className="selected-design-preview"
                    onClick={() => setStylePreviewOpen(true)}
                  >
                    <Eye size={15} strokeWidth={2} aria-hidden="true" />
                    {t.preview}
                  </button>
                )}
              </div>
            )}
            <div className="stone-edu-inline"><CategoryGuide category={cat} /></div>
          </>
        )}

        {/* ── Step 2: 센터스톤 / 멀티스펙 ── */}
        {step === 1 && solitaire && (
          <>
            <h3 style={{ margin: "0" }}>{t.stoneTitle}</h3>
            <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label className="field"><span>{t.shape}</span>
                <LuxurySelect
                  value={form.stonePrefs.shape}
                  ariaLabel={t.shape}
                  options={BENCHMARK_SHAPES.map((sh) => ({ value: sh, label: p.shapes[sh] || sh }))}
                  onFocus={() => setEduField("shape")}
                  onChange={(value) => setS({ shape: value })}
                />
              </label>
              <label className="field"><span>{t.carat}</span><input type="number" step="0.1" value={form.stonePrefs.carat} onFocus={() => setEduField("carat")} onChange={(e) => setS({ carat: e.target.value })} /></label>
              <label className="field"><span>{t.color}</span>
                <LuxurySelect
                  value={form.stonePrefs.color}
                  ariaLabel={t.color}
                  options={["D", "E", "F", "G"].map((c) => ({ value: c, label: c }))}
                  onFocus={() => setEduField("color")}
                  onChange={(value) => setS({ color: value })}
                />
              </label>
              <label className="field"><span>{t.clarity}</span>
                <LuxurySelect
                  value={form.stonePrefs.clarity}
                  ariaLabel={t.clarity}
                  options={["IF", "VVS1", "VVS2", "VS1", "VS2"].map((c) => ({ value: c, label: c }))}
                  onFocus={() => setEduField("clarity")}
                  onChange={(value) => setS({ clarity: value })}
                />
              </label>
              <label className="field"><span>{t.growth}</span>
                <LuxurySelect
                  value={form.stonePrefs.growth}
                  ariaLabel={t.growth}
                  options={["CVD", "HPHT"].map((g) => ({ value: g, label: g }))}
                  onFocus={() => setEduField("growth")}
                  onChange={(value) => setS({ growth: value })}
                />
              </label>
            </div>
            <details className="more-prefs">
              <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "4px 0" }}>{t.morePrefs}</summary>
              <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 12 }}>
                <label className="field"><span>{t.lab}</span><input value={form.stonePrefs.lab} onFocus={() => setEduField("lab")} onChange={(e) => setS({ lab: e.target.value })} /></label>
                <label className="field"><span>{t.fluorescence}</span>
                  <LuxurySelect
                    value={form.stonePrefs.fluorescence}
                    ariaLabel={t.fluorescence}
                    options={["none", "faint", "medium"].map((key) => ({ value: key, label: t.fluorescenceLevels[key] }))}
                    onFocus={() => setEduField("fluorescence")}
                    onChange={(value) => setS({ fluorescence: value })}
                  />
                </label>
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
              <label className="field"><span>{t.meleeSpec} <span className="req">*</span></span><input value={form.multiSpec.meleeSpec} onChange={(e) => setM({ meleeSpec: e.target.value })} required /></label>
              <label className="field"><span>{t.overallDims} <span className="req">*</span></span><input value={form.multiSpec.overallDims} onChange={(e) => setM({ overallDims: e.target.value })} required /></label>
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
              <label className="field"><span>{t.name} <span className="req">*</span></span><input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></label>
              <label className="field"><span>{t.contact} <span className="req">*</span></span><input value={form.contact} onChange={(e) => setF({ contact: e.target.value })} required /></label>
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

        {step === 3 && (
          <>
            <h3 style={{ margin: "0" }}>{t.reviewTitle}</h3>
            <div className="review-grid">
              <div className="summary-card"><div className="lbl">{t.reviewCategory}</div><div className="num">{p.opsCategories[form.category]}</div></div>
              <div className="summary-card"><div className="lbl">{t.reviewStyle}</div><div className="num">{form.styleId || t.openBrief}</div></div>
              <div className="summary-card"><div className="lbl">{t.reviewMetal}</div><div className="num">{p.opsMetals[form.metal]}</div></div>
            </div>
            <QuoteCompare form={form} />
            <div className="panel" style={{ background: "var(--bg-2)" }}>
              <p className="form-hint" style={{ margin: 0 }}>
                {form.productLine === "solitaire"
                  ? `${p.shapes[form.stonePrefs.shape] || form.stonePrefs.shape} · ${form.stonePrefs.carat}ct · ${form.stonePrefs.color} · ${form.stonePrefs.clarity}`
                  : `${form.multiSpec.meleeSpec} · ${form.multiSpec.overallDims}`}
              </p>
              <p className="form-hint" style={{ margin: "8px 0 0" }}>
                {t.referenceSummary(refs.length, form.requiredDate || t.noRequiredDate)}
              </p>
            </div>
            <p className="form-hint">{t.reviewNote}</p>
          </>
        )}

        {/* ── 위저드 네비게이션 ── */}
        {stepError && <p className="form-error">{t.requiredError}</p>}
        <div className="wizard-nav">
          {step > 0 ? <button type="button" className="button secondary" onClick={() => setStep((s) => s - 1)}>{t.back}</button> : <span />}
          {step < 3
            ? <button type="button" className="button primary" onClick={goNext}>{t.next}</button>
            : <button className="button primary" type="submit" disabled={!form.termsAccepted}>{t.submit}</button>}
        </div>
      </form>
      {stylePreviewOpen && selectedStyle && selectedStyleThumb && (
        <div
          className="selected-style-modal"
          role="dialog"
          aria-modal="true"
          aria-label={selectedStyleName}
          onClick={() => setStylePreviewOpen(false)}
        >
          <div className="selected-style-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="selected-style-modal-head">
              <div>
                <span>{t.selectedDesign}</span>
                <h2>{selectedStyleName}</h2>
              </div>
              <button type="button" aria-label={t.closePreview} onClick={() => setStylePreviewOpen(false)}>
                <X size={22} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="selected-style-modal-media">
              <MediaThumb media={selectedStyleThumb} alt={selectedStyleName} eager />
            </div>
          </div>
        </div>
      )}
      {sidePanel === "stone" && (
        <aside className="stone-edu-aside">
          <StoneEduPanel field={eduField} prefs={form.stonePrefs} />
        </aside>
      )}
      {sidePanel === "guide" && (
        <aside className="stone-edu-aside"><CategoryGuide category={cat} /></aside>
      )}
      </div>
      <p style={{ marginTop: 16 }}><Link className="text-link" to="/designs">{t.backToDesigns} →</Link></p>
    </div>
  );
}
