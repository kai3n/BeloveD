// Gallery Flow 인테이크의 제출 페이로드 조립 — createIntake 기대 구조와 1:1 호환.
// 순수 로직만 (React/스토어 의존 없음) — 폼 리라이트 시 페이로드 회귀를 테스트로 방지한다.
import {
  BRACELET_WRIST_OPTIONS, CHAIN_LENGTHS, CHAIN_STYLE_OPTIONS, CLASP_OPTIONS,
  EARRING_PAIRING_OPTIONS,
} from "./ops.js";

export const DEFAULT_MULTI_STANDARD = "F-G / VS+";
export const MAX_REFERENCE_MEDIA = 5;
export const RING_SIZE_OPTIONS = Array.from({ length: 21 }, (_, i) => String(3 + i * 0.5).replace(/\.0$/, ""));

export function sanitizeReferenceMedia(items) {
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

export function submissionContact(form, user) {
  const fallbackName = user?.email?.split("@")[0] || "";
  return {
    name: (user?.name || form.name || fallbackName).trim(),
    contact: (user?.email || form.contact || "").trim(),
  };
}

export function hasContactDetails(contact) {
  return Boolean((contact.name || "").trim() && (contact.contact || "").trim());
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
// multi의 meleeSpec/overallDims 자유입력은 폐지: 상담·확정 제안 단계에서 어드민이 확정한다.
export function buildIntakePayload(form, refs, user) {
  const contactDetails = submissionContact(form, user);
  const solitaire = form.productLine === "solitaire";
  const multiSpec = solitaire ? null : {
    meleeSpec: form.multiSpec?.meleeSpec || "",
    overallDims: form.multiSpec?.overallDims || "",
    arrangement: form.multiSpec?.arrangement || "",
    standard: (form.multiSpec?.standard || "").trim() || DEFAULT_MULTI_STANDARD,
  };
  return {
    ...form,
    ...contactDetails,
    stonePrefs: solitaire ? { ...form.stonePrefs, carat: Number(form.stonePrefs?.carat) || null } : null,
    multiSpec,
    referenceMedia: sanitizeReferenceMedia(refs),
  };
}
