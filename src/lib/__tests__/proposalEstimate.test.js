import { beforeEach, describe, expect, it } from "vitest";
import { benchmarkFor, getSettings, resetDB } from "../store.js";
import { estimateProposalQuote, METAL_LABELS } from "../proposalEstimate.js";

beforeEach(() => resetDB());

const round10 = (n) => Math.round(n / 10) * 10;

// 공통 폼 입력 — 개별 테스트에서 필요한 필드만 덮어쓴다
const base = {
  metalSpec: "18K White Gold", estWeightG: "", shape: "round",
  caratMin: "3", caratMax: "3.05", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI",
  styleId: null, category: "ring",
};

describe("제안서 자동 견적", () => {
  it("캐럿이 없으면 추정 불가 → null", () => {
    expect(estimateProposalQuote({ ...base, caratMin: "", caratMax: "" })).toBeNull();
  });

  it("공식: 벤치마크 단가 × 등급 보정 × 캐럿(중앙값) × 배수 + 메탈(로스 포함) + 공임, 디파짓 30%", () => {
    const s = getSettings();
    const carat = (3 + 3.05) / 2;
    const est = estimateProposalQuote({ ...base, estWeightG: "5" });
    const unit = benchmarkFor("round", carat).unitUsdPerCt * 1.06; // E=1.06 · VS1/CVD/IGI=1.0
    const diamond = Math.round(unit * carat * s.opsMultiplier);
    const metal = Math.round(5 * s.metalRefUsdPerG["18kw"] * (1 + s.defaultLossRatePct / 100));
    expect(est.diamondUsd).toBe(diamond);
    expect(est.metalUsd).toBe(metal);
    expect(est.laborUsd).toBe(320); // 스타일 스펙 없음 → ring 기본 공임
    expect(est.totalUsd).toBe(round10(diamond + metal + 320));
    expect(est.depositUsd).toBe(round10(est.totalUsd * 0.3));
  });

  it("등급이 높을수록 비싸다 (D/IF/HPHT/GIA > E/VS1/CVD/IGI)", () => {
    const lo = estimateProposalQuote(base);
    const hi = estimateProposalQuote({ ...base, color: "D", clarity: "IF", growth: "HPHT", lab: "GIA" });
    expect(hi.diamondUsd).toBeGreaterThan(lo.diamondUsd);
    expect(hi.totalUsd).toBeGreaterThan(lo.totalUsd);
  });

  it("스타일 스펙(메탈 일치)이 있으면 중량·공임을 스펙에서 가져온다", () => {
    const s = getSettings();
    // 시드: RING-001 / 18kw — estWeightG 4.2, laborUsd 85, materialsUsd 25
    const est = estimateProposalQuote({ ...base, styleId: "RING-001" });
    expect(est.metalUsd).toBe(Math.round(4.2 * s.metalRefUsdPerG["18kw"] * (1 + s.defaultLossRatePct / 100)));
    expect(est.laborUsd).toBe(85 + 25);
  });

  it("직접 입력한 중량이 스타일 스펙보다 우선한다", () => {
    const s = getSettings();
    const est = estimateProposalQuote({ ...base, styleId: "RING-001", estWeightG: "6" });
    expect(est.metalUsd).toBe(Math.round(6 * s.metalRefUsdPerG["18kw"] * (1 + s.defaultLossRatePct / 100)));
  });

  it("메탈 라벨·원코드 모두 시세 키로 매핑된다 (Platinum 950 ≡ pt)", () => {
    const byLabel = estimateProposalQuote({ ...base, metalSpec: "Platinum 950", estWeightG: "5" });
    const byCode = estimateProposalQuote({ ...base, metalSpec: "pt", estWeightG: "5" });
    expect(byLabel.metalUsd).toBe(byCode.metalUsd);
    const s = getSettings();
    expect(byLabel.metalUsd).toBe(Math.round(5 * s.metalRefUsdPerG.pt * (1 + s.defaultLossRatePct / 100)));
  });

  it("시세에 없는 14K는 같은 함량 시세로 폴백한다 (14kw → 14ky)", () => {
    const s = getSettings();
    const est = estimateProposalQuote({ ...base, metalSpec: "14K White Gold", estWeightG: "5" });
    expect(est.metalUsd).toBe(Math.round(5 * s.metalRefUsdPerG["14ky"] * (1 + s.defaultLossRatePct / 100)));
  });

  it("벤치마크에 없는 셰이프(heart)는 round로 폴백한다", () => {
    const heart = estimateProposalQuote({ ...base, shape: "heart" });
    const round = estimateProposalQuote({ ...base, shape: "round" });
    expect(heart.diamondUsd).toBe(round.diamondUsd);
  });

  it("caratMin만 있어도 추정한다", () => {
    const est = estimateProposalQuote({ ...base, caratMin: "1.5", caratMax: "" });
    expect(est.totalUsd).toBeGreaterThan(0);
  });

  it("METAL_LABELS를 단일 소스로 노출한다 (폼 셀렉트 옵션용)", () => {
    expect(METAL_LABELS["18kw"]).toBe("18K White Gold");
    expect(METAL_LABELS.pt950).toBe("Platinum 950");
  });
});
