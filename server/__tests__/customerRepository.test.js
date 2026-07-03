import { describe, it, expect, beforeEach } from "vitest";
import { ApiError as RepoApiError, createDraftIntake, submitIntake, recordOrderEvent, EVENT_TRANSITIONS } from "../customerRepository.js";
import { ApiError } from "../errors.js";
import { query } from "../db.js";
import { truncateCustomerCore } from "./helpers.js";

beforeEach(async () => { await truncateCustomerCore(); });

describe("customerRepository", () => {
  it("ApiError는 errors.js와 동일 클래스다 (라우트 에러 핸들러 instanceof 계약)", () => {
    expect(RepoApiError).toBe(ApiError);
  });

  it("submitIntake는 created 플래그와 notify(email/locale)를 반환한다", async () => {
    const draft = await createDraftIntake({ email: "ko@test.com", name: "지원", locale: "ko", category: "ring" });
    const first = await submitIntake(draft.intakeId);
    expect(first.created).toBe(true);
    expect(first.notify).toEqual({ email: "ko@test.com", locale: "ko" });
    expect(first.orderCode).toMatch(/^BD-\d{6}$/);
    const again = await submitIntake(draft.intakeId); // 멱등 — 기존 주문 반환
    expect(again.created).toBe(false);
    expect(again.orderCode).toBe(first.orderCode);
  });
});

describe("recordOrderEvent", () => {
  async function makeOrder() {
    const draft = await createDraftIntake({ email: "ev@test.com", locale: "zh", category: "ring" });
    return submitIntake(draft.intakeId);
  }

  it("타임라인 기록 + stage/phase/waiting_on 전이 + notify 반환", async () => {
    const order = await makeOrder();
    const r = await recordOrderEvent(order.orderCode, "shipped", { tracking: "1Z999" });
    expect(r.stage).toBe("SHIPPING");
    expect(r.notify).toEqual({ email: "ev@test.com", locale: "zh" });
    expect(r.eventId).toMatch(/^TL-\d{6}$/);
    const row = (await query("select stage, phase, waiting_on from customer_orders where order_code = $1", [order.orderCode])).rows[0];
    expect(row).toEqual({ stage: "SHIPPING", phase: "DELIVERY", waiting_on: "EXTERNAL" });
    const tl = (await query("select payload from customer_timeline_events order by id desc limit 1")).rows[0];
    expect(tl.payload).toEqual({ type: "shipped", data: { tracking: "1Z999" } });
  });

  it("없는 주문은 404, 미지원 type은 400", async () => {
    await expect(recordOrderEvent("BD-999999", "shipped", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    const order = await makeOrder();
    await expect(recordOrderEvent(order.orderCode, "nope", {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
