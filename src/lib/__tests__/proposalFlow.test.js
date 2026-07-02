import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, createProcurement, submitCandidates, toggleShortlist, submitDiamondSelection,
  createQuote, sendQuote, acceptQuote, updateQuoteProposal, reportDepositSent,
  markDepositReceived, portalView, getOpsOrder, listMilestones, getSettings, listQuotes,
} from "../store.js";

beforeEach(() => resetDB());

const ORDER = "DM-000001";

// 표준 셋업: 후보 제출 → 고객 셀렉션 → 견적 생성
function setupQuote() {
  const pr = createProcurement(ORDER, { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: "d", brief: "" });
  const [cand] = submitCandidates(pr.id, [
    { igiNo: "IGI-P1", shape: "round", carat: 1.52, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI",
      procurementCostUsd: 500, image: "/a.png", video: "/a.mp4" },
  ]);
  toggleShortlist(cand.id, "customer");
  submitDiamondSelection(ORDER, "customer");
  const quote = createQuote(ORDER, { estWeightG: 4, metalRefUsdPerG: 85, lossRatePct: 8, nonMetalUsd: 300 });
  return { quote, cand };
}

describe("확정 제안(proposal) 필드", () => {
  it("createQuote는 proposal 필드를 초기화한다", () => {
    const { quote } = setupQuote();
    expect(quote.proposalMedia).toEqual([]);
    expect(quote.stoneSpec).toBeNull();
    expect(quote.substitutionNote).toBe("");
    expect(quote.depositReportedAt).toBeNull();
  });

  it("updateQuoteProposal은 미디어(최대 5)·스펙·대체 안내문을 저장한다", () => {
    const { quote } = setupQuote();
    const media = Array.from({ length: 7 }, (_, i) => ({ kind: "image", src: `/m${i}.png` }));
    updateQuoteProposal(quote.id, {
      proposalMedia: media,
      stoneSpec: { shape: "round", carat: 1.52, color: "E", clarity: "VS1", igiNo: "IGI-P1" },
      substitutionNote: "동급 대체 가능",
    });
    const saved = listQuotesRaw(quote.id);
    expect(saved.proposalMedia).toHaveLength(5);
    expect(saved.stoneSpec.igiNo).toBe("IGI-P1");
    expect(saved.substitutionNote).toBe("동급 대체 가능");
  });

  it("sendQuote는 stoneSpec/미디어가 비어 있으면 확정 후보에서 채운다", () => {
    const { quote } = setupQuote();
    sendQuote(quote.id);
    const saved = listQuotesRaw(quote.id);
    expect(saved.stoneSpec).toMatchObject({ shape: "round", carat: 1.52, color: "E", clarity: "VS1", igiNo: "IGI-P1" });
    expect(saved.proposalMedia.length).toBeGreaterThan(0);
  });
});

// portalView를 거치지 않은 원본 quote 확인용
function listQuotesRaw(quoteId) {
  return listQuotes(ORDER).find((q) => q.id === quoteId);
}

describe("고객 프로젝션 — breakdown 미노출", () => {
  it("portalView.quote는 허용 필드만 담고, candidates는 반환하지 않는다", () => {
    const { quote } = setupQuote();
    sendQuote(quote.id);
    const order = getOpsOrder(ORDER);
    const view = portalView(ORDER, { queryCode: order.queryCode });
    const allowed = [
      "id", "status", "totalUsd", "depositUsd", "balanceUsd", "validUntil", "leadDays",
      "proposalMedia", "stoneSpec", "substitutionNote", "depositReportedAt",
    ].sort();
    expect(Object.keys(view.quote).sort()).toEqual(allowed);
    expect(view.quote.metalAmountUsd).toBeUndefined();
    expect(view.quote.nonMetalUsd).toBeUndefined();
    expect(view.quote.diamondAmountUsd).toBeUndefined();
    expect(view.quote.estWeightG).toBeUndefined();
    expect(view.quote.internal).toBeUndefined();
    expect(view.candidates).toBeUndefined();
    expect(view.selected).toBeDefined(); // 락된 스톤 표시는 유지 (여기선 null)
  });
});

describe("디파짓 셀프 리포트 → 어드민 확인", () => {
  it("accepted 견적만 리포트 가능, 마일스톤 waitingClient, 중복 리포트는 무시", () => {
    const { quote } = setupQuote();
    sendQuote(quote.id);
    reportDepositSent(quote.id, "customer"); // sent 상태 — 무시
    expect(listQuotesRaw(quote.id).depositReportedAt).toBeNull();

    acceptQuote(quote.id, "customer");
    reportDepositSent(quote.id, "customer");
    const first = listQuotesRaw(quote.id).depositReportedAt;
    expect(first).toBeTruthy();
    const ms = listMilestones(ORDER).find((m) => m.stage === "depositReceived");
    expect(ms.status).toBe("waitingClient");
    expect(ms.publishToClient).toBe(true);

    reportDepositSent(quote.id, "customer"); // 중복 — 타임스탬프 유지
    expect(listQuotesRaw(quote.id).depositReportedAt).toBe(first);

    markDepositReceived(ORDER);
    expect(getOpsOrder(ORDER).status).toBe("CAD");
    expect(listMilestones(ORDER).find((m) => m.stage === "depositReceived").status).toBe("done");
  });
});

describe("결제 설정", () => {
  it("settings.payment(zelle/venmo/note)가 시드된다", () => {
    const pay = getSettings().payment;
    expect(pay).toBeDefined();
    expect(pay).toHaveProperty("zelle");
    expect(pay).toHaveProperty("venmo");
    expect(pay).toHaveProperty("note");
  });
});
