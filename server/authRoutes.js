import { Router } from "express";
import { ApiError } from "./errors.js";
import { createMagicLink, verifyMagicLink, loginWithPassword, setCustomerPassword } from "./auth.js";
import { revokeSession } from "./session.js";
import { rateLimit } from "./rateLimit.js";
import {
  setSessionCookie, clearSessionCookie, requireCustomer,
  COOKIE_CUSTOMER, COOKIE_ADMIN,
} from "./middleware.js";

const MINUTE = 60 * 1000;

// Build the magic-link origin from PUBLIC_ORIGIN only — never the request Host
// header, which an attacker could spoof to plant a phishing link (I1).
function originOf() {
  const o = process.env.PUBLIC_ORIGIN;
  if (!o) {
    if (process.env.NODE_ENV === "production") throw new ApiError("INTERNAL_ERROR", 500);
    return "http://127.0.0.1:8787"; // dev default only
  }
  return o;
}

export function authRouter() {
  const r = Router();

  r.post("/magic-link",
    rateLimit({ limit: 5, windowMs: MINUTE }),
    async (req, res, next) => {
    try {
      const { email, orderCode } = req.body || {};
      if (typeof email !== "string") throw new ApiError("VALIDATION_ERROR", 400);
      if (orderCode != null && typeof orderCode !== "string") throw new ApiError("VALIDATION_ERROR", 400);
      const { link } = await createMagicLink(email, { origin: originOf(), orderCode: orderCode || null });
      const body = { ok: true };
      if (process.env.NODE_ENV !== "production") body.devLink = link; // dev surfaces the link
      res.status(201).json(body);
    } catch (e) { next(e); }
  });

  r.get("/callback",
    rateLimit({ limit: 20, windowMs: MINUTE }),
    async (req, res, next) => {
    try {
      const token = req.query.token;
      if (!token) throw new ApiError("MAGIC_LINK_INVALID", 400);
      const { session } = await verifyMagicLink(String(token));
      setSessionCookie(res, COOKIE_CUSTOMER, session);
      res.json({ ok: true, principal: "customer" });
    } catch (e) { next(e); }
  });

  r.post("/password",
    rateLimit({ limit: 5, windowMs: MINUTE }),
    async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (typeof email !== "string" || typeof password !== "string") {
        throw new ApiError("VALIDATION_ERROR", 400);
      }
      const { principalType, session } = await loginWithPassword(email, password);
      setSessionCookie(res, principalType === "admin" ? COOKIE_ADMIN : COOKIE_CUSTOMER, session);
      res.json({ ok: true, principal: principalType });
    } catch (e) { next(e); }
  });

  r.post("/set-password",
    rateLimit({ limit: 5, windowMs: MINUTE }),
    requireCustomer, async (req, res, next) => {
    try {
      const { password } = req.body || {};
      if (typeof password !== "string") throw new ApiError("VALIDATION_ERROR", 400);
      await setCustomerPassword(req.principal.id, password);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.post("/logout", async (req, res, next) => {
    try {
      await revokeSession(req.cookies?.[COOKIE_CUSTOMER]);
      await revokeSession(req.cookies?.[COOKIE_ADMIN]);
      clearSessionCookie(res, COOKIE_CUSTOMER);
      clearSessionCookie(res, COOKIE_ADMIN);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/me", (req, res) => {
    res.json({ principal: req.principal || null });
  });

  return r;
}
