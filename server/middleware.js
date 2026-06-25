import { getSession } from "./session.js";
import { ApiError } from "./errors.js";

export const COOKIE_CUSTOMER = "bd_sid";
export const COOKIE_ADMIN = "bd_admin";

export function setSessionCookie(res, name, session) {
  res.cookie(name, session.id, {
    httpOnly: true,
    // Admin sessions have no cross-site navigation need → strict; customer
    // sessions stay lax so the magic-link callback navigation still attaches.
    sameSite: name === COOKIE_ADMIN ? "strict" : "lax",
    secure: process.env.NODE_ENV === "production",
    expires: session.expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res, name) {
  res.clearCookie(name, { path: "/" });
}

// Resolves both cookies (if present) into req.principal = { type, id } | null
export async function attachPrincipal(req, _res, next) {
  try {
    const adminSid = req.cookies?.[COOKIE_ADMIN];
    const custSid = req.cookies?.[COOKIE_CUSTOMER];
    const admin = adminSid ? await getSession(adminSid) : null;
    const customer = !admin && custSid ? await getSession(custSid) : null;
    const row = admin || customer;
    req.principal = row ? { type: row.principal_type, id: Number(row.principal_id) } : null;
    next();
  } catch (e) { next(e); }
}

export function requireCustomer(req, _res, next) {
  if (req.principal?.type === "customer") return next();
  next(new ApiError("CUSTOMER_AUTH_REQUIRED", 401));
}

export function requireAdmin(req, _res, next) {
  if (req.principal?.type === "admin") return next();
  next(new ApiError("ADMIN_AUTH_REQUIRED", 401));
}

const STATE_CHANGING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Lightweight CSRF defense for cookie-authed state-changing requests (I5):
// when PUBLIC_ORIGIN is configured and the request carries an Origin header
// that does not match it, reject. Requests with no Origin header (native
// clients, the test suite) or when PUBLIC_ORIGIN is unset are allowed through.
export function requireSameOrigin(req, _res, next) {
  if (!STATE_CHANGING.has(req.method)) return next();
  const allowed = process.env.PUBLIC_ORIGIN;
  if (!allowed) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  if (origin !== allowed) return next(new ApiError("ORIGIN_NOT_ALLOWED", 403));
  next();
}
