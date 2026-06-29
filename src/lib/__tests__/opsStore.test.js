import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, createIntake, getOpsOrder, createProcurement, submitCandidates,
  reviewCandidate, publishCandidate, toggleShortlist, requestStockConfirm, submitStockConfirm, lockSelectedCandidate, lockCandidate, createQuote, sendQuote,
  acceptQuote, markDepositReceived, addCadVersion, decideCad, listMilestones, recordActualWeight,
  portalView, listCadReviews, dailyChecklist, setCandidateAvailability, listCandidates, listProcurements,
  createProxyDiamondCandidate, listCustomerActions, publishFinalMedia, confirmFinal, respondCustomerAction,
  rejectDiamondCandidates, rejectFinalConfirmation, createCustomerAction,
} from "../store.js";

beforeEach(() => resetDB());

describe("ops store — 매뉴얼 풀 플로우", () => {
  it("인테이크 → 주문 자동 생성 (DM ID, 쿼리코드, 상태 규칙)", () => {
    const { order, intake } = createIntake({ name: "Test", contact: "t@x.com", productLine: "solitaire", category: "ring", subcategory: "engagementRing", styleId: "RING-001", metal: "18kw", conditional: { ringSize: "7" }, requiredDate: "2026-09-01", country: "USA", termsAccepted: true });
    expect(order.id).toMatch(/^DM-\d{6}$/);
    expect(order.queryCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(order.status).toBe("STONE_SELECTION"); // 솔리테어 + 스타일 확정
    expect(intake.subcategory).toBe("engagementRing");
    const { order: o2 } = createIntake({ name: "T2", contact: "c", productLine: "multi", category: "necklace", styleId: "NECK-001", metal: "18ky", conditional: {}, termsAccepted: true });
    expect(o2.status).toBe("QUOTATION"); // 멀티스톤 + 스펙 완성
    const { order: o3 } = createIntake({ name: "T3", contact: "c", productLine: "solitaire", category: "ring", styleId: "", metal: "18kw", conditional: {}, termsAccepted: true });
    expect(o3.status).toBe("STYLE_SELECTION");
  });

  it("찜 → 재고확인 요청 → 같은 후보 재요청 시 중복 PR 안 생김", () => {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    const [a, b] = submitCandidates(pr.id, [
      { igiNo: "X1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/a.png" },
      { igiNo: "X2", shape: "round", carat: 1.5, color: "D", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 520, image: "/b.png" },
    ]);
    publishCandidate(a.id, 1100); publishCandidate(b.id, 1200);
    toggleShortlist(a.id, "customer");
    expect(listCustomerActions("DM-000001", true).some((action) => action.type === "diamondSelection")).toBe(true);
    requestStockConfirm("DM-000001", "customer");
    expect(listCandidates({ orderId: "DM-000001" }).find((c) => c.id === a.id).selectionSubmittedAt).toBeTruthy();
    expect(listCustomerActions("DM-000001", true).some((action) => action.type === "diamondSelection")).toBe(false);
    expect(listCustomerActions("DM-000001").find((action) => action.type === "diamondSelection")).toMatchObject({
      status: "done",
      decision: "submitted",
      response: "submitted",
    });
    expect(listMilestones("DM-000001").find((m) => m.stage === "diamondLocked")).toMatchObject({
      status: "inProgress",
      publishToClient: false,
    });
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
    expect(listCustomerActions("DM-000001", true).find((action) => action.type === "diamondSelection")).toMatchObject({
      prompt: "Confirm the stock-checked diamond",
      status: "open",
    });
    lockSelectedCandidate(cand.id, "customer");
    const order = getOpsOrder("DM-000001");
    expect(order.selectedDiamondId).toBe(cand.id);
    expect(order.status).toBe("QUOTATION");
    expect(listCustomerActions("DM-000001", true).some((action) => action.type === "diamondSelection")).toBe(false);
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

  it("공개된 다이아 후보가 없으면 고객 포털에서 선택 액션을 숨긴다", () => {
    const { order } = createIntake({
      name: "No Candidate",
      contact: "none@example.com",
      productLine: "solitaire",
      category: "ring",
      subcategory: "engagementRing",
      styleId: "RING-001",
      metal: "18kw",
      conditional: { ringSize: "6" },
      stonePrefs: { shape: "princess", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI" },
      termsAccepted: true,
    });
    createCustomerAction(order.id, { type: "diamondSelection", prompt: "stale selection action" });

    const view = portalView(order.id, { queryCode: order.queryCode });
    expect(view.candidates).toHaveLength(0);
    expect(view.actions.some((a) => a.type === "diamondSelection")).toBe(false);
    expect(listProcurements({ orderId: order.id }).some((p) => p.type === "diamondCandidates")).toBe(true);
  });
});

describe("ops store — 운영자 프록시 고객 컨펌 플로우", () => {
  const mediaSix = [
    { kind: "image", src: "/vendor/stone-1.jpg", name: "stone-1.jpg" },
    { src: "/vendor/stone-2.mp4", name: "stone-2.mp4" },
    { kind: "image", src: "/vendor/stone-3.webp", name: "stone-3.webp" },
    { kind: "image", src: "/vendor/stone-4.png", name: "stone-4.png" },
    { kind: "video", src: "/vendor/stone-5.webm", name: "stone-5.webm" },
    { kind: "image", src: "/vendor/stone-6.jpg", name: "stone-6.jpg" },
  ];

  it("프록시 다이아 업로드는 최대 5개 미디어만 공개하고 고객 선택 액션을 만든다", () => {
    const { order } = createIntake({
      name: "Proxy Test",
      contact: "proxy@example.com",
      productLine: "solitaire",
      category: "ring",
      styleId: "RING-001",
      metal: "18kw",
      conditional: { ringSize: "7" },
      requiredDate: "2026-09-01",
      country: "USA",
      termsAccepted: true,
    });

    const candidate = createProxyDiamondCandidate(order.id, {
      shape: "oval",
      carat: "1.23",
      color: "D",
      clarity: "VVS2",
      growth: "HPHT",
      lab: "GIA",
      customerPriceUsd: "1320",
      procurementCostUsd: "820",
      clientNote: "Vendor says this stone is eye clean.",
      media: mediaSix,
    }, "ops");

    expect(candidate.id).toMatch(new RegExp(`^DIA-${order.id}-\\d{2}$`));
    expect(candidate.media).toHaveLength(5);
    expect(candidate.media[1].kind).toBe("video");
    expect(candidate.published).toBe(true);
    expect(candidate.customerPriceUsd).toBe(1320);

    const actions = listCustomerActions(order.id, true);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "diamondSelection", status: "open" });
    expect(actions[0].media).toHaveLength(5);

    const view = portalView(order.id, { queryCode: order.queryCode });
    expect(view.actions[0].type).toBe("diamondSelection");
    expect(view.candidates.find((c) => c.id === candidate.id).media).toHaveLength(5);

    const secondCandidate = createProxyDiamondCandidate(order.id, {
      shape: "round",
      carat: "1",
      color: "E",
      clarity: "VS1",
      media: mediaSix,
    }, "ops");
    expect(secondCandidate.media).toHaveLength(5);
    expect(portalView(order.id, { queryCode: order.queryCode }).candidates.find((c) => c.id === secondCandidate.id).media).toHaveLength(5);
  });

  it("디자인 초안 재업로드는 이전 CAD 고객 액션을 닫고 최신 버전만 고객에게 대기시킨다", () => {
    const firstOpen = listCustomerActions("DM-000002", true).filter((a) => a.type === "cadReview");
    expect(firstOpen).toHaveLength(1);

    const review = addCadVersion("DM-000002", {
      supplierId: "ops-proxy",
      note: "Updated setting render for approval.",
      media: [
        { kind: "image", src: "/vendor/cad-v2-front.png", name: "cad-v2-front.png" },
        { kind: "video", src: "/vendor/cad-v2-spin.mp4", name: "cad-v2-spin.mp4" },
      ],
    });

    expect(review.version).toBe(2);
    expect(review.media).toHaveLength(2);

    const allCadActions = listCustomerActions("DM-000002").filter((a) => a.type === "cadReview");
    expect(allCadActions).toHaveLength(2);
    expect(allCadActions.find((a) => a.id === firstOpen[0].id).status).toBe("cancelled");

    const openCadActions = listCustomerActions("DM-000002", true).filter((a) => a.type === "cadReview");
    expect(openCadActions).toHaveLength(1);
    expect(openCadActions[0]).toMatchObject({ prompt: "CAD V2", status: "open" });
    expect(openCadActions[0].media).toHaveLength(2);

    const view = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(view.cad.version).toBe(2);
    expect(view.actions.filter((a) => a.type === "cadReview")).toHaveLength(1);
  });

  it("고객 액션 반려는 사유와 최대 5개 첨부를 저장한다", () => {
    const action = listCustomerActions("DM-000002", true).find((a) => a.type === "cadReview");
    const rejected = respondCustomerAction(action.id, {
      decision: "rejected",
      reason: "Make the prongs lower and soften the side profile.",
      attachments: mediaSix,
    }, "customer");

    expect(rejected.status).toBe("rejected");
    expect(rejected.decision).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Make the prongs lower and soften the side profile.");
    expect(rejected.responseAttachments).toHaveLength(5);
    expect(listCustomerActions("DM-000002", true).filter((a) => a.type === "cadReview")).toHaveLength(0);
  });

  it("고객이 다이아 후보를 반려하면 선택 상태를 비우고 반려 사유를 주문에 남긴다", () => {
    const { order } = createIntake({
      name: "Reject Stone",
      contact: "reject@example.com",
      productLine: "solitaire",
      category: "ring",
      styleId: "RING-001",
      metal: "18kw",
      conditional: { ringSize: "6" },
      termsAccepted: true,
    });
    const candidate = createProxyDiamondCandidate(order.id, {
      shape: "round",
      carat: "1.1",
      color: "F",
      clarity: "VS1",
      media: mediaSix,
    }, "ops");
    toggleShortlist(candidate.id, "customer");

    const rejected = rejectDiamondCandidates(order.id, {
      reason: "Please send more elongated options.",
      attachments: mediaSix,
    }, "customer");

    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Please send more elongated options.");
    expect(rejected.responseAttachments).toHaveLength(5);
    expect(listCandidates({ orderId: order.id }).every((c) => c.clientSelection === "none")).toBe(true);
    expect(getOpsOrder(order.id).status).toBe("STONE_SELECTION");
    expect(listMilestones(order.id).find((m) => m.stage === "diamondLocked")).toMatchObject({
      status: "blocked",
      publishToClient: true,
    });
  });

  it("완성품 프록시 업로드는 최종 컨펌 액션과 공개 마일스톤을 만들고 고객 컨펌 후 BALANCE로 이동한다", () => {
    const first = publishFinalMedia("DM-000002", {
      media: mediaSix,
      note: "Final QC video and photos are ready.",
      cert: "IGI inscription verified.",
      actualWeightG: "4.4",
    }, "ops");

    expect(first.media).toHaveLength(5);
    expect(first.type).toBe("finalConfirmation");
    expect(getOpsOrder("DM-000002").status).toBe("QC");
    expect(listMilestones("DM-000002").find((m) => m.stage === "finalQcVideo")).toMatchObject({
      status: "done",
      publishToClient: true,
      link: "/vendor/stone-1.jpg",
    });

    const second = publishFinalMedia("DM-000002", {
      media: [{ kind: "video", src: "/vendor/final-latest.mp4", name: "final-latest.mp4" }],
      note: "Latest finished-piece media.",
    }, "ops");

    const finalActions = listCustomerActions("DM-000002").filter((a) => a.type === "finalConfirmation");
    expect(finalActions.find((a) => a.id === first.id).status).toBe("cancelled");
    expect(listCustomerActions("DM-000002", true).filter((a) => a.type === "finalConfirmation")).toEqual([second]);

    const view = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(view.finalAction.id).toBe(second.id);
    expect(view.finalAction.media[0].src).toBe("/vendor/final-latest.mp4");

    confirmFinal("DM-000002", "customer");
    expect(second.status).toBe("done");
    expect(getOpsOrder("DM-000002").status).toBe("BALANCE");
  });

  it("완성품 컨펌 반려는 QC 상태로 유지하고 반려 첨부를 보존한다", () => {
    publishFinalMedia("DM-000002", {
      media: mediaSix,
      note: "Final QC video and photos are ready.",
      cert: "IGI inscription verified.",
      actualWeightG: "4.4",
    }, "ops");

    const rejected = rejectFinalConfirmation("DM-000002", {
      reason: "The polish near the clasp needs another pass.",
      attachments: mediaSix,
    }, "customer");

    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("The polish near the clasp needs another pass.");
    expect(rejected.responseAttachments).toHaveLength(5);
    expect(getOpsOrder("DM-000002").status).toBe("QC");
    expect(listMilestones("DM-000002").find((m) => m.stage === "finalQcVideo")).toMatchObject({
      status: "blocked",
      publishToClient: true,
    });
  });
});
