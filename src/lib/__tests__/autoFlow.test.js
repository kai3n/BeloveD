import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, createIntake, listProcurements, listQuotes, getOpsOrder, submitCandidates,
  selectCandidate, submitStockConfirm, markDepositReceived, acceptQuote,
  submitCadForPr, decideCad, listCadReviews, submitQcForPr, confirmFinal,
  markBalanceReceived, submitShipment, markOrderDelivered, listMilestones,
  submitWeightLabor, mediaFeed, hideMedia, supplierTasks, dailyChecklist,
  getSettings, portalView, listStyleSpecs, getProcurement, getCandidate,
  createProcurement, pendingCount,
} from "../store.js";

beforeEach(() => resetDB());

const solitaireForm = {
  name: "Auto Kim", contact: "auto@x.com", productLine: "solitaire", category: "ring",
  styleId: "RING-001", metal: "18kw", conditional: { ringSize: "6 US" },
  stonePrefs: { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" },
  requiredDate: "2026-09-01", country: "USA", termsAccepted: true,
};

describe("자동 발행 — 인테이크 → 벤더 태스크 (어드민 개입 없음)", () => {
  it("솔리테어 제출 즉시 기본 벤더에게 다이아 후보 태스크 발행", () => {
    const { order } = createIntake(solitaireForm);
    const pr = listProcurements({ orderId: order.id }).find((p) => p.type === "diamondCandidates");
    expect(pr.supplierId).toBe(getSettings().defaultSupplierId);
    expect(pr.brief).toContain("1.5ct round");
    expect(pr.brief).not.toContain("Auto Kim"); // 고객 신원 미포함
    expect(pr.batchValidUntil).toBeTruthy();
    expect(pr.status).toBe("open");
  });

  it("멀티스톤 + 승인 스펙 → 견적 자동 생성·발송 (벤더 태스크 불필요)", () => {
    const { order } = createIntake({
      name: "M", contact: "m@x.com", productLine: "multi", category: "necklace", styleId: "NECK-001",
      metal: "18ky", conditional: { chainLength: "18in" }, multiSpec: { meleeSpec: "1.5mm x 20", overallDims: "", arrangement: "", standard: "" }, termsAccepted: true,
    });
    const q = listQuotes(order.id)[0];
    expect(q.status).toBe("sent"); // SPEC-000001 재사용
    expect(q.nonMetalUsd).toBe(105); // 공임 75 + 부자재 30
    expect(listProcurements({ orderId: order.id }).find((p) => p.type === "weightLabor")).toBeUndefined();
  });

  it("멀티스톤 + 스펙 없음 → weightLabor 태스크 → 벤더 제출 시 스펙 자동 등록 + 견적 자동 발송", () => {
    const { order } = createIntake({
      name: "E", contact: "e@x.com", productLine: "multi", category: "earrings", styleId: "EARR-001",
      metal: "14ky", conditional: {}, multiSpec: { meleeSpec: "1.2mm x 12", overallDims: "8mm", arrangement: "", standard: "" }, termsAccepted: true,
    });
    expect(listQuotes(order.id).length).toBe(0);
    const pr = listProcurements({ orderId: order.id }).find((p) => p.type === "weightLabor");
    expect(pr.status).toBe("open");
    submitWeightLabor(pr.id, { estWeightG: 2.4, lossIncluded: true, laborUsd: 70, meleeUsd: 30, leadDays: 9, assumptions: "" });
    expect(listStyleSpecs("EARR-001").some((sp) => sp.metal === "14ky" && sp.status === "approved")).toBe(true);
    const q = listQuotes(order.id)[0];
    expect(q.status).toBe("sent");
    expect(q.nonMetalUsd).toBe(100);
  });
});

describe("자동 공개 — 벤치마크 자동가", () => {
  it("완결 후보는 벤치마크 자동가로 즉시 공개, 불완전 후보는 보류(체크리스트)", () => {
    const { order } = createIntake(solitaireForm);
    const pr = listProcurements({ orderId: order.id }).find((p) => p.type === "diamondCandidates");
    const [full, held] = submitCandidates(pr.id, [
      { igiNo: "LG-A1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/a.png" },
      { igiNo: "LG-A2", shape: "round", carat: 1.5, color: "D", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 540 }, // 이미지 없음
    ]);
    // round 1.50-1.99 = 320 × 1.3 = 416 $/ct → 416 × 1.5 × 1.8 = 1123
    expect(full.published).toBe(true);
    expect(full.customerPriceUsd).toBe(1123);
    expect(held.published).toBe(false);
    expect(dailyChecklist().heldCandidates).toContain(held.id);
  });

  it("무효 후보(비공개·품절) 선택은 스토어 레벨 차단", () => {
    const { order } = createIntake(solitaireForm);
    const pr = listProcurements({ orderId: order.id }).find((p) => p.type === "diamondCandidates");
    const [held] = submitCandidates(pr.id, [
      { igiNo: "LG-H1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500 },
    ]);
    expect(() => selectCandidate(held.id, "customer")).toThrow("notSelectable");
  });

  it("배치 만료 시 태스크 종료 + 미판매 후보 자동 비공개 (매뉴얼 §6.2)", () => {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: "2020-01-01", batchValidUntil: "2020-01-10", brief: "expired" });
    const [c] = submitCandidates(pr.id, [
      { igiNo: "LG-X1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/x.png" },
    ]);
    expect(c.published).toBe(true);
    supplierTasks("u-supplier1"); // 진입 시 lazy 스윕
    expect(getProcurement(pr.id).status).toBe("closed");
    expect(getCandidate(c.id).published).toBe(false);
    expect(() => selectCandidate(c.id, "customer")).toThrow("notSelectable");
  });
});

describe("풀 체인 — 어드민 터치포인트는 입금 확인 ②회 + 수령 ①회뿐", () => {
  it("인테이크 → … → DELIVERED 전 구간 자동 연결", () => {
    const { order } = createIntake(solitaireForm);
    const supplier = getSettings().defaultSupplierId;

    // 벤더: 후보 제출 (자동 공개) → 고객: 선택 → 벤더: 재고 확인 → 자동 락 + 자동 견적 발송
    const candPr = listProcurements({ orderId: order.id }).find((p) => p.type === "diamondCandidates");
    const [cand] = submitCandidates(candPr.id, [
      { igiNo: "LG-F1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/f.png" },
    ]);
    selectCandidate(cand.id, "customer");
    const stockPr = listProcurements({ orderId: order.id }).find((p) => p.type === "stockConfirm");
    submitStockConfirm(stockPr.id, true);
    const quote = listQuotes(order.id)[0];
    expect(quote.status).toBe("sent"); // SPEC-000002 (RING-001/18kw) 재사용 — 어드민 손 안 거침
    expect(quote.internal.diamondCostUsd).toBe(500);

    // 고객: 수락 → [어드민 ①] 디파짓 확인 → CAD 태스크 자동 발행
    acceptQuote(quote.id, "customer");
    expect(dailyChecklist().depositWait).toContain(order.id);
    markDepositReceived(order.id);
    const cadPr1 = listProcurements({ orderId: order.id }).find((p) => p.type === "cad");
    expect(cadPr1.status).toBe("open");
    expect(cadPr1.supplierId).toBe(supplier);

    // 벤더: CAD 제출 → 고객: 핀 수정 요청 → 새 CAD 태스크 자동 발행 (핀 동봉)
    submitCadForPr(cadPr1.id, "/cad-v1.png");
    const r1 = listCadReviews(order.id)[0];
    decideCad(r1.id, { decision: "minorRevision", annotations: [{ pinId: 1, x: 30, y: 60, part: "band", chipKey: "thinner", value: 1.6 }] }, "customer");
    const cadPr2 = listProcurements({ orderId: order.id }).filter((p) => p.type === "cad").find((p) => p.status === "open");
    expect(cadPr2).toBeTruthy();
    expect(cadPr2.brief).toContain("minor revision");
    const task = supplierTasks(supplier).find((x) => x.id === cadPr2.id);
    expect(task.revision.annotations[0].chipKey).toBe("thinner"); // 핀이 벤더 브리프로

    // 벤더: V2 제출 → 고객: 승인 → PRODUCTION + QC 태스크 자동 발행
    submitCadForPr(cadPr2.id, "/cad-v2.png");
    const r2 = listCadReviews(order.id)[0];
    decideCad(r2.id, { decision: "approved" }, "customer");
    expect(getOpsOrder(order.id).status).toBe("PRODUCTION");
    const qcPr = listProcurements({ orderId: order.id }).find((p) => p.type === "qc");
    expect(qcPr.status).toBe("open");

    // 벤더: QC 제출 → 실중량 자동 정산 + 고객 최종 컨펌 → BALANCE
    const balBefore = listQuotes(order.id).find((q) => q.status === "accepted").balanceUsd;
    submitQcForPr(qcPr.id, { video: "/final.mp4", cert: "/igi.png", actualWeightG: 4.5 });
    const accepted = listQuotes(order.id).find((q) => q.status === "accepted");
    expect(accepted.actualWeightG).toBe(4.5);
    expect(accepted.balanceUsd).toBe(balBefore + Math.round(0.3 * 85 * 1.08));
    confirmFinal(order.id, "customer");
    expect(getOpsOrder(order.id).status).toBe("BALANCE");

    // [어드민 ②] 잔금 확인 → ship 태스크 자동 발행 → 벤더 운송장 제출 → SHIPPING
    expect(dailyChecklist().balanceWait).toContain(order.id);
    markBalanceReceived(order.id);
    expect(dailyChecklist().balanceWait).not.toContain(order.id);
    const shipPr = listProcurements({ orderId: order.id }).find((p) => p.type === "ship");
    expect(shipPr.brief).toContain(getSettings().shipToAddress);
    submitShipment(shipPr.id, { trackingNo: "TRK-9001" });
    expect(getOpsOrder(order.id).status).toBe("SHIPPING");
    expect(listMilestones(order.id).find((m) => m.stage === "oceanShipment").clientUpdate).toBe("TRK-9001");

    // [어드민 ③] 실물 수령 → 완료
    markOrderDelivered(order.id);
    expect(getOpsOrder(order.id).status).toBe("DELIVERED");
    expect(listMilestones(order.id).find((m) => m.stage === "deliveredArchived").status).toBe("done");
  });
});

describe("모니터링 — 미디어 피드와 숨김", () => {
  it("피드에 레퍼런스·CAD가 모이고, 레퍼런스 숨김은 벤더 브리프에서 제외된다", () => {
    const feed = mediaFeed();
    expect(feed.some((m) => m.feedKind === "reference" && m.id === "REF-000001")).toBe(true);
    expect(feed.some((m) => m.feedKind === "cad" && m.id === "CADR-000001")).toBe(true);
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-25", brief: "x" });
    expect(JSON.stringify(supplierTasks("u-supplier2"))).toContain("lineup-band.png");
    hideMedia("reference", "REF-000001", "IN-000001");
    expect(JSON.stringify(supplierTasks("u-supplier2"))).not.toContain("lineup-band.png");
  });

  it("CAD 숨김 → 포털에서 제외 + 미결정 버전이면 벤더 태스크 재오픈", () => {
    expect(portalView("DM-000002", { queryCode: "H3WT-8RVK" }).cad).toBeTruthy();
    hideMedia("cad", "CADR-000001");
    expect(portalView("DM-000002", { queryCode: "H3WT-8RVK" }).cad).toBeNull();
    expect(getProcurement("PR-000002").status).toBe("open"); // 벤더 재제출 유도
  });

  it("역할별 배지 카운트 — 벤더는 열린 태스크 수", () => {
    const before = pendingCount({ id: "u-supplier1", role: "supplier" });
    createIntake(solitaireForm); // 기본 벤더에게 태스크 자동 발행
    expect(pendingCount({ id: "u-supplier1", role: "supplier" })).toBe(before + 1);
  });
});
