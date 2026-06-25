import { ApiError } from "./errors.js";

// Dependency-light in-memory fixed-window rate limiter.
// Keyed by an arbitrary string (typically req.ip, optionally + email).
// Not distributed/persistent — adequate for a single-process MVP; swap for a
// shared store (Redis) if the API is horizontally scaled.

const buckets = new Map(); // key -> { count, resetAt }

// Test-only: clear all windows so the suite isn't tripped by earlier requests.
export function __resetRateLimit() {
  buckets.clear();
}

// Returns an Express middleware enforcing `limit` requests per `windowMs`
// per key. `keyFn(req)` derives the bucket key (defaults to req.ip).
export function rateLimit({ limit, windowMs, keyFn } = {}) {
  const max = Number(limit);
  const win = Number(windowMs);
  const derive = typeof keyFn === "function" ? keyFn : (req) => req.ip;

  return function rateLimiter(req, _res, next) {
    const now = Date.now();
    const key = `${derive(req)}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + win };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return next(new ApiError("RATE_LIMITED", 429));
    }
    next();
  };
}
