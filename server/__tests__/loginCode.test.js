import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { __resetRateLimit } from "../rateLimit.js";
import { drainMail, sendLoginCode } from "../mailer.js";
import { exposeDevAuthSecrets } from "../authRoutes.js";

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
  it("개발 인증 비밀값은 테스트 또는 명시적 로컬 opt-in에서만 노출", () => {
    expect(exposeDevAuthSecrets({ NODE_ENV: "production", EXPOSE_DEV_AUTH_SECRETS: "true" })).toBe(false);
    expect(exposeDevAuthSecrets({ NODE_ENV: "development" })).toBe(false);
    expect(exposeDevAuthSecrets({ NODE_ENV: "development", EXPOSE_DEV_AUTH_SECRETS: "true" })).toBe(true);
    expect(exposeDevAuthSecrets({ NODE_ENV: "test" })).toBe(true);
  });

  it("로컬 메일 sink는 OTP와 수신자를 콘솔 로그에 남기지 않는다", async () => {
    const previousEnv = process.env.NODE_ENV;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.NODE_ENV = "development";
    try {
      await sendLoginCode("private@example.test", "654321", "en");
      const output = log.mock.calls.flat().join(" ");
      expect(output).not.toContain("654321");
      expect(output).not.toContain("private@example.test");
    } finally {
      process.env.NODE_ENV = previousEnv;
      log.mockRestore();
      drainMail();
    }
  });

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

  it("durable 발급 상한: 같은 이메일 시간당 5회 초과 시 429 (IP 회전으로 in-memory 우회 가정)", async () => {
    // __resetRateLimit로 in-memory 한도를 매번 비워도 DB 상한이 발급을 막는다
    for (let i = 0; i < 5; i += 1) {
      __resetRateLimit();
      await request(app).post("/v1/auth/code").send({ email: "cap@test.com" }).expect(201);
    }
    __resetRateLimit();
    const res = await request(app).post("/v1/auth/code").send({ email: "cap@test.com" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});
