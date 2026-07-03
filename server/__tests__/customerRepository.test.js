import { describe, it, expect, beforeEach } from "vitest";
import { ApiError as RepoApiError, createDraftIntake, submitIntake } from "../customerRepository.js";
import { ApiError } from "../errors.js";
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
