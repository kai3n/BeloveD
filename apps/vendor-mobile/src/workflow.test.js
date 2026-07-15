import { describe, expect, it } from "vitest";
import { transitionWorkflow, workflowTimeline, workflowView } from "./workflow.js";

describe("vendor fulfillment workflow", () => {
  it("runs the happy path from assignment through completion", () => {
    let state = "ASSIGNED";
    for (const event of [
      "ACCEPT", "SUBMIT_STONE", "APPROVE", "LOCK_DIAMOND", "OPEN_ESTIMATE",
      "SUBMIT_ESTIMATE", "APPROVE", "PREPARE_QUOTE", "CUSTOMER_ACCEPT_QUOTE", "CONFIRM_DEPOSIT",
      "SUBMIT_CAD", "APPROVE", "APPROVE", "CONFIRM_PRODUCTION", "SUBMIT_PROGRESS",
      "APPROVE", "SUBMIT_QC", "APPROVE", "CONFIRM_HANDOFF", "COMPLETE",
    ]) state = transitionWorkflow(state, event, { productLine: "solitaire" });
    expect(state).toBe("COMPLETED");
    expect(workflowView(state).progress).toBe(100);
    expect(workflowTimeline(state).every((step) => step.done)).toBe(true);
  });

  it("skips candidate selection and diamond locking for multi-stone orders", () => {
    const state = transitionWorkflow("ASSIGNED", "ACCEPT", { productLine: "multi" });
    expect(state).toBe("ESTIMATE_REQUIRED");
    const timeline = workflowTimeline(state, { productLine: "multi" });
    expect(timeline.slice(1, 4).every((step) => step.skipped && step.done)).toBe(true);
  });

  it("requires a new version after Operations requests changes", () => {
    let state = transitionWorkflow("CANDIDATES_REQUIRED", "SUBMIT_STONE");
    state = transitionWorkflow(state, "REQUEST_CHANGES");
    expect(workflowView(state).task).toMatchObject({ type: "STONE", state: "changes" });
    expect(transitionWorkflow(state, "SUBMIT_STONE")).toBe("CANDIDATES_REVIEW");
  });

  it("rejects role actions that do not belong to the current state", () => {
    expect(() => transitionWorkflow("ASSIGNED", "APPROVE")).toThrow(/Invalid vendor workflow transition/);
  });
});
