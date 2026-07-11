import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, listChips, saveChip,
  createIntake, getIntake, reviewReferenceMedia, createProcurement,
  addCadVersion, decideCad, freeRevisionsLeft, portalView, getSettings,
  submitCadForPr, listCadReviews,
  submitQcForPr, confirmFinal, getOpsOrder, listCustomerActions, updateOpsOrder,
  toggleShortlist, submitDiamondSelection, submitStockConfirm, getCandidate, listProcurements, listMilestones, listCandidates, submitCandidates,
  createProxyDiamondCandidate, publishFinalMedia, listOrderMessages, sendOrderMessage,
  listQuotes, acceptQuote, markDepositReceived,
} from "../store.js";

const dstr = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

beforeEach(() => resetDB());

describe("visual store — 칩 카탈로그", () => {
  it("시드에 칩 카탈로그가 있고 부위 필터가 동작한다", () => {
    expect(listChips().length).toBeGreaterThanOrEqual(10);
    const bandChips = listChips({ part: "band" });
    expect(bandChips.some((c) => c.key === "thinner")).toBe(true);
    expect(bandChips.some((c) => c.key === "prong6")).toBe(false); // 프롱 전용
  });

  it("saveChip — 비활성화하면 목록에서 빠진다", () => {
    const chip = listChips().find((c) => c.key === "polishMatte");
    saveChip({ ...chip, active: false });
    expect(listChips().some((c) => c.key === "polishMatte")).toBe(false);
  });
});

describe("visual store — 레퍼런스 미디어와 벤더 브리프", () => {
  it("인테이크 레퍼런스는 즉시 approved 저장(사후 모니터링), 무효 주석은 드랍", () => {
    const { intake } = createIntake({
      name: "Ref", contact: "r@x.com", productLine: "solitaire", category: "ring", styleId: "RING-001",
      metal: "18kw", conditional: { ringSize: "6" }, termsAccepted: true,
      referenceMedia: [{ kind: "image", src: "/up/a.png", annotations: [
        { pinId: 1, x: 40, y: 40, part: "band", chipKey: "thinner", value: 1.6 },
        { pinId: 2, x: 40, y: 40, part: "band", chipKey: "prong6" }, // 칩-부위 불일치 → 드랍
      ] }],
    });
    const saved = getIntake(intake.id).referenceMedia;
    expect(saved[0].status).toBe("approved"); // 즉시 전달 — 어드민 사전 승인 게이트 없음
    expect(saved[0].id).toMatch(/^REF-\d{6}$/);
    expect(saved[0].annotations.length).toBe(1);
  });

});

describe("visual store — 구조화 피드백과 수정 한도", () => {
  it("주석은 검증 후 버전 레코드에 불변 저장", () => {
    const r1 = addCadVersion("DM-000002", { fileUrl: "/v1.png", supplierId: "u-supplier1" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [
      { pinId: 1, x: 20, y: 20, part: "chain", chipKey: "thinner", value: 1.2 },
      { pinId: 2, x: 200, y: 20, part: "chain", chipKey: "thinner", value: 1.2 }, // 좌표 무효 → 드랍
    ] }, "customer");
    expect(r1.annotations.length).toBe(1);
    expect(r1.feeAppliedUsd).toBe(0); // 1회차 무료
  });

  it("무료 한도 초과 시 accepted 견적 잔금에 designChangeFeeUsd 가산", () => {
    // DM-000002는 시드에 accepted 견적(잔금 808 — 디파짓 30%) 보유
    const fee = getSettings().designChangeFeeUsd;
    const r1 = addCadVersion("DM-000002", { fileUrl: "/v1.png", supplierId: "u-supplier1" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [] }, "customer");
    expect(freeRevisionsLeft("DM-000002")).toBe(0);
    const r2 = addCadVersion("DM-000002", { fileUrl: "/v2.png", supplierId: "u-supplier1" });
    decideCad(r2.id, { decision: "minorRevision", annotations: [] }, "customer");
    expect(r2.feeAppliedUsd).toBe(fee);
    const v = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(v.quote.balanceUsd).toBe(808 + fee);
    expect(v.freeRevisionsLeft).toBe(0);
  });
});

describe("visual store — CAD 슬롯 제출", () => {
  it("슬롯 배열 제출 → media 보존, fileUrl은 첫 슬롯", () => {
    const pr = createProcurement("DM-000002", { type: "cad", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    submitCadForPr(pr.id, [
      { slot: "render360", kind: "video", src: "/r360.mp4" },
      { slot: "side", kind: "image", src: "/side.png" },
    ]);
    const r = listCadReviews("DM-000002")[0];
    expect(r.media.length).toBe(2);
    expect(r.media[0].slot).toBe("render360");
    expect(r.fileUrl).toBe("/r360.mp4");
  });

  it("레거시 문자열 제출도 동작", () => {
    const pr = createProcurement("DM-000002", { type: "cad", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    submitCadForPr(pr.id, "/single.png");
    expect(listCadReviews("DM-000002")[0].fileUrl).toBe("/single.png");
  });
});

describe("visual store — 최종 실물 컨펌", () => {
  it("QC 제출 → finalConfirmation 액션 생성(영상 링크), 컨펌 → BALANCE + 증거 보존", () => {
    updateOpsOrder("DM-000002", { status: "PRODUCTION" });
    const pr = createProcurement("DM-000002", { type: "qc", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    submitQcForPr(pr.id, { video: "/final.mp4", cert: "/igi.png", actualWeightG: 4.3 });
    expect(getOpsOrder("DM-000002").status).toBe("QC");
    const action = listCustomerActions("DM-000002", true).find((a) => a.type === "finalConfirmation");
    expect(action.link).toBe("/final.mp4");
    confirmFinal("DM-000002", "customer");
    expect(getOpsOrder("DM-000002").status).toBe("BALANCE");
    const closed = listCustomerActions("DM-000002").find((a) => a.type === "finalConfirmation");
    expect(closed.status).toBe("done");
    expect(closed.respondedAt).toBeTruthy(); // 컨펌 증거 (타임스탬프)
    const v = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(v.finalAction).toBeNull(); // 컨펌 후 open 액션 없음
  });
});

describe("visual store — 운영자 프록시 업로드", () => {
  it("운영자가 올린 다이아 후보는 내부 데이터로 유지되고 고객 포털에는 노출되지 않는다", () => {
    const c = createProxyDiamondCandidate("DM-000001", {
      shape: "oval", carat: 1.23, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI",
      igiNo: "LG-PROXY-1", customerPriceUsd: 390, procurementCostUsd: 240,
      clientNote: "Vendor sent a clean oval option.",
      media: [{ kind: "image", src: "/proxy-stone.png" }, { kind: "video", src: "/proxy-stone.mp4" }],
    });
    expect(c.published).toBe(true);
    expect(c.stockConfirmed).toBe(false);
    expect(c.media.length).toBe(2);
    // 확정 제안 flow: 후보 비교/선택은 고객에게 보이지 않는다 — 제안(quote)으로만 전달
    const view = portalView("DM-000001", { queryCode: "QX7K-M9P2" });
    expect(view.candidates).toBeUndefined();
    expect(view.actions.some((a) => a.type === "diamondSelection")).toBe(false);

    toggleShortlist(c.id, "customer");
    submitDiamondSelection("DM-000001", "customer");
    const selected = listCandidates({ orderId: "DM-000001" }).find((x) => x.id === c.id);
    expect(selected.clientSelection).toBe("selected");
    expect(selected.selectionSubmittedAt).toBeTruthy();
    // 견적은 초안까지 자동 — 발송 전에는 고객 액션 없음 (어드민이 제품 초안 완성 후 발송)
    expect(listCustomerActions("DM-000001", true).some((a) => a.type === "quoteAcceptance")).toBe(false);
    expect(listQuotes("DM-000001").some((q) => q.status === "draft")).toBe(true);
  });

  it("운영자가 올린 디자인과 완성품 미디어는 고객 승인 액션에 보존된다", () => {
    const cad = addCadVersion("DM-000002", {
      media: [{ kind: "image", src: "/cad-front.png" }, { kind: "video", src: "/cad-spin.mp4" }],
      note: "Review the prong height before production.",
      supplierId: "ops-proxy",
    });
    expect(cad.clientNote).toContain("prong height");
    let view = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(view.cad.media.length).toBe(2);
    expect(view.cad.clientNote).toContain("prong height");

    publishFinalMedia("DM-000002", {
      media: [{ kind: "image", src: "/finished-front.png" }, { kind: "video", src: "/finished-sparkle.mp4" }],
      note: "Final QC from the atelier.",
      cert: "IGI inscription matched",
    });
    const action = listCustomerActions("DM-000002", true).find((a) => a.type === "finalConfirmation");
    expect(action.media.length).toBe(2);
    expect(action.note).toContain("Final QC");
    view = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(view.finalAction.media.length).toBe(2);
    expect(view.finalAction.note).toContain("Final QC");
  });
});

describe("visual store — 주문 상담 채팅", () => {
  it("고객 메시지와 운영자 답변이 주문 포털에 보존된다", () => {
    const m1 = sendOrderMessage("DM-000001", {
      body: "Can I compare two stones?",
      actorRole: "customer",
      actorId: "guest",
      channel: "web",
    });
    const m2 = sendOrderMessage("DM-000001", {
      body: "Yes, we will keep both options in this workspace.",
      actorRole: "ops",
      actorId: "u-admin",
      channel: "web",
    });
    const messages = listOrderMessages("DM-000001");
    expect(messages.map((m) => m.id)).toEqual(expect.arrayContaining([m1.id, m2.id]));

    const view = portalView("DM-000001", { queryCode: "QX7K-M9P2" });
    expect(view.messages.map((m) => m.body)).toEqual(expect.arrayContaining([m1.body, m2.body]));
  });

  it("외부 채널 출처를 보존해 나중에 인스타/커뮤니티 어댑터와 연결할 수 있다", () => {
    sendOrderMessage("DM-000001", {
      body: "DM from Instagram",
      actorRole: "customer",
      channel: "instagram",
      externalThreadId: "ig-123",
    });

    const [message] = listOrderMessages("DM-000001", { channel: "instagram" });
    expect(message.channel).toBe("instagram");
    expect(message.externalThreadId).toBe("ig-123");
  });
});

describe("visual store — 스톤 선택: 디파짓 이후 다이아 락", () => {
  // 신선 배치(만료 여유) 후보
  function freshCand() {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: dstr(5), batchValidUntil: dstr(10), brief: "fresh" });
    return submitCandidates(pr.id, [{ igiNo: "LG-FRESH", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/f.png" }])[0];
  }
  // 만료 임박 후보도 고객 선택 후 별도 재고확인 없이 디파짓 단계로 간다
  function expiringCand() {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: dstr(1), batchValidUntil: dstr(1), brief: "expiring" });
    return submitCandidates(pr.id, [{ igiNo: "LG-EXP", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/e.png" }])[0];
  }

  it("찜 → 견적/디파짓 → 입금 확인 후 확정 락", () => {
    const c = freshCand();
    toggleShortlist(c.id, "customer");
    submitDiamondSelection("DM-000001", "customer");
    expect(listProcurements({ orderId: "DM-000001" }).some((p) => p.type === "stockConfirm" && p.status === "open")).toBe(false);
    expect(getCandidate(c.id).locked).toBeFalsy(); // 선택 제출만으로는 락 안 됨
    acceptQuote(listQuotes("DM-000001")[0].id, "customer");
    markDepositReceived("DM-000001");
    expect(getCandidate(c.id).locked).toBe(true);
    expect(getOpsOrder("DM-000001").status).toBe("CAD");
    expect(listMilestones("DM-000001").find((m) => m.stage === "diamondLocked").status).toBe("done");
  });

  it("만료 임박 후보도 디파짓 확인 전에는 락되지 않는다", () => {
    const c = expiringCand();
    toggleShortlist(c.id, "customer");
    submitDiamondSelection("DM-000001", "customer");
    expect(getCandidate(c.id).locked).toBe(false);
    acceptQuote(listQuotes("DM-000001")[0].id, "customer");
    markDepositReceived("DM-000001");
    expect(getCandidate(c.id).locked).toBe(true);
    expect(getOpsOrder("DM-000001").status).toBe("CAD");
  });

  it("레거시 재고확인에서 품절이면 sold·비공개·선택 초기화", () => {
    const c = expiringCand();
    toggleShortlist(c.id, "customer");
    const pr = createProcurement("DM-000001", { type: "stockConfirm", supplierId: "u-supplier1", dueDate: dstr(1), brief: c.igiNo, diamondId: c.id });
    submitStockConfirm(pr.id, false);
    expect(getCandidate(c.id).availability).toBe("sold");
    expect(getCandidate(c.id).published).toBe(false);
    expect(getCandidate(c.id).clientSelection).toBe("none");
  });
});
