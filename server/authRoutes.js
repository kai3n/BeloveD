import { Router } from "express";
import { ApiError } from "./errors.js";
import { createMagicLink, verifyMagicLink, loginWithPassword, setCustomerPassword } from "./auth.js";
import { revokeSession } from "./session.js";
import {
  setSessionCookie, clearSessionCookie, requireCustomer,
  COOKIE_CUSTOMER, COOKIE_ADMIN,
} from "./middleware.js";

function originOf(req) {
  return process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`;
}

export function authRouter() {
  const r = Router();

  r.post("/magic-link", async (req, res, next) => {
    try {
      const { email, orderCode } = req.body || {};
      const { link } = await createMagicLink(email, { origin: originOf(req), orderCode: orderCode || null });
      const body = { ok: true };
      if (process.env.NODE_ENV !== "production") body.devLink = link; // dev surfaces the link
      res.status(201).json(body);
    } catch (e) { next(e); }
  });

  r.get("/callback", async (req, res, next) => {
    try {
      const token = req.query.token;
      if (!token) throw new ApiError("MAGIC_LINK_INVALID", 400);
      const { session } = await verifyMagicLink(String(token));
      setSessionCookie(res, COOKIE_CUSTOMER, session);
      res.json({ ok: true, principal: "customer" });
    } catch (e) { next(e); }
  });

  r.post("/password", async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      const { principalType, session } = await loginWithPassword(email, password);
      setSessionCookie(res, principalType === "admin" ? COOKIE_ADMIN : COOKIE_CUSTOMER, session);
      res.json({ ok: true, principal: principalType });
    } catch (e) { next(e); }
  });

  r.post("/set-password", requireCustomer, async (req, res, next) => {
    try {
      await setCustomerPassword(req.principal.id, req.body?.password);
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
