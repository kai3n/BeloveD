import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MULTI_STANDARD, buildIntakePayload, conditionalComplete, sanitizeReferenceMedia,
} from "../intakePayload.js";
import { createIntake, resetDB } from "../store.js";

beforeEach(() => resetDB());

function ringForm(overrides = {}) {
  return {
    name: "", contact: "", productLine: "solitaire", category: "ring", subcategory: "engagementRing",
    styleId: "RING-001", metal: "18kw", conditional: { ringSize: "6" },
    stonePrefs: { shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" },
    multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
    requiredDate: "", termsAccepted: true,
    ...overrides,
  };
}

describe("buildIntakePayload — createIntake 호환", () => {
  it("솔리테어: stonePrefs 숫자화, multiSpec null, 게스트 연락처 반영", () => {
    const payload = buildIntakePayload(
      ringForm({ name: "Jiwon", contact: "j@x.com" }),
      [{ kind: "image", src: "/ref.png", extraJunk: true }],
      null,
    );
    expect(payload.stonePrefs.carat).toBe(1.5);
    expect(payload.multiSpec).toBeNull();
    expect(payload.name).toBe("Jiwon");
    expect(payload.referenceMedia).toEqual([{ kind: "image", src: "/ref.png" }]);
    // 실제 createIntake로 주문이 생성되는지 (구조 호환 스모크)
    const { order, intake } = createIntake(payload, null);
    expect(order.status).toBe("STONE_SELECTION");
    expect(intake.subcategory).toBe("engagementRing");
  });

  it("멀티: stonePrefs null, multiSpec 기본 등급 채움 (자유입력 없이 제출 가능)", () => {
    const payload = buildIntakePayload(
      ringForm({ productLine: "multi", category: "necklace", styleId: "NECK-001", conditional: { chainStyle: "cable", chainLength: "18in", clasp: "lobster" } }),
      [],
      { name: "Noah", email: "noah@x.com" },
    );
    expect(payload.stonePrefs).toBeNull();
    expect(payload.multiSpec.standard).toBe(DEFAULT_MULTI_STANDARD);
    expect(payload.multiSpec.meleeSpec).toBe("");
    expect(payload.contact).toBe("noah@x.com"); // 로그인 사용자 이메일 우선
    const { order } = createIntake(payload, "u-customer");
    expect(order.status).toBe("QUOTATION");
  });

  it("스타일 미정(open brief)은 STYLE_SELECTION으로 접수된다", () => {
    const payload = buildIntakePayload(ringForm({ styleId: "", name: "G", contact: "g@x.com" }), [], null);
    const { order } = createIntake(payload, null);
    expect(order.status).toBe("STYLE_SELECTION");
  });
});

describe("conditionalComplete — 카테고리별 필수 사이즈/핏", () => {
  it("링/목걸이/뱅글/귀걸이 규칙", () => {
    expect(conditionalComplete("ring", { ringSize: "6" })).toBe(true);
    expect(conditionalComplete("ring", {})).toBe(false);
    expect(conditionalComplete("necklace", { chainStyle: "cable", chainLength: "18in", clasp: "lobster" })).toBe(true);
    expect(conditionalComplete("necklace", { chainStyle: "cable", chainLength: "18in" })).toBe(false);
    expect(conditionalComplete("bangle", { wristSize: "6.5in" })).toBe(true);
    expect(conditionalComplete("earrings", { earringDetails: "matchedPush" })).toBe(true);
    expect(conditionalComplete("earrings", {})).toBe(false);
  });
});

describe("sanitizeReferenceMedia", () => {
  it("최대 5개, 허용 필드만 통과", () => {
    const media = Array.from({ length: 7 }, (_, i) => ({ src: `/m${i}.png`, width: 100, secret: "x" }));
    const clean = sanitizeReferenceMedia(media);
    expect(clean).toHaveLength(5);
    expect(clean[0]).toEqual({ kind: "image", src: "/m0.png", width: 100 });
  });
});
