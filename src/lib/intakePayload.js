// Gallery Flow 인테이크의 제출 페이로드 조립 — createIntake 기대 구조와 1:1 호환.
// 순수 로직만 (React/스토어 의존 없음) — 폼 리라이트 시 페이로드 회귀를 테스트로 방지한다.
import {
  BRACELET_WRIST_OPTIONS, CHAIN_LENGTHS, CHAIN_STYLE_OPTIONS, CLASP_OPTIONS,
  EARRING_PAIRING_OPTIONS,
} from "./ops.js";
import { normalizeCouponCode } from "./coupons.js";
import {
  CLARITY_SCALE, COLOR_SCALE, MULTI_CLARITY_DEFAULT, MULTI_COLOR_DEFAULT,
  SOLITAIRE_CARAT, SOLITAIRE_CLARITY_DEFAULT, SOLITAIRE_COLOR_DEFAULT,
  caratRangeMid, clampCaratRange, clampGradeRange, clampTotalCaratRange, formatGradeRange,
} from "./gradeScale.js";

export const DEFAULT_MULTI_STANDARD = "F-G / VS+";
export const MAX_REFERENCE_MEDIA = 5;
export const RING_SIZE_OPTIONS = Array.from({ length: 21 }, (_, i) => String(3 + i * 0.5).replace(/\.0$/, ""));
// 약혼반지 프롱 수 — 스타일은 참조 이미지일 뿐, 고객이 4/6프롱을 직접 고른다.
export const PRONG_OPTIONS = ["four-prong", "six-prong"];

// 주문 포털은 이메일 세션을 기준으로 주문을 연결한다. 전화번호나 느슨한
// "무언가 입력됨" 검증을 통과시키면 접수 후 주문을 열 수 없으므로, 브라우저의
// type=email 힌트와 별개로 제출 경계에서도 동일한 규칙을 적용한다.
export function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254 || /\s/.test(email)) return false;
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator !== email.indexOf("@")) return false;

  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1).toLowerCase();
  if (
    local.length > 64
    || local.startsWith(".")
    || local.endsWith(".")
    || local.includes("..")
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  ) return false;

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => (
    !label
    || label.length > 63
    || !/^[a-z0-9-]+$/i.test(label)
    || label.startsWith("-")
    || label.endsWith("-")
  ))) return false;
  return !/^\d+$/.test(labels.at(-1));
}

export function referenceMediaReady(items, { remoteRequired = true } = {}) {
  if (!remoteRequired) return true;
  return (items || []).every((media) => (
    !media?.transient && /^https?:\/\//i.test(String(media?.src || ""))
  ));
}

export function sanitizeReferenceMedia(items) {
  return (items || []).slice(0, MAX_REFERENCE_MEDIA).map((media) => ({
    kind: media.kind || "image",
    src: media.src,
    ...(media.poster ? { poster: media.poster } : {}),
    ...(media.name ? { name: media.name } : {}),
    ...(media.size ? { size: media.size } : {}),
    ...(media.originalSize ? { originalSize: media.originalSize } : {}),
    ...(media.width ? { width: media.width } : {}),
    ...(media.height ? { height: media.height } : {}),
    ...(media.optimized ? { optimized: true } : {}),
    ...(media.transient ? { transient: true } : {}),
  }));
}

// 계정에 "제대로 된 이름"이 있는지 — OTP 가입 계정은 name이 이메일 그대로 저장되는
// 경우가 있어(실서버 검증됨), 이메일 형태 이름은 없는 것으로 취급한다.
export function accountDisplayName(user) {
  const name = (user?.name || "").trim();
  return name && !name.includes("@") ? name : "";
}

export function submissionContact(form, user) {
  const fallbackName = user?.email?.split("@")[0] || "";
  const accountEmail = String(user?.email || "").trim();
  // 위저드에서 입력한 이름(form.name)이 이메일형 계정 이름보다 우선한다
  return {
    name: (accountDisplayName(user) || form.name || fallbackName).trim(),
    // 손상된/레거시 계정 이메일이면 수정 가능한 폼 값을 사용한다.
    contact: (isValidEmail(accountEmail) ? accountEmail : form.contact || "").trim(),
  };
}

export function hasContactDetails(contact) {
  return Boolean((contact.name || "").trim() && isValidEmail(contact.contact));
}

// 카테고리별 필수 사이즈/핏 검증 — 기존 위저드 step 0 규칙 유지
export function conditionalComplete(category, conditional = {}) {
  if (category === "ring") return RING_SIZE_OPTIONS.includes(conditional.ringSize || "");
  if (category === "necklace") {
    return CHAIN_STYLE_OPTIONS.includes(conditional.chainStyle || "")
      && CHAIN_LENGTHS.includes(conditional.chainLength || "")
      && CLASP_OPTIONS.includes(conditional.clasp || "");
  }
  if (category === "bangle") return BRACELET_WRIST_OPTIONS.includes(conditional.wristSize || "");
  if (category === "earrings") return EARRING_PAIRING_OPTIONS.includes(conditional.earringDetails || "");
  return true;
}

// createIntake에 넘길 최종 페이로드 — solitaire는 stonePrefs, multi는 multiSpec만 채운다.
// 캐럿·등급 모두 [하한,상한] range로 정규화. 단일값 필드(carat/totalCarat)는 range 중간값으로
// 채워 레거시 소비처(서버 요약·이메일·풀매칭 폴백)와의 호환을 유지한다.
export function buildIntakePayload(form, refs, user) {
  const contactDetails = submissionContact(form, user);
  const solitaire = form.productLine === "solitaire";
  const multiColor = clampGradeRange(COLOR_SCALE, form.multiSpec?.colorRange, MULTI_COLOR_DEFAULT);
  const multiClarity = clampGradeRange(CLARITY_SCALE, form.multiSpec?.clarityRange, MULTI_CLARITY_DEFAULT);
  const totalCaratRange = clampTotalCaratRange(form.category, form.multiSpec?.totalCaratRange ?? form.multiSpec?.totalCarat);
  const caratRange = clampCaratRange(SOLITAIRE_CARAT, form.stonePrefs?.caratRange ?? form.stonePrefs?.carat);
  const multiSpec = solitaire ? null : {
    totalCaratRange,
    totalCarat: caratRangeMid(totalCaratRange),
    colorRange: multiColor,
    clarityRange: multiClarity,
    meleeSpec: form.multiSpec?.meleeSpec || "",
    overallDims: form.multiSpec?.overallDims || "",
    arrangement: form.multiSpec?.arrangement || "",
    standard: `${formatGradeRange(multiColor)} / ${formatGradeRange(multiClarity)}`,
  };
  return {
    ...form,
    ...contactDetails,
    // 서버 customer_intakes는 styleCode를 정규 컬럼으로 읽는다. styleId는 로컬
    // 스토어 호환을 위해 유지하고 서버 계약용 별칭을 함께 보낸다.
    styleCode: form.styleId || null,
    engraving: (form.engraving || "").trim(),
    couponCode: normalizeCouponCode(form.couponCode),
    stonePrefs: solitaire ? {
      ...form.stonePrefs,
      caratRange,
      carat: caratRangeMid(caratRange),
      // 구 드래프트의 단일값(color/clarity)은 [v,v] range로 승격
      colorRange: clampGradeRange(COLOR_SCALE, form.stonePrefs?.colorRange ?? form.stonePrefs?.color, SOLITAIRE_COLOR_DEFAULT),
      clarityRange: clampGradeRange(CLARITY_SCALE, form.stonePrefs?.clarityRange ?? form.stonePrefs?.clarity, SOLITAIRE_CLARITY_DEFAULT),
    } : null,
    multiSpec,
    referenceMedia: sanitizeReferenceMedia(refs),
  };
}
