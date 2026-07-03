import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { truncateCustomerCore } from "./helpers.js";
import { drainMail } from "../mailer.js";
import { __resetRateLimit } from "../rateLimit.js";
import { query } from "../db.js";

const app = createApp();
const intakeBody = { email: "new@test.com", name: "Jiwon", locale: "ko", category: "ring", termsAccepted: true };

beforeEach(async () => { await truncateCustomerCore(); __resetRateLimit(); drainMail(); });

describe("POST /v1/intakes", () => {
  it("주문 생성 + 로케일 확인 메일 1통", async () => {
    const res = await request(app).post("/v1/intakes").send(intakeBody);
    expect(res.status).toBe(201);
    expect(res.body.orderCode).toMatch(/^BD-\d{6}$/);
    expect(res.body.stage).toBe("OPS_REVIEW");
    const mails = drainMail();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("new@test.com");
    expect(mails[0].type).toBe("order_received");
    expect(mails[0].subject).toContain("접수");
  });

  it("같은 Idempotency-Key 재요청은 같은 주문·메일 1통", async () => {
    const key = "test-key-1";
    const a = await request(app).post("/v1/intakes").set("Idempotency-Key", key).send(intakeBody);
    const b = await request(app).post("/v1/intakes").set("Idempotency-Key", key).send(intakeBody);
    expect(b.status).toBe(201);
    expect(b.body.orderCode).toBe(a.body.orderCode);
    expect(drainMail()).toHaveLength(1);
    const c = await request(app).post("/v1/intakes").set("Idempotency-Key", key).send({ ...intakeBody, name: "다른값" });
    expect(c.status).toBe(409);
    expect(c.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("동시 같은-키 요청도 주문 1건·메일 1통 (advisory lock 직렬화)", async () => {
    const key = "race-key-1";
    const [a, b] = await Promise.all([
      request(app).post("/v1/intakes").set("Idempotency-Key", key).send(intakeBody),
      request(app).post("/v1/intakes").set("Idempotency-Key", key).send(intakeBody),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.orderCode).toBe(b.body.orderCode);
    expect(drainMail()).toHaveLength(1);
    const { rows } = await query("select count(*)::int as n from customer_orders");
    expect(rows[0].n).toBe(1);
  });

  it("이메일 없으면 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/v1/intakes").send({ name: "NoMail" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
