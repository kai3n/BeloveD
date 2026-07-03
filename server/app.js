import express from "express";
import cookieParser from "cookie-parser";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { ApiError } from "./errors.js";
import { attachPrincipal, requireSameOrigin } from "./middleware.js";
import { query } from "./db.js";
import { authRouter } from "./authRoutes.js";
import { mediaRouter } from "./mediaRoutes.js";
import { customerRouter } from "./customerRoutes.js";
import { activityRouter } from "./activityRoutes.js";
import { adminActivityRouter } from "./adminActivityRoutes.js";
import { adminOrderRouter } from "./adminOrderRoutes.js";
import { reviewRouter } from "./reviewRoutes.js";
import { runActivityMaintenance } from "./activityMaintenance.js";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

export function createApp() {
  const app = express();
  // Trust exactly one proxy hop in prod so req.ip reflects the client for
  // rate limiting. PUBLIC_ORIGIN stays authoritative for link building, so a
  // spoofed X-Forwarded-Host cannot poison magic links (M5).
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(attachPrincipal);
  // CSRF/Origin check for cookie-authed state-changing /v1 requests (I5).
  app.use("/v1", requireSameOrigin);

  app.get("/v1/health", async (_req, res, next) => {
    try {
      const db = await query("select now() as now");
      res.json({ ok: true, databaseTime: db.rows[0].now });
    } catch (e) { next(e); }
  });

  app.use("/v1/auth", authRouter());
  app.use("/v1/media", mediaRouter());
  // sendBeacon 기본 Content-Type(text/plain) 대응 — activity 경로만 텍스트도 수용
  app.use("/v1/activity", express.text({ type: "text/plain", limit: "64kb" }));
  app.use("/v1/activity", activityRouter());
  app.use("/v1/admin", adminActivityRouter());
  app.use("/v1/admin", adminOrderRouter());

  // Vercel Cron 전용 — CRON_SECRET 불일치·미설정 시 404로 존재 자체를 숨긴다.
  app.get("/v1/internal/activity-maintenance", async (req, res, next) => {
    try {
      const secret = process.env.CRON_SECRET;
      if (!secret || req.get("authorization") !== `Bearer ${secret}`) {
        return next(new ApiError("NOT_FOUND", 404));
      }
      res.json(await runActivityMaintenance());
    } catch (e) { next(e); }
  });

  app.use("/v1", reviewRouter());
  app.use("/v1", customerRouter());

  // Any unmatched /v1 route returns the JSON error contract (never the SPA).
  app.use("/v1", (_req, _res, next) => next(new ApiError("NOT_FOUND", 404)));

  // Serve built SPA (prod). In dev, Vite serves the SPA and proxies /v1 here.
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/v1\/).*/, (_req, res) => res.sendFile(join(distDir, "index.html")));
  }

  // JSON error contract
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  });

  return app;
}
