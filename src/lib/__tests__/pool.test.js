import { describe, expect, it } from "vitest";
import { COLOR_ORDER, CLARITY_ORDER, poolStoneMatches } from "../ops.js";

const OPTS = { caratUnder: 0.05, caratOver: 0.4 };
const base = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD" };
const prefs = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD" };

describe("poolStoneMatches — 순수 매칭 판정", () => {
  it("등급 순서 상수", () => {
    expect(COLOR_ORDER[0]).toBe("D");
    expect(COLOR_ORDER.indexOf("D")).toBeLessThan(COLOR_ORDER.indexOf("E"));
    expect(CLARITY_ORDER[0]).toBe("FL");
    expect(CLARITY_ORDER.indexOf("IF")).toBeLessThan(CLARITY_ORDER.indexOf("VS1"));
  });
  it("정확 일치는 매칭", () => {
    expect(poolStoneMatches(base, prefs, OPTS)).toBe(true);
  });
  it("셰이프 불일치 제외", () => {
    expect(poolStoneMatches({ ...base, shape: "oval" }, prefs, OPTS)).toBe(false);
  });
  it("컬러·클래리티는 '등급 이상'만 통과", () => {
    expect(poolStoneMatches({ ...base, color: "D", clarity: "IF" }, prefs, OPTS)).toBe(true); // 더 좋음
    expect(poolStoneMatches({ ...base, color: "F" }, prefs, OPTS)).toBe(false);              // 더 나쁨
    expect(poolStoneMatches({ ...base, clarity: "VS2" }, prefs, OPTS)).toBe(false);          // 더 나쁨
  });
  it("캐럿 범위 경계", () => {
    expect(poolStoneMatches({ ...base, carat: 1.46 }, prefs, OPTS)).toBe(true);  // -0.04 ≥ -0.05
    expect(poolStoneMatches({ ...base, carat: 1.44 }, prefs, OPTS)).toBe(false); // -0.06 < -0.05
    expect(poolStoneMatches({ ...base, carat: 1.9 }, prefs, OPTS)).toBe(true);   // +0.4
    expect(poolStoneMatches({ ...base, carat: 1.95 }, prefs, OPTS)).toBe(false); // +0.45
  });
  it("성장방식: 요청 있으면 일치 필요, 없으면 무시", () => {
    expect(poolStoneMatches({ ...base, growth: "HPHT" }, prefs, OPTS)).toBe(false);
    expect(poolStoneMatches({ ...base, growth: "HPHT" }, { ...prefs, growth: "" }, OPTS)).toBe(true);
  });
});
