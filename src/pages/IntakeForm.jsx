import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import {
  CHAIN_LENGTHS, CHAIN_STYLE_OPTIONS, CLASP_OPTIONS,
  EARRING_PAIRING_OPTIONS, BRACELET_WRIST_OPTIONS, OPS_CATEGORIES,
} from "../lib/ops.js";
import { createIntake, findCoupon, getDiamond, listOpsStyles } from "../lib/store.js";
import { apiFetch } from "../lib/api.js";
import {
  MAX_REFERENCE_MEDIA, RING_SIZE_OPTIONS, buildIntakePayload, conditionalComplete,
  accountDisplayName, hasContactDetails, isValidEmail, referenceMediaReady,
  sanitizeReferenceMedia, submissionContact,
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
import { normalizeCouponCode } from "../lib/coupons.js";
import { WITH_BACKOFFICE } from "../lib/flags.js";

const DRAFT_KEY = "lumina-intake-draft";
const LIVE_SERVER_INTAKE = WITH_BACKOFFICE;

const INTAKE_FLOW_COPY = {
  en: {
    emailHint: "A valid email is required to receive and open your private order portal. Phone-only contact is not supported.",
    emailError: "Enter a valid email address so we can create your order portal.",
    mediaError: "Finish or retry the reference upload before continuing. You can also remove the attachment.",
    submitting: "Submitting…",
    submitError: "We couldn't create your order. Your answers are still here — check your connection and retry.",
    rateError: "Too many submission attempts. Your answers are saved — wait a minute, then retry.",
  },
  ko: {
    emailHint: "비공개 주문 포털을 받고 열려면 유효한 이메일이 필요합니다. 전화번호만으로는 접수할 수 없습니다.",
    emailError: "주문 포털을 만들 수 있도록 유효한 이메일 주소를 입력해 주세요.",
    mediaError: "계속하기 전에 레퍼런스 업로드를 완료하거나 다시 시도해 주세요. 첨부를 삭제해도 됩니다.",
    submitting: "접수 중…",
    submitError: "주문을 만들지 못했습니다. 입력 내용은 그대로 있으니 연결 상태를 확인한 뒤 다시 시도해 주세요.",
    rateError: "접수 시도가 너무 많습니다. 입력 내용은 저장되어 있으니 1분 후 다시 시도해 주세요.",
  },
  zh: {
    emailHint: "需要有效邮箱才能接收并打开私人订单页面。目前不支持仅填写电话号码。",
    emailError: "请输入有效邮箱，以便我们创建订单页面。",
    mediaError: "请先完成或重试参考文件上传，或删除该附件，再继续。",
    submitting: "正在提交…",
    submitError: "订单创建失败。你的填写内容仍在，请检查网络后重试。",
    rateError: "提交次数过多。内容已保存，请一分钟后重试。",
  },
  es: {
    emailHint: "Se requiere un correo válido para recibir y abrir tu portal privado. No se admite solo un teléfono.",
    emailError: "Introduce un correo válido para que podamos crear tu portal del pedido.",
    mediaError: "Completa o reintenta la carga de referencias antes de continuar, o elimina el archivo.",
    submitting: "Enviando…",
    submitError: "No pudimos crear el pedido. Tus respuestas siguen aquí; revisa la conexión y reintenta.",
    rateError: "Demasiados intentos. Tus respuestas están guardadas; espera un minuto y reintenta.",
  },
};

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

export function confirmationScrollBehavior(matchMedia) {
  try {
    return matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
  } catch {
    return "auto";
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
    // 미공개/삭제된 스타일 코드가 URL로 들어와도 유령 styleId를 만들지 않는다
    styleId: styleFromParam ? styleParam : "", metal: "18kw",
    conditional: categoryDefaults(initialCategory),
    stonePrefs: {
      shape: refDiamond?.shape || "round", carat: String(refDiamond?.carat || "1.5"),
      color: refDiamond?.color || "E", clarity: refDiamond?.clarity || "VS1",
      growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "",
    },
    multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
    inspirationNotes: "",
    engraving: "",
    couponCode: "",
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
      styleId: (styleFromParam ? styleParam : "") || draft.form.styleId || baseForm.styleId,
      conditional: { ...baseForm.conditional, ...draft.form.conditional },
      stonePrefs: { ...baseForm.stonePrefs, ...draft.form.stonePrefs },
      multiSpec: { ...baseForm.multiSpec, ...draft.form.multiSpec },
      termsAccepted: false,
    };
  });
  // 딥링크 진입 — 스타일이 정해져 있으면(상세 페이지 "Start custom order") 피스·디자인 질문은
  // 이미 답이 있으므로 메탈부터, 카테고리만 알면(카탈로그 CTA) 디자인부터 시작한다.
  // 건너뛴 답은 상단 칩으로 보여주고 "디자인 변경"으로 언제든 되돌아갈 수 있다.
  const entryScreen = styleFromParam ? "metal" : categoryFromParam ? "design" : "category";
  const [screen, setScreen] = useState(entryScreen);
  // "이게 뭐예요?" 도움말이 열려 있으면 비교 모드 — 선택해도 자동 진행하지 않는다
  const [shapeEduOpen, setShapeEduOpen] = useState(false);
  // 드래프트 이어하기는 배너로 명시적 선택 (답변은 이미 프리필되어 있어 새로 시작해도 빠르다)
  const hasEntryParams = Boolean(styleFromParam || categoryFromParam || refDiamond);
  const [resumeTarget, setResumeTarget] = useState(() => (
    !hasEntryParams && draft?.screen && draft.screen !== "category" ? draft.screen : ""
  ));
  // 첫 질문은 명시적으로 고르기 전까지 무선택으로 보인다 — 드래프트 복원값이나 기본값(ring)이
  // 테두리로 미리 켜져 있으면 버그처럼 읽힌다. ?style=/?category= 진입은 명시적 선택으로 취급.
  const [categoryPicked, setCategoryPicked] = useState(() => Boolean(styleFromParam || categoryFromParam));
  const [done, setDone] = useState(null);
  const [refs, setRefs] = useState(() => sanitizeReferenceMedia(draft?.refs));
  const [stepError, setStepError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [termsError, setTermsError] = useState(false); // 제출 시 약관 미동의 — 체크박스 줄 빨간 강조
  const [adjustQuality, setAdjustQuality] = useState(false);
  const draftTimerRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const draftFinalizedRef = useRef(false);
  const idempotencyKeyRef = useRef("");
  const errorRef = useRef(null);
  const doneHeadingRef = useRef(null);

  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setC = (patch) => setForm((f) => ({ ...f, conditional: { ...f.conditional, ...patch } }));
  const setS = (patch) => setForm((f) => ({ ...f, stonePrefs: { ...f.stonePrefs, ...patch } }));

  const solitaire = form.productLine === "solitaire";
  const isGuest = !user;
  const flowCopy = INTAKE_FLOW_COPY[locale] || INTAKE_FLOW_COPY.en;
  const accountEmailLocked = !isGuest && isValidEmail(user?.email);
  // 이름이 없거나 레거시 계정 이메일이 유효하지 않으면 수정 가능한 연락처 스텝을 보여준다.
  const needsContact = isGuest || !accountDisplayName(user) || !accountEmailLocked;
  const screens = screenList(form.productLine, needsContact);
  // 로그인 등으로 질문 목록이 바뀌어 현재 화면이 사라지면 리뷰로 폴백
  const activeScreen = screens.includes(screen) ? screen : "review";
  const screenIdx = Math.max(0, screens.indexOf(activeScreen));
  const contactDetails = submissionContact(form, user);
  const contactReady = hasContactDetails(contactDetails);
  const mediaReady = referenceMediaReady(refs, { remoteRequired: LIVE_SERVER_INTAKE });
  const mediaBlocked = mediaBusy || Boolean(mediaError) || !mediaReady;
  const selectedStyle = styles.find((st) => st.id === form.styleId) || null;
  const activeCoupon = findCoupon(form.couponCode);
  const selectedStyleName = selectedStyle ? pickI18n(selectedStyle.name, locale) : g.consultPiece;
  // 디자인 스텝 이후 스타일 미정 = "아직 모르겠어요"(오픈 브리프) 선택 — 상담 진행 신호를 띄운다
  const consultMode = !form.styleId && screenIdx > screens.indexOf("design");
  const stylesForCategory = styles.filter((st) => st.category === form.category);
  const optionLabels = t.optionLabels || {};
  const optionDescriptions = t.optionDescriptions || {};

  function cancelDraftTimer() {
    if (draftTimerRef.current != null) {
      window.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
  }

  function cancelAdvanceTimer() {
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function scheduleAdvance(callback) {
    cancelAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      callback();
    }, 170);
  }

  function finalizeDraft() {
    draftFinalizedRef.current = true;
    cancelDraftTimer();
    window.localStorage.removeItem(DRAFT_KEY);
  }

  useEffect(() => {
    cancelDraftTimer();
    if (draftFinalizedRef.current || done || isSubmitting) return undefined;
    draftTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        form: { ...form, termsAccepted: false },
        refs,
        screen,
        savedAt: new Date().toISOString(),
      }));
      draftTimerRef.current = null;
    }, 450);
    return cancelDraftTimer;
  }, [done, form, isSubmitting, refs, screen]);

  useEffect(() => cancelAdvanceTimer, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen]);

  useEffect(() => {
    if (!stepError) return undefined;
    const frame = window.requestAnimationFrame(() => errorRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeScreen, stepError]);

  // 접수 완료 화면 — 리뷰 하단의 이전 스크롤 위치가 짧아진 완료 페이지에
  // 클램프되지 않도록 제목을 포커스한 뒤 명시적으로 맨 위를 복원한다.
  useEffect(() => {
    if (!done) return undefined;
    cancelDraftTimer();
    const frame = window.requestAnimationFrame(() => {
      doneHeadingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: confirmationScrollBehavior(window.matchMedia?.bind(window)) });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [done]);

  // 같은 라우트 재진입(nav의 START CUSTOM 재클릭 등)은 리마운트가 없어 화면이 유지된다 → 진입 화면으로 리셋
  const locationKeyRef = useRef(location.key);
  useEffect(() => {
    if (locationKeyRef.current === location.key) return;
    cancelAdvanceTimer();
    locationKeyRef.current = location.key;
    setScreen(entryScreen);
    setResumeTarget("");
    setStepError("");
  }, [location.key]);

  // 드래프트 이어하기 / 새로 시작
  function resumeDraft() {
    cancelAdvanceTimer();
    setStepError("");
    setScreen(screens.includes(resumeTarget) ? resumeTarget : "review");
    setResumeTarget("");
    setCategoryPicked(true); // 이어하기 = 드래프트 답변을 명시적으로 승인 → 뒤로 와도 선택 표시
  }
  function startFresh() {
    draftFinalizedRef.current = false;
    cancelDraftTimer();
    cancelAdvanceTimer();
    window.localStorage.removeItem(DRAFT_KEY);
    setForm(baseForm);
    setRefs([]);
    setResumeTarget("");
    setCategoryPicked(false);
    setStepError("");
    setMediaError("");
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
    setStepError("");
    setF(patch);
    const nextLine = patch.productLine || form.productLine;
    const list = screenList(nextLine, needsContact);
    const next = list[list.indexOf(currentName) + 1] || "review";
    scheduleAdvance(() => setScreen(next));
  }
  function goBack() {
    cancelAdvanceTimer();
    setStepError("");
    setScreen(screens[Math.max(screenIdx - 1, 0)]);
  }
  function goNext() {
    cancelAdvanceTimer();
    setStepError("");
    setScreen(screens[Math.min(screenIdx + 1, screens.length - 1)]);
  }

  async function submit() {
    if (isSubmitting) return;
    // 무엇이 빠졌는지 짚어주고 해당 위치로 데려간다 — 하단의 범용 에러만으로는
    // 사용자가 빠진 필드를 찾아 헤매게 된다.
    if (!conditionalComplete(form.category, form.conditional)) {
      setStepError(`${t.requiredError} — ${g.sizeFit}`);
      document.getElementById("gflow-size-fit")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!contactReady) {
      setStepError(contactDetails.name ? flowCopy.emailError : t.requiredError);
      setScreen("contact");
      return;
    }
    if (mediaBlocked) {
      setStepError(flowCopy.mediaError);
      setScreen("inspiration");
      return;
    }
    if (!form.termsAccepted) {
      setTermsError(true);
      setStepError(t.termsError);
      document.getElementById("gflow-terms")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStepError("");
    cancelDraftTimer();
    setIsSubmitting(true);

    try {
      const payload = buildIntakePayload(form, refs, user);

      // The static showcase intentionally has no API and keeps its local DM-
      // walkthrough. Every live/backoffice build must receive a real BD- code
      // before showing completion or deleting the recoverable draft.
      if (!LIVE_SERVER_INTAKE) {
        const { order } = createIntake(payload, user?.id || null);
        finalizeDraft();
        track("intake_submit", { path: "/custom/new", meta: { orderId: order.id } });
        setDone(order);
        return;
      }

      if (!idempotencyKeyRef.current) {
        const randomPart = globalThis.crypto?.randomUUID?.()
          || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        idempotencyKeyRef.current = `intake-${randomPart}`;
      }
      const resp = await apiFetch("/intakes", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKeyRef.current },
        body: {
          ...payload,
          email: contactDetails.contact,
          name: contactDetails.name,
          locale,
          referenceMedia: payload.referenceMedia,
        },
      });
      if (!resp?.orderCode || !/^BD-/i.test(resp.orderCode)) {
        throw new Error("INVALID_INTAKE_RESPONSE");
      }

      finalizeDraft();
      track("intake_submit", { path: "/custom/new", meta: { orderId: resp.orderCode } });
      setDone({ id: resp.orderCode, serverCode: resp.orderCode, styleId: payload.styleId || null });
    } catch (error) {
      // Preserve every answer and attachment. isSubmitting=false below restarts
      // autosave, while the same idempotency key makes the visible retry safe.
      setStepError(error?.code === "RATE_LIMITED" ? flowCopy.rateError : flowCopy.submitError);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    // 서버 캡처 성공 시 BD- 주문번호가 진실 — 조회 코드는 로컬 폴백(DM-) 경로에서만 의미가 있다
    const serverBacked = Boolean(done.serverCode);
    return (
      <div className="page page-narrow">
        <h1 ref={doneHeadingRef} className="page-title" tabIndex={-1}>{t.doneTitle}</h1>
        <div className="panel form-stack">
          <div className="summary-grid" style={{ gridTemplateColumns: serverBacked ? "1fr" : "1fr 1fr" }}>
            <div className="summary-card"><div className="num" style={{ fontSize: 24 }}>{done.serverCode || done.id}</div><div className="lbl">{t.orderIdLbl}</div></div>
            {!serverBacked && (
              <div className="summary-card"><div className="num" style={{ fontSize: 24 }}>{done.queryCode}</div><div className="lbl">{t.codeLbl}</div></div>
            )}
          </div>
          <p className="form-hint">{serverBacked ? t.doneNoteServer : t.doneNote}</p>
          {/* 오픈 브리프(스타일 미정) — 상담이 이제 시작된다는 걸 접수 화면에서 못박는다 */}
          {!done.styleId && <p className="form-hint">✦ {g.consultDoneNote}</p>}
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
      skipDisabled={Boolean(extra.skipDisabled)}
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
      {consultMode && <p className="gflow-consult-note" role="status">✦ {g.consultNote}</p>}
      {stepError && (
        <p ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{stepError}</p>
      )}
      {/* 딥링크로 피스·디자인을 건너뛴 뒤에도 무엇이 선택돼 있는지 보이게 — 리뷰/디자인 화면은 자체 표시가 있어 제외 */}
      {selectedStyle && !["category", "design", "review"].includes(activeScreen) && (
        <div className="gflow-style-chip" role="status">
          <span className="gflow-style-chip-lbl">{t.selectedDesign}</span>
          <strong>{selectedStyleName}</strong>
          <span className="gflow-style-chip-cat">{p.opsCategories[form.category]}</span>
          <button type="button" className="gflow-style-chip-change" onClick={() => setScreen("design")}>{g.changeDesign}</button>
        </div>
      )}
      {activeScreen === "category" && stepShell(g.qCategory, null, (
        <ImageOptionGrid
          columns={4}
          ariaLabel={g.qCategory}
          options={categoryOptions}
          value={categoryPicked ? form.category : ""}
          onSelect={(value) => {
            setCategoryPicked(true);
            selectAndAdvance(
              // 같은 피스 재선택이면 이미 고른 디자인·사이즈 답변을 버리지 않는다
              value === form.category
                ? { category: value }
                : {
                  category: value,
                  subcategory: defaultSubcategoryFor(value),
                  conditional: categoryDefaults(value),
                  styleId: "",
                },
              "category",
            );
          }}
        />
      ))}

      {activeScreen === "design" && stepShell(g.qDesign, g.designHint, (
        <ImageOptionGrid
          columns={4}
          ariaLabel={g.qDesign}
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
          ariaLabel={g.qMetal}
          value={form.metal}
          labels={p.opsMetals}
          onSelect={(value) => selectAndAdvance({ metal: value }, "metal")}
        />
      ))}

      {activeScreen === "shape" && stepShell(g.qShape, null, (
        <>
          <ShapeTiles
            ariaLabel={g.qShape}
            value={form.stonePrefs.shape}
            labels={p.shapes}
            onSelect={(value) => {
              setS({ shape: value });
              // 도움말을 읽는 중에는 선택이 곧장 다음 화면으로 튕기지 않는다 —
              // 셰입을 바꿔가며 아래 가이드를 비교하고, 준비되면 "다음"을 누른다
              if (!shapeEduOpen) scheduleAdvance(goNext);
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
          <MediaPicker
            value={refs}
            maxItems={MAX_REFERENCE_MEDIA}
            showSamples={false}
            previewMode="list"
            remoteRequired={LIVE_SERVER_INTAKE}
            onBusyChange={setMediaBusy}
            onErrorChange={setMediaError}
            onChange={(v) => {
              setRefs(sanitizeReferenceMedia(v));
              setStepError("");
            }}
          />
          {/* 사진만으로 다 담기지 않는 요청 — 텍스트로도 받는다 (buildIntakePayload가 form 전체를 실어 서버 formPayload로 전달) */}
          <label className="field"><span>{g.inspirationNotesLbl}</span>
            <textarea
              rows={3}
              value={form.inspirationNotes}
              placeholder={g.inspirationNotesPh}
              onChange={(e) => setForm((current) => ({ ...current, inspirationNotes: e.target.value }))}
            />
          </label>
          <button className="button primary" type="button" disabled={mediaBlocked} onClick={goNext}>{t.next}</button>
        </div>
      ), { onSkip: goNext, skipDisabled: mediaBlocked })}

      {/* 비회원: 리뷰 직전 연락처 — "확정 제안이 도착할 곳"으로 프레이밍해 이탈을 줄인다 */}
      {activeScreen === "contact" && stepShell(!accountEmailLocked ? g.qContact : g.qContactName, g.contactHint, (
        <div className="gflow-contact">
          <label className="field"><span>{t.name} <span className="req">*</span></span>
            <input
              value={form.name}
              autoComplete="name"
              required
              onChange={(e) => { setF({ name: e.target.value }); setStepError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && contactReady) goNext(); }}
            />
          </label>
          {!accountEmailLocked ? (
            <label className="field"><span>{p.login.email} <span className="req">*</span></span>
              <input
                type="email"
                value={form.contact}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="you@email.com"
                aria-invalid={form.contact ? !isValidEmail(form.contact) : undefined}
                aria-describedby="gflow-email-hint"
                onChange={(e) => { setF({ contact: e.target.value }); setStepError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && contactReady) goNext(); }}
              />
              <small id="gflow-email-hint" className="form-hint">{flowCopy.emailHint}</small>
            </label>
          ) : (
            // 로그인 고객: 제안이 도착할 이메일은 계정에서 — 수정 불가로 보여주기만
            <label className="field"><span>{p.login.email}</span>
              <input type="email" value={user.email} readOnly />
            </label>
          )}
          <button className="button primary" type="button" disabled={!contactReady} onClick={goNext}>{t.next}</button>
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
              {/* 그리드 마지막 홀수 칸 — 풀로우로 펼쳐 빈 칸 비대칭을 없앤다 */}
              <label className="field" style={{ gridColumn: "1 / -1" }}><span>{g.engravingLbl}</span>
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
                <strong>{contactDetails.name} · {contactDetails.contact}</strong>
                <button className="button secondary small" type="button" onClick={() => setScreen("contact")}>{g.contactEdit}</button>
              </div>
            </section>
          )}

          {/* 쿠폰 — 견적 바로 위: 코드를 넣으면 아래 예상 견적이 즉시 할인 반영된다 */}
          <section className="gflow-review-section">
            <h4>{g.couponTitle}</h4>
            <label className="field" style={{ maxWidth: 320 }}>
              <input
                value={form.couponCode}
                maxLength={20}
                placeholder={g.couponPh}
                onChange={(e) => setF({ couponCode: e.target.value.toUpperCase() })}
              />
            </label>
            <p className="form-hint" style={{ margin: 0 }}>
              {activeCoupon
                ? `✓ ${activeCoupon.labelKey ? g.couponNames[activeCoupon.labelKey] : `${activeCoupon.code} · −${activeCoupon.value}%`} — ${g.couponAppliedNote}`
                : normalizeCouponCode(form.couponCode) ? g.couponInvalid : g.couponHint}
            </p>
          </section>

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
          <button
            className="button primary gflow-submit"
            type="button"
            disabled={isSubmitting || mediaBusy}
            aria-busy={isSubmitting}
            onClick={submit}
          >
            {isSubmitting ? flowCopy.submitting : t.submit}
          </button>
        </div>
      ))}

      <p style={{ marginTop: 16 }}><Link className="text-link" to="/designs">{t.backToDesigns} →</Link></p>
    </div>
  );
}
