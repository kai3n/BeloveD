import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, createIntake, getOpsOrder, createProcurement, submitCandidates,
  reviewCandidate, publishCandidate, toggleShortlist, submitDiamondSelection, lockCandidate, createQuote, sendQuote,
  acceptQuote, markDepositReceived, addCadVersion, decideCad, listMilestones, recordActualWeight,
  portalView, listCadReviews, dailyChecklist, setCandidateAvailability, listCandidates, listProcurements, listQuotes,
  createProxyDiamondCandidate, listCustomerActions, publishFinalMedia, confirmFinal, respondCustomerAction,
  rejectDiamondCandidates, rejectFinalConfirmation, createCustomerAction, saveOpsStyle, listOpsStyles, deleteOpsStyle,
  updateShippingAddress, isShippingAddressComplete,
} from "../store.js";

beforeEach(() => resetDB());

describe("ops store — 매뉴얼 풀 플로우", () => {
  it("새 스타일 ID는 삭제된 중복 seed ID를 재사용하지 않는다", () => {
    const created = saveOpsStyle({
      category: "ring",
      subcategory: "engagementRing",
      name: { en: "QA Temporary Ring" },
      estWeightG: 4.1,
      laborUsd: 90,
      leadDays: 12,
      media: [{ kind: "image", src: "https://example.com/qa-ring.jpg" }],
    });

    expect(created.id).toMatch(/^RING-\d{3}$/);
    expect(["RING-008", "RING-010", "RING-011", "RING-012", "RING-013", "RING-014"]).not.toContain(created.id);
    expect(listOpsStyles().some((style) => style.id === created.id)).toBe(true);

    deleteOpsStyle(created.id);
    expect(listOpsStyles().some((style) => style.id === created.id)).toBe(false);
  });

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

  it("찜 → 견적/디파짓 단계 제출 → 재고확인 PR 없이 quote 액션이 열린다", () => {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    const [a, b] = submitCandidates(pr.id, [
      { igiNo: "X1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/a.png" },
      { igiNo: "X2", shape: "round", carat: 1.5, color: "D", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 520, image: "/b.png" },
    ]);
    publishCandidate(a.id, 1100); publishCandidate(b.id, 1200);
    toggleShortlist(a.id, "customer");
    expect(listCustomerActions("DM-000001", true).some((action) => action.type === "diamondSelection")).toBe(true);
    submitDiamondSelection("DM-000001", "customer");
    expect(listCandidates({ orderId: "DM-000001" }).find((c) => c.id === a.id).selectionSubmittedAt).toBeTruthy();
    expect(getOpsOrder("DM-000001").status).toBe("QUOTATION");
    expect(getOpsOrder("DM-000001").selectedDiamondId).toBeNull();
    expect(listCustomerActions("DM-000001", true).some((action) => action.type === "diamondSelection")).toBe(false);
    // 견적은 초안까지 자동 — 어드민이 발송하기 전에는 고객 액션이 없다
    expect(listCustomerActions("DM-000001", true).some((action) => action.type === "quoteAcceptance")).toBe(false);
    expect(listCustomerActions("DM-000001").find((action) => action.type === "diamondSelection")).toMatchObject({
      status: "done",
      decision: "submitted",
      response: "submitted",
    });
    expect(listMilestones("DM-000001").find((m) => m.stage === "diamondLocked")).toMatchObject({
      status: "waitingClient",
      publishToClient: false,
    });
    submitDiamondSelection("DM-000001", "customer"); // 재요청 — 중복 quote/PR 발행 금지
    const open = listProcurements({ orderId: "DM-000001" }).filter((p) => p.type === "stockConfirm" && p.status === "open");
    expect(open.length).toBe(0);
    expect(listQuotes("DM-000001").filter((q) => q.status === "draft")).toHaveLength(1);
    sendQuote(listQuotes("DM-000001")[0].id); // 어드민 발송 → 고객 컨펌 액션 오픈
    expect(listCustomerActions("DM-000001", true).some((action) => action.type === "quoteAcceptance")).toBe(true);
    expect(listQuotes("DM-000001").filter((q) => q.status === "sent")).toHaveLength(1);
  });

  it("후보 제출 → 검수 → publish → 고객 선택 → 디파짓 후 락", () => {
    // batchValidUntil은 항상 미래여야 함 — 고정 날짜는 달력이 지나면 테스트가 저절로 깨진다
    const futureBatchDate = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier2", dueDate: "2026-06-20", batchValidUntil: futureBatchDate, brief: "b" });
    const [cand] = submitCandidates(pr.id, [{ igiNo: "LG-X1", shape: "round", carat: 1.48, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 520 }]);
    expect(cand.id).toMatch(/^DIA-DM-000001-\d{2}$/);
    reviewCandidate(cand.id, "recommended");
    publishCandidate(cand.id, 1150);
    toggleShortlist(cand.id, "customer");
    submitDiamondSelection("DM-000001", "customer");
    expect(listProcurements({ orderId: "DM-000001" }).some((p) => p.type === "stockConfirm" && p.status === "open")).toBe(false);
    expect(getOpsOrder("DM-000001").selectedDiamondId).toBeNull();
    const quote = listQuotes("DM-000001")[0];
    expect(quote.status).toBe("draft");
    sendQuote(quote.id); // 어드민이 제품 초안 발송
    expect(listCustomerActions("DM-000001", true).find((action) => action.type === "quoteAcceptance")).toMatchObject({
      status: "open",
    });
    acceptQuote(quote.id, "customer");
    markDepositReceived("DM-000001");
    const order = getOpsOrder("DM-000001");
    expect(order.selectedDiamondId).toBe(cand.id);
    expect(order.status).toBe("CAD");
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

  it("배송주소는 디파짓 전 견적 수락 단계에서 저장되고 포털에 노출된다", () => {
    expect(isShippingAddressComplete({ recipientName: "Jiwon" })).toBe(false);
    const address = updateShippingAddress("DM-000001", {
      recipientName: "Jiwon Kim",
      phone: "+1 213-555-0100",
      addressLine1: "550 S Hill St",
      addressLine2: "Suite 1100",
      city: "Los Angeles",
      region: "CA",
      postalCode: "90013",
      country: "USA",
      notes: "Signature required",
    }, "customer");

    expect(isShippingAddressComplete(address)).toBe(true);
    expect(getOpsOrder("DM-000001").shippingAddress).toMatchObject({
      recipientName: "Jiwon Kim",
      postalCode: "90013",
      country: "USA",
    });
    expect(portalView("DM-000001", { queryCode: "QX7K-M9P2" }).order.shippingAddress).toMatchObject({
      addressLine1: "550 S Hill St",
      city: "Los Angeles",
    });
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
    expect(v.candidates).toBeUndefined(); // 확정 제안 flow: 후보 비교는 고객 미노출
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
    expect(c.waitingClient).toEqual([]); // 새 flow 시드: 고객 대기 마일스톤 없음
    expect(c.lowCandidates).toContain("DM-000001"); // published 2 < 3
    // 제안 초안 대기: 스톤 지정 → 초안 생성 → 발송 전이면 집계에 잡힌다
    toggleShortlist("DIA-DM-000001-01", "ops");
    submitDiamondSelection("DM-000001", "ops");
    expect(dailyChecklist().proposalDrafts).toContain("DM-000001");
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
    expect(view.candidates).toBeUndefined();
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

    // 확정 제안 flow: 후보·선택 액션은 고객 포털에 노출되지 않는다 (내부 데이터로만 유지)
    const view = portalView(order.id, { queryCode: order.queryCode });
    expect(view.actions.some((a) => a.type === "diamondSelection")).toBe(false);
    expect(view.candidates).toBeUndefined();
    expect(listCandidates({ orderId: order.id }).find((c) => c.id === candidate.id).media).toHaveLength(5);

    const secondCandidate = createProxyDiamondCandidate(order.id, {
      shape: "round",
      carat: "1",
      color: "E",
      clarity: "VS1",
      media: mediaSix,
    }, "ops");
    expect(secondCandidate.media).toHaveLength(5);
    expect(listCandidates({ orderId: order.id }).find((c) => c.id === secondCandidate.id).media).toHaveLength(5);
  });

  it("디자인(CAD) 업로드는 고객 게이트 없이 기록되고 제작으로 자동 진행된다", () => {
    // 제품 초안 수락이 디자인 승인을 겸한다 — cadReview 고객 액션은 더 이상 생성되지 않는다
    expect(listCustomerActions("DM-000002", true).filter((a) => a.type === "cadReview")).toHaveLength(0);

    const review = addCadVersion("DM-000002", {
      supplierId: "ops-proxy",
      note: "Updated setting render for the record.",
      media: [
        { kind: "image", src: "/vendor/cad-v2-front.png", name: "cad-v2-front.png" },
        { kind: "video", src: "/vendor/cad-v2-spin.mp4", name: "cad-v2-spin.mp4" },
      ],
    });

    expect(review.version).toBe(2);
    expect(review.media).toHaveLength(2);
    expect(review.decision).toBe("approved"); // 자동 승인 — 기록용

    expect(listCustomerActions("DM-000002", true).filter((a) => a.type === "cadReview")).toHaveLength(0);
    expect(getOpsOrder("DM-000002").status).toBe("PRODUCTION");

    const view = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(view.cad.version).toBe(2); // 최신 CAD는 기록으로 포털에 노출
    expect(view.actions.filter((a) => a.type === "cadReview")).toHaveLength(0);
  });

  it("고객 액션 반려는 사유와 최대 5개 첨부를 저장한다", () => {
    publishFinalMedia("DM-000002", { media: [{ kind: "image", src: "/final.png" }], note: "", cert: "", actualWeightG: "" });
    const action = listCustomerActions("DM-000002", true).find((a) => a.type === "finalConfirmation");
    const rejected = respondCustomerAction(action.id, {
      decision: "rejected",
      reason: "Make the prongs lower and soften the side profile.",
      attachments: mediaSix,
    }, "customer");

    expect(rejected.status).toBe("rejected");
    expect(rejected.decision).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Make the prongs lower and soften the side profile.");
    expect(rejected.responseAttachments).toHaveLength(5);
    expect(listCustomerActions("DM-000002", true).filter((a) => a.type === "finalConfirmation")).toHaveLength(0);
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
