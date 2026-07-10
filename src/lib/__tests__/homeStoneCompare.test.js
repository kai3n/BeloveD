import { beforeEach, describe, expect, it } from "vitest";
import { benchmarkFor, getSettings, resetDB, setBenchmarkPrice, updateSettings } from "../store.js";
import { estimateLooseStoneCompare } from "../quoteEstimate.js";

beforeEach(() => resetDB());

const round10 = (n) => Math.round(n / 10) * 10;

describe("estimateLooseStoneCompare — 홈 루스 스톤 가격 비교", () => {
  it("공식: 벤치마크 $/ct × 등급 보정 × 캐럿 × 배수, ±스프레드(0.92/1.1)", () => {
    const s = getSettings();
    const r = estimateLooseStoneCompare({ shape: "round", carat: 1.0, color: "F", clarity: "VS1" });
    const stone = benchmarkFor("round", 1.0).unitUsdPerCt * 1.0 * 1.0 * s.opsMultiplier; // F/VS1 = 보정 1.0
    expect(r.beloved.low).toBe(round10(stone * 0.92));
    expect(r.beloved.high).toBe(round10(stone * 1.1));
  });

  it("기본값은 홈 비교 사양(1.00ct round F/VS1)과 동일", () => {
    expect(estimateLooseStoneCompare()).toEqual(
      estimateLooseStoneCompare({ shape: "round", carat: 1.0, color: "F", clarity: "VS1" }),
    );
  });

  it("경쟁사는 고정 배수 — 최고가 경쟁사 이름과 절감액(top.high − low)을 함께 준다", () => {
    const r = estimateLooseStoneCompare();
    const bn = r.competitors.find((c) => c.name === "Blue Nile");
    const be = r.competitors.find((c) => c.name === "Brilliant Earth");
    expect(bn.low).toBe(round10(r.beloved.low * 1.95));
    expect(bn.high).toBe(round10(r.beloved.high * 2.05));
    expect(be.low).toBe(round10(r.beloved.low * 1.62));
    expect(be.high).toBe(round10(r.beloved.high * 1.72));
    expect(r.topName).toBe("Blue Nile");
    expect(r.savingsTop).toBe(bn.high - r.beloved.low);
  });

  it("어드민이 벤치마크·배수를 바꾸면 비교가도 함께 움직인다", () => {
    const base = estimateLooseStoneCompare();
    setBenchmarkPrice("round", "1.00-1.49", 400);
    const bumpedBench = estimateLooseStoneCompare();
    expect(bumpedBench.beloved.low).toBeGreaterThan(base.beloved.low);
    updateSettings({ opsMultiplier: 2.2 });
    const bumpedMult = estimateLooseStoneCompare();
    expect(bumpedMult.beloved.low).toBeGreaterThan(bumpedBench.beloved.low);
  });

  it("등급이 높을수록 비싸다 (D/IF > F/VS1)", () => {
    const lo = estimateLooseStoneCompare({ color: "F", clarity: "VS1" });
    const hi = estimateLooseStoneCompare({ color: "D", clarity: "IF" });
    expect(hi.beloved.low).toBeGreaterThan(lo.beloved.low);
  });
});
