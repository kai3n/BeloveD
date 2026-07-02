import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { createUploadUrl, r2Configured } from "./media.js";

const MINUTE = 60 * 1000;

export function mediaRouter() {
  const r = Router();

  // presigned 업로드 URL 발급 — 익명 인테이크 레퍼런스도 허용하되 타이트하게 제한.
  // 실제 파일은 브라우저 → R2 직행이라 서버 대역폭·바디 제한과 무관하다.
  r.post("/upload-url",
    rateLimit({ limit: 20, windowMs: MINUTE }),
    async (req, res, next) => {
    try {
      const { scope, contentType, size } = req.body || {};
      if (typeof scope !== "string" || typeof contentType !== "string") {
        throw new ApiError("VALIDATION_ERROR", 400);
      }
      const signed = await createUploadUrl({ scope, contentType, size });
      res.status(201).json({ ok: true, ...signed });
    } catch (e) { next(e); }
  });

  r.get("/status", (_req, res) => {
    res.json({ configured: r2Configured() });
  });

  return r;
}
