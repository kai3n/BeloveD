import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, listChips, saveChip,
  createIntake, getIntake, reviewReferenceMedia, supplierTasks, createProcurement,
  addCadVersion, decideCad, freeRevisionsLeft, portalView, getSettings,
  submitCadForPr, listCadReviews,
  submitQcForPr, confirmFinal, getOpsOrder, listCustomerActions, updateOpsOrder,
  selectCandidate, submitStockConfirm, getCandidate, listProcurements, listMilestones, listCandidates, submitCandidates,
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

  it("벤더 태스크에는 승인 레퍼런스만 — hidden/고객명 미노출", () => {
    // 시드: IN-000001에 approved 1 + hidden 1
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-25", brief: "ring cad" });
    const tasks = supplierTasks("u-supplier2");
    const json = JSON.stringify(tasks);
    expect(json).toContain("lineup-band.png");          // approved
    expect(json).not.toContain("lineup-pendant.png");   // hidden (모니터링 숨김)
    expect(json).not.toContain("Jiwon Kim");            // 고객명 (시드)
    expect(json).not.toContain("DM-000001");
  });

  it("검수 승인/반려가 벤더 노출을 토글한다", () => {
    reviewReferenceMedia("IN-000001", "REF-000002", "approved");
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-25", brief: "x" });
    expect(JSON.stringify(supplierTasks("u-supplier2"))).toContain("lineup-pendant.png");
  });

  it("minorRevision 주석이 다음 CAD 태스크의 revision 브리프로 전달된다", () => {
    const r1 = addCadVersion("DM-000001", { fileUrl: "/cad-v1.png", supplierId: "u-supplier2" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [
      { pinId: 1, x: 30, y: 60, part: "band", chipKey: "thinner", value: 1.6 },
    ] }, "customer");
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-26", brief: "v2" });
    const task = supplierTasks("u-supplier2").find((x) => x.brief === "v2");
    expect(task.revision.fileUrl).toBe("/cad-v1.png");
    expect(task.revision.annotations[0].chipKey).toBe("thinner");
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
    // DM-000002는 시드에 accepted 견적(잔금 577) 보유
    const fee = getSettings().designChangeFeeUsd;
    const r1 = addCadVersion("DM-000002", { fileUrl: "/v1.png", supplierId: "u-supplier1" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [] }, "customer");
    expect(freeRevisionsLeft("DM-000002")).toBe(0);
    const r2 = addCadVersion("DM-000002", { fileUrl: "/v2.png", supplierId: "u-supplier1" });
    decideCad(r2.id, { decision: "minorRevision", annotations: [] }, "customer");
    expect(r2.feeAppliedUsd).toBe(fee);
    const v = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(v.quote.balanceUsd).toBe(577 + fee);
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

describe("visual store — 스톤 선택: 신선 배치 자동 / 만료임박 벤더확인", () => {
  // 신선 배치(만료 여유) 후보
  function freshCand() {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: dstr(5), batchValidUntil: dstr(10), brief: "fresh" });
    return submitCandidates(pr.id, [{ igiNo: "LG-FRESH", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/f.png" }])[0];
  }
  // 만료 임박(stockConfirmWithinDays 이내) 후보
  function expiringCand() {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: dstr(1), batchValidUntil: dstr(1), brief: "expiring" });
    return submitCandidates(pr.id, [{ igiNo: "LG-EXP", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/e.png" }])[0];
  }

  it("신선 배치 → 재고확인 없이 자동 락 + QUOTATION (벤더 라운드트립 제거)", () => {
    const c = freshCand();
    selectCandidate(c.id, "customer");
    expect(listProcurements({ orderId: "DM-000001" }).some((p) => p.type === "stockConfirm")).toBe(false);
    expect(getCandidate(c.id).locked).toBe(true);
    expect(getOpsOrder("DM-000001").status).toBe("QUOTATION");
    expect(listMilestones("DM-000001").find((m) => m.stage === "diamondLocked").status).toBe("done");
  });

  it("만료 임박 배치 → 벤더 재고확인 요청 (가격·OrderID 미노출)", () => {
    const c = expiringCand();
    selectCandidate(c.id, "customer");
    const pr = listProcurements({ orderId: "DM-000001" }).find((p) => p.type === "stockConfirm");
    expect(pr.diamondId).toBe(c.id);
    const task = supplierTasks("u-supplier1").find((t) => t.type === "stockConfirm" && t.diamond?.igiNo === "LG-EXP");
    expect(task).toBeTruthy();
    const json = JSON.stringify(task);
    expect(json).not.toContain("customerPriceUsd");
    expect(json).not.toContain("DM-000001");
  });

  it("만료 임박 → 재고확인 '있음' → 락 + QUOTATION", () => {
    const c = expiringCand();
    selectCandidate(c.id, "customer");
    const pr = listProcurements({ orderId: "DM-000001" }).find((p) => p.type === "stockConfirm");
    submitStockConfirm(pr.id, true);
    expect(getCandidate(c.id).locked).toBe(true);
    expect(getOpsOrder("DM-000001").status).toBe("QUOTATION");
  });

  it("만료 임박 → '품절' → sold·비공개·선택 초기화 (매뉴얼 §13)", () => {
    const c = expiringCand();
    selectCandidate(c.id, "customer");
    const pr = listProcurements({ orderId: "DM-000001" }).find((p) => p.type === "stockConfirm");
    submitStockConfirm(pr.id, false);
    expect(getCandidate(c.id).availability).toBe("sold");
    expect(getCandidate(c.id).published).toBe(false);
    expect(getCandidate(c.id).clientSelection).toBe("none");
  });
});
