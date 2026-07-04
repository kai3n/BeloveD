import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import {
  CHAIN_LENGTHS, CHAIN_STYLE_OPTIONS, CLASP_OPTIONS,
  EARRING_PAIRING_OPTIONS, BRACELET_WRIST_OPTIONS, OPS_CATEGORIES,
} from "../lib/ops.js";
import { createIntake, getDiamond, listOpsStyles } from "../lib/store.js";
import { apiFetch } from "../lib/api.js";
import {
  MAX_REFERENCE_MEDIA, RING_SIZE_OPTIONS, buildIntakePayload, conditionalComplete,
  accountDisplayName, hasContactDetails, sanitizeReferenceMedia, submissionContact,
} from "../lib/intakePayload.js";
import { useDBVersion } from "../lib/useDB.js";
import { pickI18n, useLocale } from "../i18n.jsx";
import { LuxuryDatePicker, LuxurySelect, MediaPicker, MediaThumb } from "../components/ui.jsx";
import StoneEduPanel from "../components/StoneEducation.jsx";
import { track } from "../lib/track.js";
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
  // 명시 값 우선 — 시드는 seed.js의 STYLE_PRODUCT_LINE, 새 스타일은 Style Library에서 지정.
  if (style.productLine === "solitaire" || style.productLine === "multi") return style.productLine;
  // 폴백 키워드 추론: "센터스톤이 없는" 제품 유형만 multi로.
  // halo/three-stone은 센터스톤이 있는 약혼반지라 여기 넣으면 다이아 스텝이 사라진다 — 제외.
  const text = [
    style.id,
    style.category,
    style.name?.en,
    style.name?.ko,
    style.name?.zh,
    style.name?.es,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/(band|eternity|tennis|bracelet|bangle|stud|earring|hoop|huggie|pav[eé]|multi|station|cluster|cross)/i.test(text)) {
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

// 질문 순서 — 멀티스톤 디자인이면 셰입/캐럿을 건너뛰고, 비회원은 리뷰 직전에 연락처를 받는다
function screenList(productLine, isGuest) {
  const list = ["category", "design", "metal"];
  if (productLine === "solitaire") list.push("shape", "carat");
  list.push("inspiration");
  if (isGuest) list.push("contact");
  list.push("review");
  return list;
}

export default function IntakeForm() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.intake;
  const g = t.gflow;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    name: accountDisplayName(user), contact: user?.email || "", productLine: inferProductLineFromStyle(styleFromParam), category: initialCategory,
    subcategory: initialSubcategory,
    styleId: styleParam, metal: "18kw",
    conditional: categoryDefaults(initialCategory),
    stonePrefs: {
      shape: refDiamond?.shape || "round", carat: String(refDiamond?.carat || "1.5"),
      color: refDiamond?.color || "E", clarity: refDiamond?.clarity || "VS1",
      growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "",
    },
    multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
    inspirationNotes: "",
    engraving: "",
    requiredDate: "", termsAccepted: false,
  };
  // 인테이크 진입 이벤트 — 스타일 프리필 여부 포함 (마운트 1회)
  useEffect(() => {
    track("intake_start", { path: "/custom/new", meta: styleParam ? { styleId: styleParam } : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // 항상 첫 질문부터 시작 — URL 프리필(?style=/?category=)은 답을 미리 골라둘 뿐 화면은 건너뛰지 않는다.
  // (화면 건너뛰기·드래프트 자동 점프 둘 다 "중간부터 시작"처럼 보여 혼란을 준다)
  const [screen, setScreen] = useState("category");
  // "이게 뭐예요?" 도움말이 열려 있으면 비교 모드 — 선택해도 자동 진행하지 않는다
  const [shapeEduOpen, setShapeEduOpen] = useState(false);
  // 드래프트 이어하기는 배너로 명시적 선택 (답변은 이미 프리필되어 있어 새로 시작해도 빠르다)
  const hasEntryParams = Boolean(styleFromParam || categoryFromParam || refDiamond);
  const [resumeTarget, setResumeTarget] = useState(() => (
    !hasEntryParams && draft?.screen && draft.screen !== "category" ? draft.screen : ""
  ));
  const [done, setDone] = useState(null);
  const [refs, setRefs] = useState(() => sanitizeReferenceMedia(draft?.refs));
  const [stepError, setStepError] = useState("");
  const [termsError, setTermsError] = useState(false); // 제출 시 약관 미동의 — 체크박스 줄 빨간 강조
  const [adjustQuality, setAdjustQuality] = useState(false);

  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setC = (patch) => setForm((f) => ({ ...f, conditional: { ...f.conditional, ...patch } }));
  const setS = (patch) => setForm((f) => ({ ...f, stonePrefs: { ...f.stonePrefs, ...patch } }));

  const solitaire = form.productLine === "solitaire";
  const isGuest = !user;
  // 로그인 상태라도 계정에 제대로 된 이름이 없으면(이메일형) 이름만 받는 스텝을 보여준다
  const needsContact = isGuest || !accountDisplayName(user);
  const screens = screenList(form.productLine, needsContact);
  // 로그인 등으로 질문 목록이 바뀌어 현재 화면이 사라지면 리뷰로 폴백
  const activeScreen = screens.includes(screen) ? screen : "review";
  const screenIdx = Math.max(0, screens.indexOf(activeScreen));
  const guestContactReady = isGuest
    ? hasContactDetails(submissionContact(form, user))
    : Boolean(form.name.trim());
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

  // 같은 라우트 재진입(nav의 START CUSTOM 재클릭 등)은 리마운트가 없어 화면이 유지된다 → 항상 1번 질문으로 리셋
  const locationKeyRef = useRef(location.key);
  useEffect(() => {
    if (locationKeyRef.current === location.key) return;
    locationKeyRef.current = location.key;
    setScreen("category");
    setResumeTarget("");
    setStepError("");
  }, [location.key]);

  // 드래프트 이어하기 / 새로 시작
  function resumeDraft() {
    setScreen(screens.includes(resumeTarget) ? resumeTarget : "review");
    setResumeTarget("");
  }
  function startFresh() {
    window.localStorage.removeItem(DRAFT_KEY);
    setForm(baseForm);
    setRefs([]);
    setResumeTarget("");
    setScreen("category");
  }

  // 이미지 답변 탭 → 짧은 선택 피드백 후 자동 진행
  function selectAndAdvance(patch, currentName) {
    // 위저드 옵션 선택 이벤트 — 어떤 단계에서 무엇을 골랐는지 (PII 없는 선택값만)
    track("option_select", {
      path: "/custom/new",
      entityType: form.styleId ? "style" : undefined,
      entityId: form.styleId || undefined,
      meta: { step: currentName, ...patch },
    });
    setResumeTarget("");
    setF(patch);
    const nextLine = patch.productLine || form.productLine;
    const list = screenList(nextLine, needsContact);
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
    // 무엇이 빠졌는지 짚어주고 해당 위치로 데려간다 — 하단의 범용 에러만으로는
    // 사용자가 빠진 필드를 찾아 헤매게 된다.
    if (!conditionalComplete(form.category, form.conditional)) {
      setStepError(`${t.requiredError} — ${g.sizeFit}`);
      document.getElementById("gflow-size-fit")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!hasContactDetails(contactDetails)) {
      setStepError(t.requiredError);
      setScreen("contact");
      return;
    }
    if (!form.termsAccepted) {
      setTermsError(true);
      setStepError(t.termsError);
      document.getElementById("gflow-terms")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const payload = buildIntakePayload(form, refs, user);
    const { order } = createIntake(payload, user?.id || null);
    track("intake_submit", { path: "/custom/new", meta: { orderId: order.id } });

    // 실서버 새도우 캡처 — Postgres에 인테이크+주문을 기록하고 접수 메일(고객 언어)을 보낸다.
    // 포털 UI는 아직 로컬 스토어 기준이라 실패해도 흐름은 그대로 (정적 데모 포함).
    // 키는 제출마다 새로 — 로컬 주문번호(DM-)는 브라우저마다 같은 값에서 시작해
    // 서버의 idempotency_keys와 충돌하면 다른 고객의 접수가 조용히 유실된다.
    apiFetch("/intakes", {
      method: "POST",
      headers: { "Idempotency-Key": `${order.id}-${crypto.randomUUID()}` },
      body: {
        ...payload,
        email: contactDetails.contact,
        name: contactDetails.name,
        locale,
        // base64/blob 프리뷰는 제외 — R2 publicUrl만 서버로 (jsonb·바디 한도 보호)
        referenceMedia: refs.filter((m) => /^https?:\/\//.test(m.src || "")).slice(0, 5),
      },
    })
      // 실서버 주문번호(BD-)가 진짜 — 접수 화면·포털 링크를 서버 코드로 승격
      .then((resp) => {
        if (resp?.orderCode) setDone((d) => (d ? { ...d, serverCode: resp.orderCode } : d));
      })
      .catch(() => {});

    window.localStorage.removeItem(DRAFT_KEY);
    setDone(order);
  }

  if (done) {
    // 서버 캡처 성공 시 BD- 주문번호가 진실 — 조회 코드는 로컬 폴백(DM-) 경로에서만 의미가 있다
    const serverBacked = Boolean(done.serverCode);
    return (
      <div className="page page-narrow">
        <h1 className="page-title">{t.doneTitle}</h1>
        <div className="panel form-stack">
          <div className="summary-grid" style={{ gridTemplateColumns: serverBacked ? "1fr" : "1fr 1fr" }}>
            <div className="summary-card"><div className="num" style={{ fontSize: 24 }}>{done.serverCode || done.id}</div><div className="lbl">{t.orderIdLbl}</div></div>
            {!serverBacked && (
              <div className="summary-card"><div className="num" style={{ fontSize: 24 }}>{done.queryCode}</div><div className="lbl">{t.codeLbl}</div></div>
            )}
          </div>
          <p className="form-hint">{serverBacked ? t.doneNoteServer : t.doneNote}</p>
          <button
            className="button primary"
            onClick={() => navigate(serverBacked ? `/orders/${done.serverCode}` : `/orders/${done.id}?code=${done.queryCode}`)}
          >
            {t.goPortal}
          </button>
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
    shape: g.stoneCard, carat: g.stoneCard, inspiration: g.inspirationCard, contact: t.contactTitle, review: t.reviewStep,
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
      {resumeTarget && (
        <div className="gflow-resume" role="status">
          <span>{g.resumeTitle}</span>
          <div className="gflow-resume-actions">
            <button className="button primary small" type="button" onClick={resumeDraft}>{g.resumeCta}</button>
            <button className="button secondary small" type="button" onClick={startFresh}>{g.startOver}</button>
          </div>
        </div>
      )}
      {activeScreen === "category" && stepShell(g.qCategory, null, (
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

      {activeScreen === "design" && stepShell(g.qDesign, g.designHint, (
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

      {activeScreen === "metal" && stepShell(g.qMetal, null, (
        <MetalSwatches
          value={form.metal}
          labels={p.opsMetals}
          onSelect={(value) => selectAndAdvance({ metal: value }, "metal")}
        />
      ))}

      {activeScreen === "shape" && stepShell(g.qShape, null, (
        <>
          <ShapeTiles
            value={form.stonePrefs.shape}
            labels={p.shapes}
            onSelect={(value) => {
              setS({ shape: value });
              // 도움말을 읽는 중에는 선택이 곧장 다음 화면으로 튕기지 않는다 —
              // 셰입을 바꿔가며 아래 가이드를 비교하고, 준비되면 "다음"을 누른다
              if (!shapeEduOpen) window.setTimeout(goNext, 170);
            }}
          />
          {shapeEduOpen && (
            <button className="button primary" type="button" onClick={() => { setShapeEduOpen(false); goNext(); }}>{t.next}</button>
          )}
          <details className="gflow-edu-toggle" onToggle={(e) => setShapeEduOpen(e.currentTarget.open)}>
            <summary>{g.whatsThis}</summary>
            <div className="gflow-edu-body"><StoneEduPanel field="shape" prefs={form.stonePrefs} /></div>
          </details>
        </>
      ))}

      {activeScreen === "carat" && stepShell(g.qCarat, g.caratHint, (
        <>
          <CaratSlider value={form.stonePrefs.carat} shape={form.stonePrefs.shape} onChange={(value) => setS({ carat: value })} />
          <button className="button primary" type="button" onClick={goNext}>{t.next}</button>
          <details className="gflow-edu-toggle">
            <summary>{g.whatsThis}</summary>
            <div className="gflow-edu-body"><StoneEduPanel field="carat" prefs={form.stonePrefs} /></div>
          </details>
        </>
      ))}

      {activeScreen === "inspiration" && stepShell(g.qInspiration, g.inspirationHint, (
        <div style={{ width: "min(100%, 640px)", display: "grid", gap: 16 }}>
          <MediaPicker value={refs} maxItems={MAX_REFERENCE_MEDIA} showSamples={false} previewMode="list" onChange={(v) => {
            setRefs(sanitizeReferenceMedia(v));
          }} />
          {/* 사진만으로 다 담기지 않는 요청 — 텍스트로도 받는다 (buildIntakePayload가 form 전체를 실어 서버 formPayload로 전달) */}
          <label className="field"><span>{g.inspirationNotesLbl}</span>
            <textarea
              rows={3}
              value={form.inspirationNotes}
              placeholder={g.inspirationNotesPh}
              onChange={(e) => setForm((current) => ({ ...current, inspirationNotes: e.target.value }))}
            />
          </label>
          <button className="button primary" type="button" onClick={goNext}>{t.next}</button>
        </div>
      ), { onSkip: goNext })}

      {/* 비회원: 리뷰 직전 연락처 — "확정 제안이 도착할 곳"으로 프레이밍해 이탈을 줄인다 */}
      {activeScreen === "contact" && stepShell(isGuest ? g.qContact : g.qContactName, g.contactHint, (
        <div className="gflow-contact">
          <label className="field"><span>{t.name} <span className="req">*</span></span>
            <input
              value={form.name}
              autoComplete="name"
              onChange={(e) => setF({ name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && guestContactReady) goNext(); }}
            />
          </label>
          {isGuest ? (
            <label className="field"><span>{t.contact} <span className="req">*</span></span>
              <input
                value={form.contact}
                autoComplete="email"
                placeholder="you@email.com"
                onChange={(e) => setF({ contact: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && guestContactReady) goNext(); }}
              />
            </label>
          ) : (
            // 로그인 고객: 제안이 도착할 이메일은 계정에서 — 수정 불가로 보여주기만
            <label className="field"><span>{t.contact}</span>
              <input value={user.email} readOnly />
            </label>
          )}
          <button className="button primary" type="button" disabled={!guestContactReady} onClick={goNext}>{t.next}</button>
        </div>
      ))}

      {activeScreen === "review" && stepShell(g.qReview, g.reviewHint, (
        <div className="gflow-review">
          <div className="gflow-review-cards">
            <div className="gflow-review-card">
              <div className="rc-media">
                {styleMedia(selectedStyle)
                  ? <MediaThumb media={styleMedia(selectedStyle)} alt={selectedStyleName} ratio="1 / 1" />
                  : <MediaThumb media={categoryOptions.find((c) => c.value === cat)?.media} alt={p.opsCategories[cat]} ratio="1 / 1" />}
              </div>
              <div className="rc-body">
                <span>{g.pieceCard}</span>
                <strong>{selectedStyleName}</strong>
                <small>{p.opsCategories[cat]} · {p.opsMetals[form.metal]}</small>
              </div>
            </div>
            <div className="gflow-review-card">
              <div className="rc-media">
                {/* 스톤 카드는 항상 다이아 비주얼 — 제품 사진 폴백은 PIECE 카드와 중복돼 보인다 */}
                <ShapeSilhouette shape={solitaire ? form.stonePrefs.shape : "round"} />
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
                  ? <MediaThumb media={refs[0]} alt={g.inspirationCard} ratio="1 / 1" fit="cover" />
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
          <section className="gflow-review-section" id="gflow-size-fit">
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
              <label className="field"><span>{g.engravingLbl}</span>
                <input
                  value={form.engraving}
                  maxLength={30}
                  placeholder={g.engravingPh}
                  onChange={(e) => setF({ engraving: e.target.value })}
                />
                {/* 힌트는 span 금지 — .review-contact-grid .field > span이 라벨 스타일을 입힌다 */}
                <small className="form-hint" style={{ margin: 0 }}>{g.engravingHints[cat]}</small>
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

          {needsContact && (
            <section className="gflow-review-section">
              <h4>{t.contactTitle}</h4>
              <div className="gflow-quality-row">
                <strong>{form.name} · {form.contact}</strong>
                <button className="button secondary small" type="button" onClick={() => setScreen("contact")}>{g.contactEdit}</button>
              </div>
            </section>
          )}

          <QuoteCompare form={form} />

          <div className="panel" style={{ background: "var(--bg-2)" }}>
            {t.termsBlocks.map((b, i) => <p key={i} className="form-hint" style={{ margin: "4px 0" }}>· {b}</p>)}
          </div>
          <label id="gflow-terms" className={`field gflow-terms${termsError && !form.termsAccepted ? " is-invalid" : ""}`} style={{ flexDirection: "row", display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox" checked={form.termsAccepted} style={{ width: "auto" }}
              onChange={(e) => {
                setF({ termsAccepted: e.target.checked });
                if (e.target.checked) { setTermsError(false); setStepError(""); }
              }}
            />
            <span>{t.terms}</span>
          </label>
          <p className="form-hint">{p.ftc}</p>
          {stepError && <p className="form-error">{stepError}</p>}
          <button className="button primary gflow-submit" type="button" onClick={submit}>{t.submit}</button>
        </div>
      ))}

      <p style={{ marginTop: 16 }}><Link className="text-link" to="/designs">{t.backToDesigns} →</Link></p>
    </div>
  );
}
