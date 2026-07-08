import { describe, expect, it } from "vitest";
import { stepGate } from "../orderFlow.js";

// 실주문 콘솔 FLOW의 게이트 판정 — 이전 스텝 발사 + 고객 컨펌 승인까지 받아야 다음 스텝이 열린다
const FLOW = [
  { type: "proposal_sent", action: { kind: "QUOTE_ACCEPTANCE" } },
  { type: "deposit_confirmed" },
  { type: "diamond_locked" },
  { type: "qc_ready", action: { kind: "FINAL_QC_CONFIRMATION" } },
  { type: "balance_requested" },
];

const fired = (...types) => new Set(types);
const action = (kind, status, response, createdAt) => ({
  kind, status, createdAt,
  responsePayload: response ? { response } : null,
});

describe("stepGate", () => {
  it("첫 스텝은 항상 열려 있다", () => {
    expect(stepGate(FLOW, 0, fired(), []).locked).toBe(false);
  });

  it("이전 스텝이 발사되지 않으면 잠긴다 (순차 게이트)", () => {
    const g = stepGate(FLOW, 2, fired("proposal_sent"), [
      action("QUOTE_ACCEPTANCE", "RESPONDED", "APPROVE", "2026-07-01T00:00:00Z"),
    ]);
    expect(g.locked).toBe(true);
    expect(g.awaitingCustomer).toBe(false);
  });

  it("제안 발송 후 고객 승인 전에는 디파짓 수령이 잠긴다", () => {
    const g = stepGate(FLOW, 1, fired("proposal_sent"), [
      action("QUOTE_ACCEPTANCE", "OPEN", null, "2026-07-01T00:00:00Z"),
    ]);
    expect(g.locked).toBe(true);
    expect(g.awaitingCustomer).toBe(true);
  });

  it("고객이 APPROVE하면 디파짓 수령이 열린다", () => {
    const g = stepGate(FLOW, 1, fired("proposal_sent"), [
      action("QUOTE_ACCEPTANCE", "RESPONDED", "APPROVE", "2026-07-01T00:00:00Z"),
    ]);
    expect(g.locked).toBe(false);
  });

  it("고객이 수정 요청(REQUEST_CHANGES)하면 계속 잠긴다", () => {
    const g = stepGate(FLOW, 1, fired("proposal_sent"), [
      action("QUOTE_ACCEPTANCE", "RESPONDED", "REQUEST_CHANGES", "2026-07-01T00:00:00Z"),
    ]);
    expect(g.locked).toBe(true);
    expect(g.awaitingCustomer).toBe(true);
  });

  it("수정 제안 재발송(새 OPEN 액션) 뒤에도 승인 전까지 잠긴다", () => {
    const g = stepGate(FLOW, 1, fired("proposal_sent"), [
      action("QUOTE_ACCEPTANCE", "RESPONDED", "REQUEST_CHANGES", "2026-07-01T00:00:00Z"),
      action("QUOTE_ACCEPTANCE", "OPEN", null, "2026-07-02T00:00:00Z"),
    ]);
    expect(g.locked).toBe(true);
  });

  it("수정 요청 이후 최신 응답이 APPROVE면 열린다", () => {
    const g = stepGate(FLOW, 1, fired("proposal_sent"), [
      action("QUOTE_ACCEPTANCE", "RESPONDED", "REQUEST_CHANGES", "2026-07-01T00:00:00Z"),
      action("QUOTE_ACCEPTANCE", "RESPONDED", "APPROVE", "2026-07-02T00:00:00Z"),
    ]);
    expect(g.locked).toBe(false);
  });

  it("완성품 QC 발송 후 고객 CONFIRM 전에는 잔금 요청이 잠긴다", () => {
    const approved = [action("QUOTE_ACCEPTANCE", "RESPONDED", "APPROVE", "2026-07-01T00:00:00Z")];
    const firedAll = fired("proposal_sent", "deposit_confirmed", "diamond_locked", "qc_ready");
    const before = stepGate(FLOW, 4, firedAll, [
      ...approved,
      action("FINAL_QC_CONFIRMATION", "OPEN", null, "2026-07-03T00:00:00Z"),
    ]);
    expect(before.locked).toBe(true);
    expect(before.awaitingCustomer).toBe(true);
    const after = stepGate(FLOW, 4, firedAll, [
      ...approved,
      action("FINAL_QC_CONFIRMATION", "RESPONDED", "CONFIRM", "2026-07-03T00:00:00Z"),
    ]);
    expect(after.locked).toBe(false);
  });
});
