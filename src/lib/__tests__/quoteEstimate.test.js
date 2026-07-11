import { beforeEach, describe, expect, it } from "vitest";
import { estimateQuoteRange } from "../quoteEstimate.js";
import { resetDB, updateSettings } from "../store.js";

beforeEach(() => resetDB());

const multiForm = (patch = {}) => ({
  productLine: "multi", category: "bangle", styleId: "", metal: "18kw", couponCode: "",
  multiSpec: { totalCarat: 5, colorRange: ["G", "E"], clarityRange: ["VS2", "VVS1"] },
  ...patch,
});

describe("estimateQuoteRange — 멀티 총캐럿", () => {
  it("총 캐럿이 커지면 견적도 커진다", () => {
    const small = estimateQuoteRange(multiForm());
    const large = estimateQuoteRange(multiForm({ multiSpec: { totalCarat: 15, colorRange: ["G", "E"], clarityRange: ["VS2", "VVS1"] } }));
    expect(large.beloved.low).toBeGreaterThan(small.beloved.low);
  });
  it("멜리 단가 설정이 반영된다", () => {
    const base = estimateQuoteRange(multiForm());
    updateSettings({ meleeUsdPerCt: 300 });
    const bumped = estimateQuoteRange(multiForm());
    expect(bumped.beloved.low).toBeGreaterThan(base.beloved.low);
  });
  it("경계 밖 totalCarat은 카테고리 경계로 클램프해 견적한다", () => {
    const junk = estimateQuoteRange(multiForm({ multiSpec: { totalCarat: 999 } }));
    const max = estimateQuoteRange(multiForm({ multiSpec: { totalCarat: 15 } })); // bangle 상한
    expect(junk.beloved.low).toBe(max.beloved.low);
  });
  it("totalCaratRange가 있으면 중간값으로 견적한다", () => {
    const ranged = estimateQuoteRange(multiForm({ multiSpec: { totalCaratRange: [4, 6] } }));
    const mid = estimateQuoteRange(multiForm({ multiSpec: { totalCarat: 5 } }));
    expect(ranged.beloved.low).toBe(mid.beloved.low);
  });
});

describe("estimateQuoteRange — 솔리테어 range factor", () => {
  const soli = (colorRange) => ({
    productLine: "solitaire", category: "ring", styleId: "", metal: "18kw", couponCode: "",
    stonePrefs: { shape: "round", carat: "1.5", colorRange, clarityRange: ["VS1", "VS1"] },
  });
  it("상급 range가 하급 range보다 비싸다", () => {
    expect(estimateQuoteRange(soli(["E", "D"])).beloved.low)
      .toBeGreaterThan(estimateQuoteRange(soli(["H", "G"])).beloved.low);
  });
});
