import { describe, expect, it } from "vitest";
import { COLOR_ORDER, CLARITY_ORDER, poolStoneMatches } from "../ops.js";
import { listPoolDiamonds, getPoolDiamond, savePoolDiamond, archivePoolDiamond, setPoolAvailability } from "../store.js";

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

describe("poolDiamonds — CRUD & 권한 스코프", () => {
  it("시드에 풀 스톤이 있고 기본은 archived 제외", () => {
    const all = listPoolDiamonds();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((s) => !s.archived)).toBe(true);
  });
  it("supplierId 스코프 — 벤더는 자기 것만", () => {
    const s1 = listPoolDiamonds({ supplierId: "u-supplier1" });
    expect(s1.length).toBeGreaterThan(0);
    expect(s1.every((s) => s.supplierId === "u-supplier1")).toBe(true);
  });
  it("새 스톤 추가 → POOL- id + available 기본값", () => {
    const created = savePoolDiamond({ supplierId: "u-supplier2", shape: "round", carat: 1.7, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", igiNo: "IGI-TEST-1", procurementCostUsd: 700 });
    expect(created.id).toMatch(/^POOL-/);
    expect(created.availability).toBe("available");
    expect(created.archived).toBe(false);
    expect(getPoolDiamond(created.id)).toBeTruthy();
  });
  it("수정·재고토글·아카이브", () => {
    const c = savePoolDiamond({ supplierId: "u-supplier1", shape: "oval", carat: 1.2, color: "F", clarity: "VVS2", growth: "CVD", lab: "IGI", igiNo: "IGI-TEST-2", procurementCostUsd: 500 });
    savePoolDiamond({ id: c.id, procurementCostUsd: 550 });
    expect(getPoolDiamond(c.id).procurementCostUsd).toBe(550);
    setPoolAvailability(c.id, "unavailable");
    expect(getPoolDiamond(c.id).availability).toBe("unavailable");
    archivePoolDiamond(c.id);
    expect(getPoolDiamond(c.id).archived).toBe(true);
    expect(listPoolDiamonds().find((s) => s.id === c.id)).toBeUndefined(); // 기본 목록서 제외
    expect(listPoolDiamonds({ includeArchived: true }).find((s) => s.id === c.id)).toBeTruthy();
  });
});
