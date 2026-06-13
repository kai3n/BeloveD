import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, createIntake, getOpsOrder, createProcurement, supplierTasks, submitCandidates,
  reviewCandidate, publishCandidate, toggleShortlist, requestStockConfirm, submitStockConfirm, lockSelectedCandidate, lockCandidate, createQuote, sendQuote,
  acceptQuote, markDepositReceived, addCadVersion, decideCad, listMilestones, recordActualWeight,
  portalView, listCadReviews, dailyChecklist, setCandidateAvailability, listCandidates, listProcurements,
} from "../store.js";

beforeEach(() => resetDB());

describe("ops store — 매뉴얼 풀 플로우", () => {
  it("인테이크 → 주문 자동 생성 (DM ID, 쿼리코드, 상태 규칙)", () => {
    const { order } = createIntake({ name: "Test", contact: "t@x.com", productLine: "solitaire", category: "ring", styleId: "RING-001", metal: "18kw", conditional: { ringSize: "7" }, requiredDate: "2026-09-01", country: "USA", termsAccepted: true });
    expect(order.id).toMatch(/^DM-\d{6}$/);
    expect(order.queryCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(order.status).toBe("STONE_SELECTION"); // 솔리테어 + 스타일 확정
    const { order: o2 } = createIntake({ name: "T2", contact: "c", productLine: "multi", category: "necklace", styleId: "NECK-001", metal: "18ky", conditional: {}, termsAccepted: true });
    expect(o2.status).toBe("QUOTATION"); // 멀티스톤 + 스펙 완성
    const { order: o3 } = createIntake({ name: "T3", contact: "c", productLine: "solitaire", category: "ring", styleId: "", metal: "18kw", conditional: {}, termsAccepted: true });
    expect(o3.status).toBe("STYLE_SELECTION");
  });

  it("서플라이어 태스크 뷰에 고객명·Order ID 미노출", () => {
    const tasks = supplierTasks("u-supplier1");
    expect(tasks.length).toBeGreaterThan(0);
    const json = JSON.stringify(tasks);
    expect(json).not.toContain("김지원");
    expect(json).not.toContain("DM-000001");
    expect(json).toContain("PR-000001");
  });

  it("벤더 태스크: 같은 주문은 같은 jobCode, 다른 주문은 다름 (Order ID 미노출)", () => {
    const tasks = supplierTasks("u-supplier1");
    const t1 = tasks.find((x) => x.id === "PR-000001"); // DM-000001
    const t2 = tasks.find((x) => x.id === "PR-000002"); // DM-000002
    expect(t1.jobCode).toMatch(/^JOB-[A-Z0-9]{4}$/);
    expect(t1.jobCode).not.toBe(t2.jobCode);
    expect(JSON.stringify(tasks)).not.toContain("DM-000001"); // 코드만, 주문번호 미노출
  });

  it("찜 → 재고확인 요청 → 같은 후보 재요청 시 중복 PR 안 생김", () => {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    const [a, b] = submitCandidates(pr.id, [
      { igiNo: "X1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/a.png" },
      { igiNo: "X2", shape: "round", carat: 1.5, color: "D", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 520, image: "/b.png" },
    ]);
    publishCandidate(a.id, 1100); publishCandidate(b.id, 1200);
    toggleShortlist(a.id, "customer");
    requestStockConfirm("DM-000001", "customer");
    requestStockConfirm("DM-000001", "customer"); // 재요청 — 중복 발행 금지
    const open = listProcurements({ orderId: "DM-000001" }).filter((p) => p.type === "stockConfirm" && p.status === "open");
    expect(open.length).toBe(1);
  });

  it("후보 제출 → 검수 → publish → 고객 선택 → 락 → QUOTATION", () => {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier2", dueDate: "2026-06-20", batchValidUntil: "2026-06-30", brief: "b" });
    const [cand] = submitCandidates(pr.id, [{ igiNo: "LG-X1", shape: "round", carat: 1.48, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 520 }]);
    expect(cand.id).toMatch(/^DIA-DM-000001-\d{2}$/);
    reviewCandidate(cand.id, "recommended");
    publishCandidate(cand.id, 1150);
    toggleShortlist(cand.id, "customer");
    requestStockConfirm("DM-000001", "customer");
    const sc = listProcurements({ orderId: "DM-000001" }).find((p) => p.type === "stockConfirm" && p.diamondId === cand.id);
    submitStockConfirm(sc.id, true);
    lockSelectedCandidate(cand.id, "customer");
    const order = getOpsOrder("DM-000001");
    expect(order.selectedDiamondId).toBe(cand.id);
    expect(order.status).toBe("QUOTATION");
    expect(listMilestones("DM-000001").find((m) => m.stage === "diamondLocked").status).toBe("done");
  });

  it("견적 스냅샷 + 수락 + 디파짓 → CAD, 실중량 정산", () => {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    const [cand] = submitCandidates(pr.id, [{ igiNo: "X", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500 }]);
    publishCandidate(cand.id, 1200);
    toggleShortlist(cand.id, "customer");
    lockCandidate(cand.id);
    const q = createQuote("DM-000001", { estWeightG: 4.2, metalRefUsdPerG: 85, lossRatePct: 8, nonMetalUsd: 250, internal: { multiplier: 1.8, diamondCostUsd: 500 } });
    expect(q.id).toBe("Q-DM-000001-V2"); // V1은 다이아 락 시점에 자동 발송된 견적 (어드민 최소 개입)
    expect(q.snapshot.benchmarkUsdPerCt).toBeGreaterThan(0);
    expect(q.totalUsd).toBe(q.diamondAmountUsd + q.metalAmountUsd + 250);
    sendQuote(q.id);
    acceptQuote(q.id, "customer");
    markDepositReceived("DM-000001");
    expect(getOpsOrder("DM-000001").status).toBe("CAD");
    const before = q.balanceUsd;
    const { delta } = recordActualWeight("DM-000001", 4.5);
    expect(delta).toBe(Math.round(0.3 * 85 * 1.08));
    expect(q.balanceUsd).toBe(before + delta);
  });

  it("CAD 버전 히스토리 불변 + 승인 → PRODUCTION", () => {
    const r1 = addCadVersion("DM-000002", { fileUrl: "/cad-v1.png", supplierId: "u-supplier1" });
    decideCad(r1.id, { decision: "minorRevision", feedback: ["체인 1cm 연장", "연락처 010-1111-2222"] }, "customer");
    expect(r1.feedback[1]).not.toContain("010-1111-2222"); // 마스킹
    const r2 = addCadVersion("DM-000002", { fileUrl: "/cad-v2.png", supplierId: "u-supplier1" });
    expect(r2.version).toBe(r1.version + 1);
    decideCad(r2.id, { decision: "approved" }, "customer");
    expect(getOpsOrder("DM-000002").status).toBe("PRODUCTION");
    expect(listCadReviews("DM-000002").length).toBeGreaterThanOrEqual(2);
    expect(listCadReviews("DM-000002").find((c) => c.version === r1.version).decision).toBe("minorRevision"); // 원본 보존
  });

  it("포털 보안: 쿼리코드 필요, 내부 필드 제외", () => {
    expect(portalView("DM-000001", {})).toBeNull();
    expect(portalView("DM-000001", { queryCode: "WRONG" })).toBeNull();
    const v = portalView("DM-000001", { queryCode: "QX7K-M9P2" });
    expect(v.order.internalNotes).toBeUndefined();
    expect(v.candidates.length).toBe(2); // published만 (3번 제외)
    const json = JSON.stringify(v);
    expect(json).not.toContain("procurementCostUsd");
    expect(json).not.toContain("supplierId");
    expect(json).not.toContain("multiplier");
  });

  it("Sold 후보는 즉시 비공개 (매뉴얼 §13)", () => {
    setCandidateAvailability("DIA-DM-000001-01", "sold");
    expect(listCandidates({ orderId: "DM-000001", publishedOnly: true }).length).toBe(1);
  });

  it("데일리 체크리스트 집계", () => {
    const c = dailyChecklist();
    expect(c.waitingClient).toContain("DM-000002");
    expect(c.lowCandidates).toContain("DM-000001"); // published 2 < 3
  });
});
