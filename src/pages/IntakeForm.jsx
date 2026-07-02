import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import {
  CHAIN_LENGTHS, CHAIN_STYLE_OPTIONS, CLASP_OPTIONS,
  EARRING_PAIRING_OPTIONS, BRACELET_WRIST_OPTIONS, OPS_CATEGORIES,
} from "../lib/ops.js";
import { createIntake, getDiamond, listOpsStyles } from "../lib/store.js";
import {
  MAX_REFERENCE_MEDIA, RING_SIZE_OPTIONS, buildIntakePayload, conditionalComplete,
  hasContactDetails, sanitizeReferenceMedia, submissionContact,
} from "../lib/intakePayload.js";
import { useDBVersion } from "../lib/useDB.js";
import { pickI18n, useLocale } from "../i18n.jsx";
import { LuxuryDatePicker, LuxurySelect, MediaPicker, MediaThumb } from "../components/ui.jsx";
import StoneEduPanel from "../components/StoneEducation.jsx";
import QuoteCompare from "../components/QuoteCompare.jsx";
import GalleryStep from "../components/intake/GalleryStep.jsx";
import { CaratSlider, ImageOptionGrid, MetalSwatches, ScalePicker, ShapeSilhouette, ShapeTiles } from "../components/intake/pickers.jsx";
import { defaultSubcategoryFor, styleSubcategoryKey, subcategoryKeysFor } from "../lib/designSlots.js";

const DRAFT_KEY = "lumina-intake-draft";

// 카테고리 대표 이미지 — 해당 카테고리 첫 스타일 미디어, 없으면 라인업 사진
const CATEGORY_FALLBACK_MEDIA = {
  ring: "/assets/lineup-ring.png",
  necklace: "/assets/lineup-pendant.png",
  earrings: "/assets/lineup-studs.png",
  bangle: "/assets/lineup-bracelet.png",
};

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

function normalizeSubcategory(category, subcategory) {
  const keys = subcategoryKeysFor(category);
  if (keys.includes(subcategory)) return subcategory;
  return defaultSubcategoryFor(category);
}

function readDraft() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

// 질문 순서 — 멀티스톤 디자인이면 셰입/캐럿을 건너뛴다
function screenList(productLine) {
  const list = ["category", "design", "metal"];
  if (productLine === "solitaire") list.push("shape", "carat");
  list.push("inspiration", "review");
  return list;
}

export default function IntakeForm() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.intake;
  const g = t.gflow;
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
  const [screen, setScreen] = useState(() => {
    // URL 프리필이 있으면 해당 질문은 건너뛴 위치에서 시작
    if (styleFromParam) return "metal";
    if (categoryFromParam) return "design";
    if (draft?.screen && draft.screen !== "review") return draft.screen;
    return "category";
  });
  const [done, setDone] = useState(null);
  const [refs, setRefs] = useState(() => sanitizeReferenceMedia(draft?.refs));
  const [stepError, setStepError] = useState("");
  const [adjustQuality, setAdjustQuality] = useState(false);

  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setC = (patch) => setForm((f) => ({ ...f, conditional: { ...f.conditional, ...patch } }));
  const setS = (patch) => setForm((f) => ({ ...f, stonePrefs: { ...f.stonePrefs, ...patch } }));

  const solitaire = form.productLine === "solitaire";
  const screens = screenList(form.productLine);
  const screenIdx = Math.max(0, screens.indexOf(screen));
  const selectedStyle = styles.find((st) => st.id === form.styleId) || null;
  const selectedStyleName = selectedStyle ? pickI18n(selectedStyle.name, locale) : g.notSureTitle;
  const stylesForCategory = styles.filter((st) => st.category === form.category);
  const optionLabels = t.optionLabels || {};
  const optionDescriptions = t.optionDescriptions || {};

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        form: { ...form, termsAccepted: false },
        refs,
        screen,
        savedAt: new Date().toISOString(),
      }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form, refs, screen]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setStepError("");
  }, [screen]);

  // 이미지 답변 탭 → 짧은 선택 피드백 후 자동 진행
  function selectAndAdvance(patch, currentName) {
    setF(patch);
    const nextLine = patch.productLine || form.productLine;
    const list = screenList(nextLine);
    const next = list[list.indexOf(currentName) + 1] || "review";
    window.setTimeout(() => setScreen(next), 170);
  }
  function goBack() {
    setScreen(screens[Math.max(screenIdx - 1, 0)]);
  }
  function goNext() {
    setScreen(screens[Math.min(screenIdx + 1, screens.length - 1)]);
  }

  function submit() {
    const contactDetails = submissionContact(form, user);
    if (!conditionalComplete(form.category, form.conditional) || !hasContactDetails(contactDetails) || !form.termsAccepted) {
      setStepError(t.requiredError);
      return;
    }
    const { order } = createIntake(buildIntakePayload(form, refs, user), user?.id || null);
    window.localStorage.removeItem(DRAFT_KEY);
    setDone(order);
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
  const categoryOptions = OPS_CATEGORIES.map((key) => {
    const firstStyled = styles.find((st) => st.category === key && styleMedia(st));
    return {
      value: key,
      label: p.opsCategories[key],
      media: styleMedia(firstStyled) || { kind: "image", src: CATEGORY_FALLBACK_MEDIA[key] },
    };
  });
  const designOptions = [
    ...stylesForCategory.map((st) => ({
      value: st.id,
      label: pickI18n(st.name, locale),
      sub: p.opsSubcategories?.[styleSubcategoryKey(st)] || "",
      media: styleMedia(st),
    })),
    { value: "", label: g.notSureTitle, sub: g.notSureSub, media: null },
  ];

  const colorOptions = ["D", "E", "F", "G"].map((v) => ({ value: v }));
  const clarityOptions = ["IF", "VVS1", "VVS2", "VS1", "VS2"].map((v) => ({ value: v }));
  const sectionKicker = {
    category: g.pieceCard, design: g.pieceCard, metal: t.metal,
    shape: g.stoneCard, carat: g.stoneCard, inspiration: g.inspirationCard, review: t.reviewStep,
  };
  const kicker = `${String(screenIdx + 1).padStart(2, "0")} — ${sectionKicker[screen] || ""}`;
  const stepShell = (title, hint, children, extra = {}) => (
    <GalleryStep
      index={screenIdx}
      total={screens.length}
      kicker={kicker}
      title={title}
      hint={hint}
      onBack={screenIdx > 0 ? goBack : null}
      backLabel={t.back}
      onSkip={extra.onSkip || null}
      skipLabel={g.skip}
    >
      {children}
    </GalleryStep>
  );

  return (
    <div className="page gflow-page">
      {screen === "category" && stepShell(g.qCategory, null, (
        <ImageOptionGrid
          columns={4}
          options={categoryOptions}
          value={form.category}
          onSelect={(value) => selectAndAdvance({
            category: value,
            subcategory: defaultSubcategoryFor(value),
            conditional: categoryDefaults(value),
            styleId: "",
          }, "category")}
        />
      ))}

      {screen === "design" && stepShell(g.qDesign, g.designHint, (
        <ImageOptionGrid
          columns={4}
          options={designOptions}
          value={form.styleId}
          onSelect={(value) => {
            const nextStyle = styles.find((st) => st.id === value) || null;
            selectAndAdvance({
              styleId: value,
              subcategory: nextStyle ? styleSubcategoryKey(nextStyle) : defaultSubcategoryFor(form.category),
              productLine: value ? inferProductLineFromStyle(nextStyle) : "solitaire",
            }, "design");
          }}
        />
      ))}

      {screen === "metal" && stepShell(g.qMetal, null, (
        <MetalSwatches
          value={form.metal}
          labels={p.opsMetals}
          onSelect={(value) => selectAndAdvance({ metal: value }, "metal")}
        />
      ))}

      {screen === "shape" && stepShell(g.qShape, null, (
        <>
          <ShapeTiles
            value={form.stonePrefs.shape}
            labels={p.shapes}
            onSelect={(value) => {
              setS({ shape: value });
              window.setTimeout(goNext, 170);
            }}
          />
          <details className="gflow-edu-toggle">
            <summary>{g.whatsThis}</summary>
            <div className="gflow-edu-body"><StoneEduPanel field="shape" prefs={form.stonePrefs} /></div>
          </details>
        </>
      ))}

      {screen === "carat" && stepShell(g.qCarat, g.caratHint, (
        <>
          <CaratSlider value={form.stonePrefs.carat} onChange={(value) => setS({ carat: value })} />
          <button className="button primary" type="button" onClick={goNext}>{t.next}</button>
          <details className="gflow-edu-toggle">
            <summary>{g.whatsThis}</summary>
            <div className="gflow-edu-body"><StoneEduPanel field="carat" prefs={form.stonePrefs} /></div>
          </details>
        </>
      ))}

      {screen === "inspiration" && stepShell(g.qInspiration, g.inspirationHint, (
        <div style={{ width: "min(100%, 640px)", display: "grid", gap: 16 }}>
          <MediaPicker value={refs} maxItems={MAX_REFERENCE_MEDIA} showSamples={false} previewMode="list" onChange={(v) => {
            setRefs(sanitizeReferenceMedia(v));
          }} />
          <button className="button primary" type="button" onClick={goNext}>{t.next}</button>
        </div>
      ), { onSkip: goNext })}

      {screen === "review" && stepShell(g.qReview, g.reviewHint, (
        <div className="gflow-review">
          <div className="gflow-review-cards">
            <div className="gflow-review-card">
              <div className="rc-media">
                {styleMedia(selectedStyle)
                  ? <MediaThumb media={styleMedia(selectedStyle)} alt={selectedStyleName} ratio="16 / 10" />
                  : <MediaThumb media={categoryOptions.find((c) => c.value === cat)?.media} alt={p.opsCategories[cat]} ratio="16 / 10" />}
              </div>
              <div className="rc-body">
                <span>{g.pieceCard}</span>
                <strong>{selectedStyleName}</strong>
                <small>{p.opsCategories[cat]} · {p.opsMetals[form.metal]}</small>
              </div>
            </div>
            <div className="gflow-review-card">
              <div className="rc-media">
                {solitaire ? <ShapeSilhouette shape={form.stonePrefs.shape} /> : <MediaThumb media={styleMedia(selectedStyle) || categoryOptions.find((c) => c.value === cat)?.media} alt="" ratio="16 / 10" />}
              </div>
              <div className="rc-body">
                <span>{g.stoneCard}</span>
                {solitaire ? (
                  <>
                    <strong>{p.shapes[form.stonePrefs.shape] || form.stonePrefs.shape} {Number(form.stonePrefs.carat).toFixed(2)}ct</strong>
                    <small>{form.stonePrefs.color} · {form.stonePrefs.clarity} · {form.stonePrefs.growth} · IGI</small>
                  </>
                ) : (
                  <>
                    <strong>{t.multiDefaultStandard}</strong>
                    <small>{g.multiNote}</small>
                  </>
                )}
              </div>
            </div>
            <div className="gflow-review-card">
              <div className="rc-media">
                {refs[0]
                  ? <MediaThumb media={refs[0]} alt={g.inspirationCard} ratio="16 / 10" />
                  : <ShapeSilhouette shape="round" />}
              </div>
              <div className="rc-body">
                <span>{g.inspirationCard}</span>
                <strong>{g.filesCount(refs.length)}</strong>
                <small>{p.visual.refHint}</small>
              </div>
            </div>
          </div>

          {/* 사이즈 & 핏 — 카테고리별 필수값 */}
          <section className="gflow-review-section">
            <h4>{g.sizeFit} <span className="req">*</span></h4>
            <div className="filter-grid review-contact-grid">
              {cat === "ring" && (
                <label className="field"><span>{t.ringSize}</span>
                  <LuxurySelect
                    value={RING_SIZE_OPTIONS.includes(form.conditional.ringSize || "") ? form.conditional.ringSize : ""}
                    ariaLabel={t.ringSize}
                    placeholder={t.ringSizeSelect}
                    options={RING_SIZE_OPTIONS.map((size) => ({ value: size, label: `US ${size}` }))}
                    onChange={(value) => setC({ ringSize: value })}
                  />
                </label>
              )}
              {cat === "bangle" && (
                <label className="field"><span>{t.wristSize}</span>
                  <LuxurySelect
                    value={BRACELET_WRIST_OPTIONS.includes(form.conditional.wristSize || "") ? form.conditional.wristSize : ""}
                    ariaLabel={t.wristSize}
                    placeholder={t.wristSizeSelect}
                    options={intakeOption(BRACELET_WRIST_OPTIONS, optionLabels.braceletWrist, optionDescriptions.braceletWrist)}
                    onChange={(value) => setC({ wristSize: value })}
                  />
                </label>
              )}
              {cat === "earrings" && (
                <label className="field"><span>{t.earringDetails}</span>
                  <LuxurySelect
                    value={EARRING_PAIRING_OPTIONS.includes(form.conditional.earringDetails || "") ? form.conditional.earringDetails : ""}
                    ariaLabel={t.earringDetails}
                    placeholder={t.earringDetailsSelect}
                    options={intakeOption(EARRING_PAIRING_OPTIONS, optionLabels.earringPairing, optionDescriptions.earringPairing)}
                    onChange={(value) => setC({ earringDetails: value })}
                  />
                </label>
              )}
              {cat === "necklace" && (
                <>
                  <label className="field"><span>{t.chainStyle}</span>
                    <LuxurySelect
                      value={CHAIN_STYLE_OPTIONS.includes(form.conditional.chainStyle || "") ? form.conditional.chainStyle : ""}
                      ariaLabel={t.chainStyle}
                      placeholder={t.chainStyleSelect}
                      options={intakeOption(CHAIN_STYLE_OPTIONS, optionLabels.chainStyles, optionDescriptions.chainStyles)}
                      onChange={(value) => setC({ chainStyle: value })}
                    />
                  </label>
                  <label className="field"><span>{t.chainLength}</span>
                    <LuxurySelect
                      value={form.conditional.chainLength || "18in"}
                      ariaLabel={t.chainLength}
                      options={CHAIN_LENGTHS.map((l) => ({ value: l, label: chainLengthLabel(l) }))}
                      onChange={(value) => setC({ chainLength: value })}
                    />
                  </label>
                  <label className="field"><span>{t.clasp}</span>
                    <LuxurySelect
                      value={CLASP_OPTIONS.includes(form.conditional.clasp || "") ? form.conditional.clasp : ""}
                      ariaLabel={t.clasp}
                      placeholder={t.claspSelect}
                      options={intakeOption(CLASP_OPTIONS, optionLabels.clasps, optionDescriptions.clasps)}
                      onChange={(value) => setC({ clasp: value })}
                    />
                  </label>
                </>
              )}
              <label className="field"><span>{t.requiredDate}</span>
                <LuxuryDatePicker
                  value={form.requiredDate}
                  ariaLabel={t.requiredDate}
                  onChange={(value) => setF({ requiredDate: value })}
                />
              </label>
            </div>
          </section>

          {/* 센터스톤 퀄리티 — 추천 기본값 + 인라인 조정 */}
          {solitaire && (
            <section className="gflow-review-section">
              <h4>{g.quality}</h4>
              <div className="gflow-quality-row">
                <strong>{form.stonePrefs.color} · {form.stonePrefs.clarity} · {form.stonePrefs.growth} · IGI</strong>
                <button className="button secondary small" type="button" onClick={() => setAdjustQuality((v) => !v)}>{g.adjust}</button>
              </div>
              {adjustQuality && (
                <>
                  <ScalePicker ariaLabel={t.color} options={colorOptions} value={form.stonePrefs.color} onSelect={(value) => setS({ color: value })} />
                  <ScalePicker ariaLabel={t.clarity} options={clarityOptions} value={form.stonePrefs.clarity} onSelect={(value) => setS({ clarity: value })} />
                </>
              )}
              <p className="form-hint" style={{ margin: 0 }}>{g.qualityDefaultNote}</p>
            </section>
          )}

          {!user && (
            <section className="gflow-review-section">
              <h4>{t.contactTitle} <span className="req">*</span></h4>
              <div className="filter-grid review-contact-grid">
                <label className="field"><span>{t.name}</span><input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></label>
                <label className="field"><span>{t.contact}</span><input value={form.contact} onChange={(e) => setF({ contact: e.target.value })} required /></label>
              </div>
            </section>
          )}

          <QuoteCompare form={form} />

          <div className="panel" style={{ background: "var(--bg-2)" }}>
            {t.termsBlocks.map((b, i) => <p key={i} className="form-hint" style={{ margin: "4px 0" }}>· {b}</p>)}
          </div>
          <label className="field" style={{ flexDirection: "row", display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={form.termsAccepted} onChange={(e) => setF({ termsAccepted: e.target.checked })} style={{ width: "auto" }} />
            <span>{t.terms}</span>
          </label>
          <p className="form-hint">{p.ftc}</p>
          {stepError && <p className="form-error">{stepError}</p>}
          <button className="button primary gflow-submit" type="button" disabled={!form.termsAccepted} onClick={submit}>{t.submit}</button>
        </div>
      ))}

      <p style={{ marginTop: 16 }}><Link className="text-link" to="/designs">{t.backToDesigns} →</Link></p>
    </div>
  );
}
