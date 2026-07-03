import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { recordEvents } from "./activityRepository.js";

const MINUTE = 60_000;
const MAX_BATCH = 25;

// 방문자 이벤트 수집 — fire-and-forget 배치. sendBeacon은 text/plain으로
// 올 수 있어 app.js에서 이 경로만 express.text를 먼저 태운다.
export function activityRouter() {
  const r = Router();
  r.post("/", rateLimit({ limit: 60, windowMs: MINUTE }), async (req, res, next) => {
    try {
      const sessionId = req.cookies?.bd_aid;
      if (!sessionId) throw new ApiError("VALIDATION_ERROR", 400, "bd_aid required");
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const events = body.events;
      if (!Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH) {
        throw new ApiError("VALIDATION_ERROR", 400, "events must be 1..25");
      }
      await recordEvents({ sessionId, userAgent: req.get("user-agent") || null, events });
      res.status(204).end();
    } catch (e) {
      next(e instanceof SyntaxError ? new ApiError("INVALID_JSON", 400) : e);
    }
  });
  return r;
}
