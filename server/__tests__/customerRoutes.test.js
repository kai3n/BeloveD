import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { truncateCustomerCore } from "./helpers.js";
import { drainMail } from "../mailer.js";
import { __resetRateLimit } from "../rateLimit.js";
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";

const app = createApp();
const intakeBody = { email: "new@test.com", name: "Jiwon", locale: "ko", category: "ring", termsAccepted: true };

beforeEach(async () => { await truncateCustomerCore(); __resetRateLimit(); drainMail(); });

async function adminAgent() {
  await query("insert into admin_users (email, name, password_hash) values ($1,$2,$3) on conflict (email) do nothing",
    ["ops@test.com", "Ops", hashPassword("admin12345")]);
  const agent = request.agent(app);
  const login = await agent.post("/v1/auth/password").send({ email: "ops@test.com", password: "admin12345" });
  expect(login.status).toBe(200);
  return agent;
}

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

describe("POST /v1/admin/orders/:orderCode/events", () => {
  it("어드민 세션 없으면 401", async () => {
    const res = await request(app).post("/v1/admin/orders/BD-000001/events").send({ type: "shipped" });
    expect(res.status).toBe(401);
  });

  it("이벤트 기록 + stage 전이 + 상태 메일", async () => {
    const intake = await request(app).post("/v1/intakes").send(intakeBody);
    drainMail(); // 접수 메일 비우기
    const agent = await adminAgent();
    const res = await agent.post(`/v1/admin/orders/${intake.body.orderCode}/events`)
      .send({ type: "shipped", data: { tracking: "1Z999" } });
    expect(res.status).toBe(201);
    expect(res.body.stage).toBe("SHIPPING");
    const mails = drainMail();
    expect(mails).toHaveLength(1);
    expect(mails[0].type).toBe("order_shipped");
    expect(mails[0].subject).toContain("발송"); // intakeBody locale=ko
  });

  it("received·미지원 type은 400", async () => {
    const agent = await adminAgent();
    for (const type of ["received", "bogus"]) {
      const res = await agent.post("/v1/admin/orders/BD-000001/events").send({ type });
      expect(res.status).toBe(400);
    }
  });
});
