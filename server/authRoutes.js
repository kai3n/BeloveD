import { Router } from "express";
import { ApiError } from "./errors.js";
import { createMagicLink, verifyMagicLink, loginWithPassword, setCustomerPassword, createLoginCode, verifyLoginCode } from "./auth.js";
import { revokeSession } from "./session.js";
import { rateLimit } from "./rateLimit.js";
import { linkSessionToCustomer, recordAuthEvent } from "./activityRepository.js";
import { linkChatToCustomer } from "./chatRepository.js";
import {
  setSessionCookie, clearSessionCookie, clearChatCookie, requireCustomer,
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

  // 로그인 성공 시 익명 방문 세션(bd_aid)을 회원과 연결하고 login 이벤트 기록.
  // 추적 실패가 로그인을 막으면 안 되므로 조용히 삼킨다.
  async function linkActivity(req, customerId) {
    if (!customerId) return;
    const aid = req.cookies?.bd_aid;
    const chatToken = req.cookies?.bd_chat;
    try {
      if (aid) {
        await linkSessionToCustomer(aid, customerId);
        await recordAuthEvent(aid, "login");
      }
      // 로그인 전 익명 채팅 스레드를 이 고객과 연결 (있으면)
      if (chatToken) await linkChatToCustomer(chatToken, customerId);
    } catch { /* no-op */ }
  }

  r.post("/magic-link",
    rateLimit({ limit: 5, windowMs: MINUTE }),
    async (req, res, next) => {
    try {
      const { email, orderCode, locale } = req.body || {};
      if (typeof email !== "string") throw new ApiError("VALIDATION_ERROR", 400);
      if (orderCode != null && typeof orderCode !== "string") throw new ApiError("VALIDATION_ERROR", 400);
      const { link } = await createMagicLink(email, { origin: originOf(), orderCode: orderCode || null, locale });
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
      const { session, customer } = await verifyMagicLink(String(token));
      setSessionCookie(res, COOKIE_CUSTOMER, session);
      await linkActivity(req, customer?.id);
      res.json({ ok: true, principal: "customer" });
    } catch (e) { next(e); }
  });

  // 이메일 6자리 인증번호 — 요청 (IP+이메일 키로 타이트하게 제한)
  r.post("/code",
    rateLimit({ limit: 3, windowMs: MINUTE, keyFn: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase()}` }),
    rateLimit({ limit: 10, windowMs: MINUTE }),
    async (req, res, next) => {
    try {
      const { email, locale } = req.body || {};
      if (typeof email !== "string") throw new ApiError("VALIDATION_ERROR", 400);
      const { code } = await createLoginCode(email, locale);
      const body = { ok: true };
      if (process.env.NODE_ENV !== "production") body.devCode = code; // dev만 노출
      res.status(201).json(body);
    } catch (e) { next(e); }
  });

  // 인증번호 검증 → 고객 세션 발급
  r.post("/code/verify",
    rateLimit({ limit: 10, windowMs: MINUTE }),
    async (req, res, next) => {
    try {
      const { email, code, locale } = req.body || {};
      if (typeof email !== "string" || typeof code !== "string") throw new ApiError("VALIDATION_ERROR", 400);
      const { session, customer } = await verifyLoginCode(email, code, locale);
      setSessionCookie(res, COOKIE_CUSTOMER, session);
      await linkActivity(req, customer?.id);
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
      const { principalType, customerId, session } = await loginWithPassword(email, password);
      setSessionCookie(res, principalType === "admin" ? COOKIE_ADMIN : COOKIE_CUSTOMER, session);
      if (principalType === "customer") await linkActivity(req, customerId);
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
      // 로그아웃 시 라이브챗 스레드 쿠키도 제거 — 같은 브라우저에서 이전 대화가 남지 않게(개인정보)
      clearChatCookie(res);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  r.get("/me", (req, res) => {
    res.json({ principal: req.principal || null });
  });

  return r;
}
