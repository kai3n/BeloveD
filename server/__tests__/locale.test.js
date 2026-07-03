// 고객 언어(customers.locale) 관통 — 로그인·인테이크에서 저장되고, OTP·주문 메일이 그 언어로 나간다
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { __resetRateLimit } from "../rateLimit.js";
import { drainMail } from "../mailer.js";
import { truncateCustomerCore } from "./helpers.js";

const app = createApp();

beforeEach(async () => {
  __resetRateLimit();
  await truncateCustomerCore();
  await query("delete from login_codes");
  await query("delete from sessions");
  drainMail();
});

async function loginWithLocale(email, locale) {
  const res = await request(app).post("/v1/auth/code").send({ email, locale });
  expect(res.status).toBe(201);
  const verify = await request(app).post("/v1/auth/code/verify").send({ email, code: res.body.devCode, locale });
  expect(verify.status).toBe(200);
}

describe("OTP 로그인 — 언어 저장·메일 로컬라이즈", () => {
  it("요청 시 보낸 locale로 OTP 메일이 나가고, 검증 시 고객 locale이 저장된다", async () => {
    const res = await request(app).post("/v1/auth/code").send({ email: "ko@test.com", locale: "ko" });
    expect(res.status).toBe(201);
    // dev sink는 meta를 평면으로 저장 — OTP 메일이 요청 locale로 발송됐는지 확인
    const mail = drainMail().find((m) => m.type === "login_code");
    expect(mail.locale).toBe("ko");

    const verify = await request(app).post("/v1/auth/code/verify")
      .send({ email: "ko@test.com", code: res.body.devCode, locale: "ko" });
    expect(verify.status).toBe(200);
    const { rows } = await query("select locale from customers where email=$1", ["ko@test.com"]);
    expect(rows[0].locale).toBe("ko");
  });

  it("사이트 언어를 바꿔 재로그인하면 locale이 갱신된다 (마지막 언어 우선)", async () => {
    await loginWithLocale("switch@test.com", "ko");
    await loginWithLocale("switch@test.com", "zh");
    const { rows } = await query("select locale from customers where email=$1", ["switch@test.com"]);
    expect(rows[0].locale).toBe("zh");
  });

  it("이상한 locale은 en으로 폴백하고 기존 값은 건드리지 않는다", async () => {
    await loginWithLocale("weird@test.com", "xx");
    expect((await query("select locale from customers where email=$1", ["weird@test.com"])).rows[0].locale).toBe("en");
    await loginWithLocale("weird@test.com", "es");
    await loginWithLocale("weird@test.com", undefined);
    expect((await query("select locale from customers where email=$1", ["weird@test.com"])).rows[0].locale).toBe("es");
  });
});

describe("인테이크 제출 — 접수 메일이 고객 언어로 나간다", () => {
  it("locale=es 페이로드 → customers.locale=es + 스페인어 접수 메일", async () => {
    const res = await request(app).post("/v1/intakes").send({
      email: "es@test.com", name: "Sofia", locale: "es",
      category: "ring", productLine: "solitaire", termsAccepted: true,
      conditional: { ringSize: "6" },
    });
    expect(res.status).toBe(201);
    expect(res.body.orderCode).toMatch(/^BD-\d{6}$/);

    const { rows } = await query("select locale from customers where email=$1", ["es@test.com"]);
    expect(rows[0].locale).toBe("es");

    // 메일은 응답 후 fire-and-forget — 마이크로태스크 한 틱 대기
    await new Promise((r) => setTimeout(r, 50));
    const mail = drainMail().find((m) => m.type === "order_received");
    expect(mail).toBeTruthy();
    expect(mail.subject).toContain("Recibimos tu solicitud");
    expect(mail.to).toBe("es@test.com");
  });
});
