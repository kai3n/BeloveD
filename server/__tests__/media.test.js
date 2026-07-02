import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { __resetRateLimit } from "../rateLimit.js";

const app = createApp();
beforeEach(() => __resetRateLimit());

describe("미디어 presigned 업로드", () => {
  it("R2 미설정 시 503 MEDIA_NOT_CONFIGURED", async () => {
    const res = await request(app).post("/v1/media/upload-url")
      .send({ scope: "review", contentType: "image/jpeg", size: 1000 });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("MEDIA_NOT_CONFIGURED");
  });

  it("R2 설정 시 서명 URL 발급 + 퍼블릭 URL 매핑", async () => {
    Object.assign(process.env, {
      R2_ACCOUNT_ID: "acc", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "sec",
      R2_BUCKET: "beloved-media", R2_PUBLIC_URL: "https://pub-test.r2.dev",
    });
    try {
      const res = await request(app).post("/v1/media/upload-url")
        .send({ scope: "review", contentType: "video/mp4", size: 5_000_000 });
      expect(res.status).toBe(201);
      expect(res.body.uploadUrl).toContain("beloved-media.acc.r2.cloudflarestorage.com/review/");
      expect(res.body.uploadUrl).not.toContain("checksum"); // 브라우저 PUT 호환
      expect(res.body.publicUrl).toMatch(/^https:\/\/pub-test\.r2\.dev\/review\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{24}\.mp4$/);
      // 검증: 잘못된 타입/크기/스코프
      expect((await request(app).post("/v1/media/upload-url").send({ scope: "review", contentType: "application/pdf", size: 10 })).status).toBe(400);
      expect((await request(app).post("/v1/media/upload-url").send({ scope: "review", contentType: "image/jpeg", size: 200_000_000 })).status).toBe(400);
      expect((await request(app).post("/v1/media/upload-url").send({ scope: "hack", contentType: "image/jpeg", size: 10 })).status).toBe(400);
    } finally {
      for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]) delete process.env[k];
    }
  });
});
