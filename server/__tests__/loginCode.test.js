import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { __resetRateLimit } from "../rateLimit.js";
import { drainMail } from "../mailer.js";

const app = createApp();

beforeEach(async () => {
  __resetRateLimit();
  await query("delete from login_codes");
  await query("delete from sessions");
  drainMail();
});

async function requestCode(email = "otp@test.com") {
  const res = await request(app).post("/v1/auth/code").send({ email });
  expect(res.status).toBe(201);
  return res.body.devCode; // test env는 non-production이지만 NODE_ENV=test라 메일 로그 없음
}

describe("이메일 6자리 인증번호 로그인", () => {
  it("요청 → 검증 → 고객 세션 쿠키 발급", async () => {
    const code = await requestCode();
    expect(code).toMatch(/^\d{6}$/);
    // DB에는 해시만 저장
    const { rows } = await query("select code_hash from login_codes where email=$1", ["otp@test.com"]);
    expect(rows[0].code_hash).not.toContain(code);

    const res = await request(app).post("/v1/auth/code/verify").send({ email: "otp@test.com", code });
    expect(res.status).toBe(200);
    expect(res.body.principal).toBe("customer");
    const cookie = res.headers["set-cookie"]?.join(";") || "";
    expect(cookie).toContain("bd_sid=");
    expect(cookie).toContain("HttpOnly");
  });

  it("코드는 1회용 — 재사용 거부", async () => {
    const code = await requestCode();
    await request(app).post("/v1/auth/code/verify").send({ email: "otp@test.com", code }).expect(200);
    await request(app).post("/v1/auth/code/verify").send({ email: "otp@test.com", code }).expect(400);
  });

  it("5회 오입력 시 코드 폐기", async () => {
    const code = await requestCode();
    for (let i = 0; i < 5; i += 1) {
      await request(app).post("/v1/auth/code/verify").send({ email: "otp@test.com", code: "000111" }).expect(400);
    }
    // 6번째: 정답이어도 이미 폐기
    await request(app).post("/v1/auth/code/verify").send({ email: "otp@test.com", code }).expect(400);
  });

  it("새 코드를 요청하면 이전 코드는 무효", async () => {
    const first = await requestCode();
    __resetRateLimit();
    const second = await requestCode();
    await request(app).post("/v1/auth/code/verify").send({ email: "otp@test.com", code: first }).expect(400);
    __resetRateLimit();
    await request(app).post("/v1/auth/code/verify").send({ email: "otp@test.com", code: second }).expect(200);
  });

  it("요청 레이트리밋: 같은 이메일 분당 3회", async () => {
    await requestCode(); await requestCode(); await requestCode();
    const res = await request(app).post("/v1/auth/code").send({ email: "otp@test.com" });
    expect(res.status).toBe(429);
  });
});
