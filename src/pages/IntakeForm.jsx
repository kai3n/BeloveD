import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
} from "../lib/ops.js";
import { createIntake, getDiamond, listOpsStyles } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { pickI18n, useLocale } from "../i18n.jsx";
import { LuxuryDatePicker, LuxurySelect, MediaPicker, MediaThumb } from "../components/ui.jsx";
import StoneEduPanel from "../components/StoneEducation.jsx";
import CategoryGuide from "../components/CategoryGuide.jsx";
import QuoteCompare from "../components/QuoteCompare.jsx";
import MultiStoneGuide from "../components/MultiStoneGuide.jsx";
import { defaultSubcategoryFor, styleSubcategoryKey, subcategoryKeysFor } from "../lib/designSlots.js";

const DRAFT_KEY = "lumina-intake-draft";
const MAX_REFERENCE_MEDIA = 5;
const REVIEW_STEP = 3;
const DEFAULT_MULTI_STANDARD = "F-G / VS+";
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

function inferProductLineFromStyle(style) {
  if (!style) return "solitaire";
  const text = [
    style.id,
    style.category,
    style.name?.en,
    style.name?.ko,
    style.name?.zh,
    style.name?.es,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/(band|eternity|tennis|bracelet|bangle|stud|earring|halo|pav[eé]|multi|station|three[- ]?stone|3[- ]?stone)/i.test(text)) {
    return "multi";
  }
  return "solitaire";
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

function labelFromMap(map, value) {
  if (!value) return "";
  return map?.[value] || value;
}

function displayMultiStandard(value, fallback) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue || cleanValue === DEFAULT_MULTI_STANDARD) return fallback || DEFAULT_MULTI_STANDARD;
  return cleanValue;
}

function normalizeSubcategory(category, subcategory) {
  const keys = subcategoryKeysFor(category);
  if (keys.includes(subcategory)) return subcategory;
  return defaultSubcategoryFor(category);
}

function sanitizeReferenceMedia(items) {
  return (items || []).slice(0, MAX_REFERENCE_MEDIA).map((media) => ({
    kind: media.kind || "image",
    src: media.src,
    ...(media.name ? { name: media.name } : {}),
    ...(media.size ? { size: media.size } : {}),
    ...(media.originalSize ? { originalSize: media.originalSize } : {}),
    ...(media.width ? { width: media.width } : {}),
    ...(media.height ? { height: media.height } : {}),
    ...(media.optimized ? { optimized: true } : {}),
    ...(media.transient ? { transient: true } : {}),
  }));
}

function submissionContact(form, user) {
  const fallbackName = user?.email?.split("@")[0] || "";
  return {
    name: (user?.name || form.name || fallbackName).trim(),
    contact: (user?.email || form.contact || "").trim(),
  };
}

function hasContactDetails(form) {
  return Boolean((form.name || "").trim() && (form.contact || "").trim());
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
  const categoryParam = params.get("category") || "";
  const categoryFromParam = OPS_CATEGORIES.includes(categoryParam) ? categoryParam : "";
  const initialCategory = styleFromParam?.category || categoryFromParam || "ring";
  const initialSubcategory = normalizeSubcategory(initialCategory, styleFromParam ? styleSubcategoryKey(styleFromParam) : "");
  // 쇼케이스 다이아에서 진입 시 스톤 선호 프리필
  const refDiamond = params.get("diamond") ? getDiamond(params.get("diamond")) : null;
  const draft = readDraft();

  const baseForm = {
    name: user?.name || "", contact: user?.email || "", productLine: inferProductLineFromStyle(styleFromParam), category: initialCategory,
    subcategory: initialSubcategory,
    styleId: styleParam, metal: "18kw",
    conditional: categoryDefaults(initialCategory),
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
    const nextCategory = styleFromParam?.category || categoryFromParam || draft.form.category || baseForm.category;
    const nextSubcategory = normalizeSubcategory(
      nextCategory,
      styleFromParam ? styleSubcategoryKey(styleFromParam) : draft.form.subcategory,
    );
    return {
      ...baseForm,
      ...draft.form,
      category: nextCategory,
      subcategory: nextSubcategory,
      styleId: styleParam || draft.form.styleId || baseForm.styleId,
      conditional: { ...baseForm.conditional, ...draft.form.conditional },
      stonePrefs: { ...baseForm.stonePrefs, ...draft.form.stonePrefs },
      multiSpec: { ...baseForm.multiSpec, ...draft.form.multiSpec },
      termsAccepted: false,
    };
  });
  const [done, setDone] = useState(null);
  const [refs, setRefs] = useState(() => sanitizeReferenceMedia(draft?.refs)); // [{kind, src}]
  const [eduField, setEduField] = useState("shape"); // 교육 패널이 따라가는 포커스 필드
  const [step, setStep] = useState(0); // 0:제품 1:센터스톤 2:레퍼런스 3:리뷰
  const [stepError, setStepError] = useState(false);
  const stepAnchorRef = useRef(null);
  const didMountStepRef = useRef(false);
  const previousStepRef = useRef(step);
  const wizardSteps = [...t.wizardSteps, t.reviewStep];
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setC = (patch) => setForm((f) => ({ ...f, conditional: { ...f.conditional, ...patch } }));
  const setS = (patch) => setForm((f) => ({ ...f, stonePrefs: { ...f.stonePrefs, ...patch } }));
  const setM = (patch) => setForm((f) => ({ ...f, multiSpec: { ...f.multiSpec, ...patch } }));
  const categorySubcategories = subcategoryKeysFor(form.category);
  const selectedSubcategory = normalizeSubcategory(form.category, form.subcategory);
  const stylesForCategory = styles.filter((st) => st.category === form.category);
  const stylesForSelection = stylesForCategory.filter((st) => styleSubcategoryKey(st) === selectedSubcategory);
  const selectedStyle = styles.find((st) => st.id === form.styleId) || null;
  const selectedStyleName = selectedStyle ? pickI18n(selectedStyle.name, locale) : form.styleId || t.openBrief;
  const selectedSubcategoryLabel = selectedSubcategory ? p.opsSubcategories?.[selectedSubcategory] || selectedSubcategory : "";
  const selectedStyleThumb = styleMedia(selectedStyle);
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
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        form: { ...form, termsAccepted: false },
        refs,
        savedAt: new Date().toISOString(),
      }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form, refs]);

  useEffect(() => {
    const previousStep = previousStepRef.current;
    previousStepRef.current = step;
    if (step === REVIEW_STEP && previousStep !== REVIEW_STEP) {
      setForm((current) => current.termsAccepted ? { ...current, termsAccepted: false } : current);
    }
  }, [step]);

  useEffect(() => {
    const normalizedSubcategory = normalizeSubcategory(form.category, form.subcategory);
    if (form.subcategory !== normalizedSubcategory) {
      setF({ subcategory: normalizedSubcategory, styleId: "" });
      return;
    }
    if (stylesForSelection.length === 0) {
      if (form.styleId) setF({ styleId: "" });
      return;
    }
    if (!stylesForSelection.some((st) => st.id === form.styleId)) {
      setF({ styleId: stylesForSelection[0].id, productLine: inferProductLineFromStyle(stylesForSelection[0]) });
    }
  }, [form.category, form.subcategory, form.styleId, stylesForSelection]);

  useEffect(() => {
    if (!selectedStyle) return;
    const nextProductLine = inferProductLineFromStyle(selectedStyle);
    if (form.productLine !== nextProductLine) setF({ productLine: nextProductLine });
  }, [selectedStyle?.id, form.productLine]);

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
    if (!didMountStepRef.current) {
      didMountStepRef.current = true;
      return;
    }
    window.requestAnimationFrame(() => {
      stepAnchorRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }, [step]);

  function submit(e) {
    e.preventDefault();
    // 마지막(리뷰) 단계가 아니면 제출하지 않는다. 단계 0의 텍스트형 입력이 하나뿐일 때
    // 브라우저가 Enter로 폼을 암묵적 제출해 위저드(리뷰 포함)를 건너뛰는 것을 방어 — Enter는 "다음"으로 동작.
    if (step !== REVIEW_STEP) { goNext(); return; }
    const contactDetails = submissionContact(form, user);
    if (!hasContactDetails(contactDetails) || !form.termsAccepted) { setStepError(true); return; }
    const multiSpec = form.productLine === "multi"
      ? { ...form.multiSpec, standard: form.multiSpec.standard.trim() || DEFAULT_MULTI_STANDARD }
      : null;
    const payload = {
      ...form,
      ...contactDetails,
      stonePrefs: form.productLine === "solitaire" ? { ...form.stonePrefs, carat: Number(form.stonePrefs.carat) || null } : null,
      multiSpec,
      referenceMedia: sanitizeReferenceMedia(refs),
    };
    const { order } = createIntake(payload, user?.id || null);
    window.localStorage.removeItem(DRAFT_KEY);
    setDone(order);
  }

  // 단계 진행 전 현재 단계 필수값 검증 (HTML required는 단계 이동을 막지 못함)
  function validateStep(s) {
    if (s === 0) {
      const c = form.category;
      if (!form.category || !selectedSubcategory || !form.styleId || !form.metal) return false;
      if (c === "ring" && !RING_SIZE_OPTIONS.includes(form.conditional.ringSize || "")) return false;
      if (c === "necklace" && !CHAIN_STYLE_OPTIONS.includes(form.conditional.chainStyle || "")) return false;
      if (c === "necklace" && !CHAIN_LENGTHS.includes(form.conditional.chainLength || "")) return false;
      if (c === "necklace" && !CLASP_OPTIONS.includes(form.conditional.clasp || "")) return false;
      if (c === "bangle" && !BRACELET_WRIST_OPTIONS.includes(form.conditional.wristSize || "")) return false;
      if (c === "earrings" && !EARRING_PAIRING_OPTIONS.includes(form.conditional.earringDetails || "")) return false;
      return true;
    }
    if (s === 1 && form.productLine === "multi") {
      return Boolean(form.multiSpec.meleeSpec.trim() && form.multiSpec.overallDims.trim());
    }
    if (s === 2) return true;
    if (s === REVIEW_STEP) {
      return Boolean(hasContactDetails(submissionContact(form, user)) && form.termsAccepted);
    }
    return true; // 솔리테어 센터스톤은 기본값이 채워져 있음
  }
  function goNext() {
    if (validateStep(step)) {
      setStepError(false);
      setStep((s) => Math.min(s + 1, REVIEW_STEP));
    } else setStepError(true);
  }
  function handleNextClick(event) {
    event.preventDefault();
    goNext();
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
  const showMultiGuide = !solitaire && step === 1;
  const showGuide = step === 0; // 제품 단계: 카테고리별 사이즈/디자인 가이드
  const sidePanel = showEdu ? "stone" : showMultiGuide ? "multi" : showGuide ? "guide" : null;
  const productReviewItems = [
    { label: t.reviewCategory, value: p.opsCategories[form.category] },
    ...(selectedSubcategoryLabel ? [{ label: t.subcategory, value: selectedSubcategoryLabel }] : []),
    { label: t.reviewMetal, value: p.opsMetals[form.metal] },
    ...(form.category === "ring" ? [{ label: t.ringSize, value: ringSizeValue ? `US ${ringSizeValue}` : "" }] : []),
    ...(form.category === "necklace" ? [
      { label: t.chainStyle, value: labelFromMap(optionLabels.chainStyles, chainStyleValue) },
      { label: t.chainLength, value: chainLengthLabel(form.conditional.chainLength || "18in") },
      { label: t.clasp, value: labelFromMap(optionLabels.clasps, claspValue) },
    ] : []),
    ...(form.category === "bangle" ? [{ label: t.wristSize, value: labelFromMap(optionLabels.braceletWrist, wristSizeValue) }] : []),
    ...(form.category === "earrings" ? [{ label: t.earringDetails, value: labelFromMap(optionLabels.earringPairing, earringDetailsValue) }] : []),
  ].filter((item) => item.value);
  const multiStandardLabel = displayMultiStandard(form.multiSpec.standard, t.multiDefaultStandard);
  const stoneReviewItems = (form.productLine === "solitaire" ? [
    { label: t.shape, value: p.shapes[form.stonePrefs.shape] || form.stonePrefs.shape },
    { label: t.carat, value: `${form.stonePrefs.carat} ct` },
    { label: t.color, value: form.stonePrefs.color },
    { label: t.clarity, value: form.stonePrefs.clarity },
    { label: t.growth, value: form.stonePrefs.growth },
    { label: t.lab, value: form.stonePrefs.lab },
    { label: t.fluorescence, value: t.fluorescenceLevels?.[form.stonePrefs.fluorescence] || form.stonePrefs.fluorescence },
    { label: t.lwRatio, value: form.stonePrefs.lwRatio },
  ] : [
    { label: t.meleeSpec, value: form.multiSpec.meleeSpec },
    { label: t.overallDims, value: form.multiSpec.overallDims },
    { label: t.arrangement, value: form.multiSpec.arrangement },
    { label: t.multiStandard, value: multiStandardLabel },
  ]).filter((item) => item.value);
  const reviewSections = [
    { key: "product", title: t.wizardSteps[0], items: productReviewItems },
    { key: "stone", title: t.wizardSteps[1], items: stoneReviewItems },
  ];
  const referenceReviewItems = [{ label: t.wizardSteps[2], value: t.referenceFiles(refs.length) }];

  return (
    <div className="page page-narrow" style={{ maxWidth: sidePanel ? 1020 : 680 }}>
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>

      <ol className="stepper" ref={stepAnchorRef}>
        {wizardSteps.map((label, i) => (
          <li key={label} className={i === step ? "current" : i < step ? "done" : ""}><span className="dot" />{label}</li>
        ))}
      </ol>
      <p className="form-hint intake-meta-note">
        {t.requiredNote} · {t.savedNote}
      </p>

      <div className={`intake-layout ${sidePanel ? "has-edu" : ""}`}>
      <form className="panel form-stack intake-wizard-form" onSubmit={submit}>

        {/* ── Step 1: 제품 ── */}
        {step === 0 && (
          <>
            <div className="filter-grid intake-product-grid">
              <label className="field"><span>{t.category} <span className="req">*</span></span>
                <LuxurySelect
                  value={form.category}
                  ariaLabel={t.category}
                  options={OPS_CATEGORIES.map((c) => ({ value: c, label: p.opsCategories[c] }))}
                  onChange={(value) => setF({
                    category: value,
                    subcategory: defaultSubcategoryFor(value),
                    conditional: categoryDefaults(value),
                    styleId: "",
                  })}
                />
              </label>
              <label className="field"><span>{t.subcategory} <span className="req">*</span></span>
                <LuxurySelect
                  value={selectedSubcategory}
                  ariaLabel={t.subcategory}
                  options={categorySubcategories.map((key) => ({ value: key, label: p.opsSubcategories?.[key] || key }))}
                  onChange={(value) => setF({ subcategory: value, styleId: "" })}
                />
              </label>
              <label className="field design-select-field"><span>{t.style} <span className="req">*</span></span>
                <LuxurySelect
                  value={form.styleId}
                  ariaLabel={t.style}
                  placeholder={t.noStyle}
                  className="style-select-control"
                  options={stylesForSelection.length === 0
                    ? [{ value: "", label: t.noStyle, disabled: true }]
                    : stylesForSelection.map((st) => ({
                      value: st.id,
                      label: pickI18n(st.name, locale),
                    }))}
                  onChange={(value) => {
                    const nextStyle = styles.find((st) => st.id === value);
                    setF({
                      styleId: value,
                      subcategory: nextStyle ? styleSubcategoryKey(nextStyle) : selectedSubcategory,
                      productLine: inferProductLineFromStyle(nextStyle),
                    });
                  }}
                />
              </label>
              <label className="field"><span>{t.metal} <span className="req">*</span></span>
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
              {cat === "necklace" && (
                <label className="field"><span>{t.chainLength} <span className="req">*</span></span>
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
            <div className="stone-edu-inline"><CategoryGuide category={cat} /></div>
          </>
        )}

        {/* ── Step 2: 센터스톤 / 멀티스펙 ── */}
        {step === 1 && solitaire && (
          <>
            <h3 className="intake-step-title">{t.stoneTitle}</h3>
            <div className="filter-grid center-stone-grid">
              <label className="field"><span>{t.shape}</span>
                <LuxurySelect
                  value={form.stonePrefs.shape}
                  ariaLabel={t.shape}
                  options={BENCHMARK_SHAPES.map((sh) => ({ value: sh, label: p.shapes[sh] || sh }))}
                  onFocus={() => setEduField("shape")}
                  onChange={(value) => setS({ shape: value })}
                />
              </label>
              <label className="field"><span>{t.carat}</span><input className="lux-field-control" type="number" step="0.1" value={form.stonePrefs.carat} onFocus={() => setEduField("carat")} onChange={(e) => setS({ carat: e.target.value })} /></label>
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
              <summary className="more-prefs-summary">{t.morePrefs}</summary>
              <div className="filter-grid center-stone-grid center-stone-grid-secondary">
                <label className="field"><span>{t.lab}</span><input className="lux-field-control" value={form.stonePrefs.lab} onFocus={() => setEduField("lab")} onChange={(e) => setS({ lab: e.target.value })} /></label>
                <label className="field"><span>{t.fluorescence}</span>
                  <LuxurySelect
                    value={form.stonePrefs.fluorescence}
                    ariaLabel={t.fluorescence}
                    options={["none", "faint", "medium"].map((key) => ({ value: key, label: t.fluorescenceLevels[key] }))}
                    onFocus={() => setEduField("fluorescence")}
                    onChange={(value) => setS({ fluorescence: value })}
                  />
                </label>
                <label className="field"><span>{t.lwRatio}</span><input className="lux-field-control" value={form.stonePrefs.lwRatio} onFocus={() => setEduField("lwRatio")} onChange={(e) => setS({ lwRatio: e.target.value })} placeholder="1.0" /></label>
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
            <h3 className="intake-step-title">{t.multiTitle}</h3>
            <p className="form-hint multi-stone-intro">{t.multiIntro}</p>
            <div className="multi-auto-match-note">
              <div>
                <span>{t.multiAutoMatchKicker}</span>
                <strong>{t.multiAutoMatchTitle}</strong>
              </div>
              <p>{t.multiAutoMatchBody}</p>
            </div>
            <div className="filter-grid multi-stone-spec-grid">
              <label className="field"><span>{t.meleeSpec} <span className="req">*</span></span><input value={form.multiSpec.meleeSpec} onChange={(e) => setM({ meleeSpec: e.target.value })} placeholder={t.multiPlaceholders?.meleeSpec} required /></label>
              <label className="field"><span>{t.overallDims} <span className="req">*</span></span><input value={form.multiSpec.overallDims} onChange={(e) => setM({ overallDims: e.target.value })} placeholder={t.multiPlaceholders?.overallDims} required /></label>
              <label className="field"><span>{t.arrangement}</span><input value={form.multiSpec.arrangement} onChange={(e) => setM({ arrangement: e.target.value })} placeholder={t.multiPlaceholders?.arrangement} /></label>
              <div className="multi-standard-card">
                <span>{t.multiStandard}</span>
                <strong>{multiStandardLabel}</strong>
                <p>{t.multiStandardNote}</p>
              </div>
            </div>
            <div className="stone-edu-inline">
              <MultiStoneGuide />
            </div>
          </>
        )}

        {/* ── Step 3: 레퍼런스 ── */}
        {step === 2 && (
          <>
            <h3 style={{ margin: "0" }}>{p.visual.refTitle}</h3>
            <p className="form-hint">{p.visual.refHint}</p>
            <MediaPicker value={refs} maxItems={MAX_REFERENCE_MEDIA} showSamples={false} previewMode="list" onChange={(v) => {
              setRefs(sanitizeReferenceMedia(v));
            }} />
          </>
        )}

        {step === 3 && (
          <>
            <h3 style={{ margin: "0" }}>{t.reviewTitle}</h3>
            {!user && (
              <div className="review-contact-block">
                <h4>{t.contactTitle}</h4>
                <div className="filter-grid review-contact-grid">
                  <label className="field"><span>{t.name} <span className="req">*</span></span><input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></label>
                  <label className="field"><span>{t.contact} <span className="req">*</span></span><input value={form.contact} onChange={(e) => setF({ contact: e.target.value })} required /></label>
                </div>
              </div>
            )}
            <div className="review-details">
              {reviewSections.map((section) => (
                <section className="review-detail-section" key={section.title}>
                  <h4>{section.title}</h4>
                  {section.key === "product" && selectedStyleThumb && (
                    <div className="review-style-card">
                      <div className="review-style-thumb">
                        <MediaThumb media={selectedStyleThumb} alt={selectedStyleName} />
                      </div>
                      <div>
                        <span>{t.reviewStyle}</span>
                        <strong>{selectedStyleName}</strong>
                      </div>
                    </div>
                  )}
                  <dl className="review-detail-list">
                    {section.items.map((item) => (
                      <div className="review-detail-row" key={`${section.title}-${item.label}`}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              <section className="review-detail-section">
                <h4>{t.wizardSteps[2]}</h4>
                <dl className="review-detail-list">
                  {referenceReviewItems.map((item) => (
                    <div className="review-detail-row" key={`${t.wizardSteps[2]}-${item.label}`}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                {refs.length > 0 && (
                  <div className="review-media-grid" aria-label={t.referenceFiles(refs.length)}>
                    {refs.map((media, index) => {
                      const kindLabel = media.kind === "video"
                        ? p.picker.videoLabel || "Video"
                        : p.picker.photoLabel || "Photo";
                      return (
                        <div className="review-media-item" key={index}>
                          <div className="review-media-frame">
                            <MediaThumb media={media} alt={`${kindLabel} ${index + 1}`} />
                          </div>
                          <span>{kindLabel} {index + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              <section className="review-date-card">
                <label className="field"><span>{t.requiredDate}</span>
                  <LuxuryDatePicker
                    value={form.requiredDate}
                    ariaLabel={t.requiredDate}
                    onChange={(value) => setF({ requiredDate: value })}
                  />
                </label>
              </section>
            </div>
            <QuoteCompare form={form} />
            <p className="form-hint">{t.reviewNote}</p>
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
        {stepError && <p className="form-error">{t.requiredError}</p>}
        <div className={`wizard-nav ${step === 0 ? "is-first-step" : ""}`}>
          {step > 0 ? <button type="button" className="button secondary" onClick={() => setStep((s) => s - 1)}>{t.back}</button> : <span />}
          {step < REVIEW_STEP
            ? <button key={`next-${step}`} type="button" className="button primary" onClick={handleNextClick}>{t.next}</button>
            : <button key="submit" className="button primary" type="submit" disabled={!form.termsAccepted}>{t.submit}</button>}
        </div>
      </form>
      {sidePanel === "stone" && (
        <aside className="stone-edu-aside">
          <StoneEduPanel field={eduField} prefs={form.stonePrefs} />
        </aside>
      )}
      {sidePanel === "guide" && (
        <aside className="stone-edu-aside"><CategoryGuide category={cat} /></aside>
      )}
      {sidePanel === "multi" && (
        <aside className="stone-edu-aside"><MultiStoneGuide /></aside>
      )}
      </div>
      <p style={{ marginTop: 16 }}><Link className="text-link" to="/designs">{t.backToDesigns} →</Link></p>
    </div>
  );
}
