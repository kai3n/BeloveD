import { describe, expect, it } from "vitest";
import { adminStepGuard } from "../AdminLiveOrders.jsx";

const t = {
  blockedPrevious: "previous",
  waitQuoteApproval: "quote",
  waitDepositReport: "deposit",
  waitQcApproval: "qc",
  waitBalanceReport: "balance",
  addressRequired: "address",
};

const event = (type, data = {}) => ({ title: type, payload: { type, data } });

function guard(step, index, overrides = {}) {
  return adminStepGuard({
    step,
    index,
    order: { summary: {} },
    timeline: [],
    actions: [],
    changeRequest: null,
    t,
    ...overrides,
  });
}

describe("adminStepGuard", () => {
  it("prevents operators from skipping an earlier event", () => {
    expect(guard({ type: "production_started" }, 3)).toEqual({ available: false, reason: "previous" });
  });

  it("requires both proposal approval and a reported deposit before confirming receipt", () => {
    const base = { timeline: [event("proposal_sent")] };
    expect(guard({ type: "deposit_confirmed" }, 1, base).reason).toBe("quote");

    const approved = {
      ...base,
      actions: [{ kind: "QUOTE_ACCEPTANCE", status: "RESPONDED", respondedAt: "2026-07-10", responsePayload: { response: "APPROVE" } }],
    };
    expect(guard({ type: "deposit_confirmed" }, 1, approved).reason).toBe("deposit");

    expect(guard({ type: "deposit_confirmed" }, 1, {
      ...approved,
      timeline: [...base.timeline, event("payment_reported", { kind: "deposit" })],
    })).toEqual({ available: true, reason: "" });
  });

  it("requires a confirmed finished piece before requesting the balance", () => {
    const timeline = ["proposal_sent", "deposit_confirmed", "diamond_locked", "production_started", "qc_ready"].map(event);
    expect(guard({ type: "balance_requested" }, 5, { timeline }).reason).toBe("qc");
    expect(guard({ type: "balance_requested" }, 5, {
      timeline,
      actions: [{ kind: "FINAL_QC_CONFIRMATION", status: "RESPONDED", respondedAt: "2026-07-10", responsePayload: { response: "CONFIRM" } }],
    })).toEqual({ available: true, reason: "" });
  });

  it("requires a complete saved address before shipping", () => {
    const timeline = ["proposal_sent", "deposit_confirmed", "diamond_locked", "production_started", "qc_ready", "balance_requested", "balance_confirmed"].map(event);
    expect(guard({ type: "shipped" }, 7, { timeline }).reason).toBe("address");
    expect(guard({ type: "shipped" }, 7, {
      timeline,
      order: {
        summary: {
          shippingAddress: {
            recipientName: "A", phone: "1", addressLine1: "1 Main", city: "LA",
            region: "CA", postalCode: "90001", country: "US",
          },
        },
      },
    })).toEqual({ available: true, reason: "" });
  });
});
