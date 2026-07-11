import { describe, expect, it } from "vitest";
import {
  MILESTONE_STAGES, CARAT_TIERS, tierForCarat, quoteCompute, reconcileDelta,
  publicDiamondView, customerOrderView, supplierTaskView, randomQueryCode,
  autoBrief, poolStoneMatches,
} from "../ops.js";

describe("quote 공식 (매뉴얼 §7)", () => {
  const inputs = {
    carat: 1.5, benchmarkUsdPerCt: 420, multiplier: 1.8,
    estWeightG: 4.2, metalRefUsdPerG: 95, lossRatePct: 8,
    nonMetalUsd: 260, depositRate: 0.5,
  };
  it("다이아/메탈/합계/디파짓/잔금", () => {
    const q = quoteCompute(inputs);
    expect(q.diamondAmountUsd).toBe(Math.round(420 * 1.5 * 1.8));       // 1134
    expect(q.metalAmountUsd).toBe(Math.round(4.2 * 95 * 1.08));         // 431
    expect(q.totalUsd).toBe(q.diamondAmountUsd + q.metalAmountUsd + 260);
    expect(q.depositUsd).toBe(Math.round(q.totalUsd * 0.5));
    expect(q.balanceUsd).toBe(q.totalUsd - q.depositUsd);
  });
  it("실중량 정산: 차이만큼 잔금 가감", () => {
    expect(reconcileDelta(4.2, 4.5, 95, 8)).toBe(Math.round(0.3 * 95 * 1.08));   // +31
    expect(reconcileDelta(4.2, 4.0, 95, 8)).toBe(Math.round(-0.2 * 95 * 1.08));  // -21
  });
});

describe("벤치마크 티어", () => {
  it("7개 티어, 캐럿 매핑", () => {
    expect(CARAT_TIERS.length).toBe(7);
    expect(tierForCarat(0.55)).toBe(CARAT_TIERS[0].key);
    expect(tierForCarat(1.2)).toBe("1.00-1.49");
    expect(tierForCarat(5)).toBe("3.00+");
  });
});

describe("보안 프로젝션 (매뉴얼 §2)", () => {
  const cand = {
    id: "DIA-DM-000001-01", orderId: "DM-000001", igiNo: "IGI-1", shape: "round", carat: 1.5,
    color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India",
    proportions: { table: 57, depth: 62 }, reportUrl: "r", image: "i", video: "v",
    colorTreatment: "disclosed", availability: "available", customerPriceUsd: 1200, published: true,
    procurementCostUsd: 650, supplierId: "u-supplier1", internalReview: "recommended", internalNotes: "메모",
  };
  it("publicDiamondView는 원가·서플라이어·내부검수 제외", () => {
    const v = publicDiamondView(cand);
    expect(v.procurementCostUsd).toBeUndefined();
    expect(v.supplierId).toBeUndefined();
    expect(v.internalReview).toBeUndefined();
    expect(v.internalNotes).toBeUndefined();
    expect(v.customerPriceUsd).toBe(1200);
    expect(v.igiNo).toBe("IGI-1");
  });
  it("customerOrderView는 내부 노트·오너 제외", () => {
    const v = customerOrderView({ id: "DM-000001", status: "CAD", customerName: "Kim", internalNotes: "위험", owner: "ops", queryCode: "X" });
    expect(v.internalNotes).toBeUndefined();
    expect(v.owner).toBeUndefined();
    expect(v.status).toBe("CAD");
  });
  it("supplierTaskView는 고객 신원·판매가 제외, Order ID 미노출", () => {
    const v = supplierTaskView(
      { id: "PR-000001", orderId: "DM-000001", type: "diamondCandidates", dueDate: "2026-06-20", brief: "1.5ct round" },
      { customerName: "김지원", requiredDate: "2026-07-30" },
      { id: "RING-001", estWeightG: 4.2 }
    );
    expect(JSON.stringify(v)).not.toContain("김지원");
    expect(JSON.stringify(v)).not.toContain("DM-000001");
    expect(v.requiredDate).toBe("2026-07-30");
    expect(v.styleRef).toBe("RING-001");
  });
});

describe("기타", () => {
  it("마일스톤 13종 고정 순서", () => {
    expect(MILESTONE_STAGES.length).toBe(13);
    expect(MILESTONE_STAGES[0]).toBe("depositReceived");
    expect(MILESTONE_STAGES[12]).toBe("deliveredArchived");
  });
  it("query code는 추측 불가 랜덤 형식", () => {
    const c = randomQueryCode();
    expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(randomQueryCode()).not.toBe(randomQueryCode());
  });
});

describe("autoBrief — 등급 range", () => {
  it("멀티: totalCarat과 파생 standard가 브리프에 실린다", () => {
    const brief = autoBrief({ productLine: "multi", multiSpec: { totalCarat: 5, standard: "E–G / VVS1–VS2", meleeSpec: "", overallDims: "", arrangement: "" } });
    expect(brief).toContain("5ct total");
    expect(brief).toContain("E–G / VVS1–VS2");
  });
  it("솔리테어: colorRange가 있으면 range 라벨, 없으면 단일값", () => {
    const brief = autoBrief({ productLine: "solitaire", stonePrefs: { carat: 1.5, shape: "round", colorRange: ["F", "D"], clarityRange: ["VS1", "IF-FL"], growth: "CVD", lab: "IGI", colorTreatment: "disclosed" } });
    expect(brief).toContain("D–F/IF-FL–VS1");
    const legacy = autoBrief({ productLine: "solitaire", stonePrefs: { carat: 1.5, shape: "round", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", colorTreatment: "disclosed" } });
    expect(legacy).toContain("E/VS1");
  });
});

describe("poolStoneMatches — range 하한 매칭", () => {
  const stone = { shape: "round", carat: 1.5, color: "F", clarity: "VS1", growth: "CVD" };
  const opts = { caratUnder: 0.05, caratOver: 0.4 };
  it("스톤 등급이 range 하한 이상이면 매칭", () => {
    expect(poolStoneMatches(stone, { shape: "round", carat: 1.5, colorRange: ["G", "D"], clarityRange: ["VS2", "IF-FL"], growth: "CVD" }, opts)).toBe(true);
  });
  it("하한 미달이면 탈락", () => {
    expect(poolStoneMatches(stone, { shape: "round", carat: 1.5, colorRange: ["E", "D"], clarityRange: ["VS2", "IF-FL"], growth: "CVD" }, opts)).toBe(false);
  });
});
