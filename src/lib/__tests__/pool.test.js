import { beforeEach, describe, expect, it } from "vitest";
import { COLOR_ORDER, CLARITY_ORDER, poolStoneMatches } from "../ops.js";
import { resetDB, listPoolDiamonds, getPoolDiamond, savePoolDiamond, archivePoolDiamond, setPoolAvailability, createIntake, listCandidates, listProcurements, matchPoolForOrder, lockCandidate, submitPoolCandidates, getProcurement, getOpsOrder, getCandidate, submitCandidates, toggleShortlist, requestStockConfirm, submitStockConfirm, lockSelectedCandidate } from "../store.js";

beforeEach(() => resetDB()); // 테스트 간 격리 — 시드만으로 매칭 카운트 결정적

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

describe("자동매칭 → 후보 생성 + 폴백", () => {
  const solitairePrefs = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" };
  const form = (prefs) => ({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "", budget: null, metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: prefs, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] });

  it("matchPoolForOrder — round/1.5/E/VS1/CVD 매칭 (D/VVS1, E/VS1, E/IF, E/VVS2)", () => {
    const m = matchPoolForOrder(solitairePrefs);
    expect(m.map((s) => s.id).sort()).toEqual(["POOL-000001", "POOL-000002", "POOL-000003", "POOL-000005"]);
  });

  it("솔리테어 인테이크 → 풀에서 published 후보 자동 생성, PR 없음", () => {
    const { order } = createIntake(form(solitairePrefs));
    const cands = listCandidates({ orderId: order.id });
    expect(cands.length).toBeGreaterThanOrEqual(3);
    expect(cands.every((c) => c.poolDiamondId && c.prId === null)).toBe(true);
    expect(cands.some((c) => c.published && c.customerPriceUsd > 0)).toBe(true);
    expect(listProcurements({ orderId: order.id }).some((p) => p.type === "diamondCandidates")).toBe(false);
  });

  it("매칭 0건 → 후보 0 + diamondCandidates 폴백 PR 발행", () => {
    const noMatch = { ...solitairePrefs, shape: "heart" }; // 하트 풀 스톤 없음
    const { order } = createIntake(form(noMatch));
    expect(listCandidates({ orderId: order.id }).length).toBe(0);
    expect(listProcurements({ orderId: order.id }).some((p) => p.type === "diamondCandidates" && p.status === "open")).toBe(true);
  });
});

describe("락 → 풀 sold + 형제 후보 무효화", () => {
  const prefs = { shape: "oval", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" };
  const form = () => ({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "", budget: null, metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: prefs, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] });

  it("두 주문이 같은 풀 스톤(POOL-000006 oval)을 후보로 가짐 → 락 시 sold + 형제 무효화", () => {
    const o1 = createIntake(form()).order;
    const o2 = createIntake(form()).order;
    const c1 = listCandidates({ orderId: o1.id }).find((c) => c.poolDiamondId === "POOL-000006");
    const c2 = listCandidates({ orderId: o2.id }).find((c) => c.poolDiamondId === "POOL-000006");
    expect(c1 && c2).toBeTruthy();

    lockCandidate(c1.id);
    expect(getPoolDiamond("POOL-000006").availability).toBe("sold");
    // 다른 주문의 형제 후보는 무효화(unpublish + sold)
    const c2after = listCandidates({ orderId: o2.id }).find((c) => c.poolDiamondId === "POOL-000006");
    expect(c2after.published).toBe(false);
    expect(c2after.availability).toBe("sold");
    // sold 풀 스톤은 이후 새 주문에 매칭 안 됨
    expect(matchPoolForOrder(prefs).map((s) => s.id)).not.toContain("POOL-000006");
  });
});

describe("submitPoolCandidates — 풀에서 폴백 후보 제출", () => {
  it("선택한 풀 스톤이 후보로 생성(poolDiamondId·자동가·published) + pr submitted", () => {
    const { order } = createIntake({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "", metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: { shape: "heart", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" }, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] });
    const pr = listProcurements({ orderId: order.id }).find((p) => p.type === "diamondCandidates");
    expect(pr).toBeTruthy();
    const poolIds = ["POOL-000001", "POOL-000002"];
    const created = submitPoolCandidates(pr.id, poolIds);
    expect(created.length).toBe(2);
    expect(created.every((c) => c.poolDiamondId && c.prId === pr.id && c.supplierId === pr.supplierId)).toBe(true);
    expect(created.some((c) => c.published && c.customerPriceUsd > 0)).toBe(true);
    expect(getProcurement(pr.id).status).toBe("submitted");
    expect(listCandidates({ orderId: order.id }).filter((c) => c.poolDiamondId).length).toBe(2);
  });
});

describe("④ 다중선택 — 찜→일괄확인→하나 락", () => {
  const prefs = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" };
  const mk = () => createIntake({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "RING-001", metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: prefs, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] }).order;

  it("여러 후보 찜(토글) → 재고확인 요청 → 찜 수만큼 stockConfirm PR", () => {
    const order = mk();
    const cands = listCandidates({ orderId: order.id });
    expect(cands.length).toBeGreaterThanOrEqual(3);
    toggleShortlist(cands[0].id, "customer");
    toggleShortlist(cands[1].id, "customer");
    expect(getCandidate(cands[0].id).clientSelection).toBe("selected");
    toggleShortlist(cands[1].id, "customer"); // 토글 해제
    expect(getCandidate(cands[1].id).clientSelection).toBe("none");
    toggleShortlist(cands[1].id, "customer"); // 다시 찜
    requestStockConfirm(order.id, "customer");
    const scs = listProcurements({ orderId: order.id }).filter((p) => p.type === "stockConfirm" && p.status === "open");
    expect(scs.length).toBe(2);
  });

  it("재고확인 '있음'은 락 안 함(stockConfirmed만), '품절'은 drop", () => {
    const order = mk();
    const cands = listCandidates({ orderId: order.id });
    toggleShortlist(cands[0].id, "customer");
    toggleShortlist(cands[1].id, "customer");
    requestStockConfirm(order.id, "customer");
    const prFor = (diaId) => listProcurements({ orderId: order.id }).find((p) => p.type === "stockConfirm" && p.diamondId === diaId);
    submitStockConfirm(prFor(cands[0].id).id, true);
    submitStockConfirm(prFor(cands[1].id).id, false);
    expect(getCandidate(cands[0].id).stockConfirmed).toBe(true);
    expect(getCandidate(cands[0].id).locked).toBeFalsy();
    expect(getOpsOrder(order.id).selectedDiamondId).toBeNull();
    expect(getCandidate(cands[1].id).availability).toBe("sold");
    expect(getCandidate(cands[1].id).clientSelection).toBe("none");
  });

  it("확인된 후보만 락 가능, 락 시 형제 찜 초기화 + 풀 sold", () => {
    const order = mk();
    const cands = listCandidates({ orderId: order.id });
    toggleShortlist(cands[0].id, "customer");
    toggleShortlist(cands[1].id, "customer");
    requestStockConfirm(order.id, "customer");
    const prFor = (diaId) => listProcurements({ orderId: order.id }).find((p) => p.type === "stockConfirm" && p.diamondId === diaId);
    expect(() => lockSelectedCandidate(cands[0].id, "customer")).toThrow(); // 아직 미확인
    submitStockConfirm(prFor(cands[0].id).id, true);
    submitStockConfirm(prFor(cands[1].id).id, true);
    lockSelectedCandidate(cands[0].id, "customer");
    expect(getCandidate(cands[0].id).locked).toBe(true);
    expect(getOpsOrder(order.id).status).toBe("QUOTATION");
    expect(getCandidate(cands[1].id).clientSelection).toBe("none");
    expect(getPoolDiamond(cands[0].poolDiamondId).availability).toBe("sold");
  });
});
