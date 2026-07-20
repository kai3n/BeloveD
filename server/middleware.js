import { getSession } from "./session.js";
import { ApiError } from "./errors.js";

export const COOKIE_CUSTOMER = "bd_sid";
export const COOKIE_ADMIN = "bd_admin";
export const COOKIE_CHAT = "bd_chat";

// 라이브챗 익명 스레드 토큰 — httpOnly라 JS가 읽지 못하고, 서버가 token_hash로만 대조한다.
// 매직링크 콜백처럼 사이트 내 이동에도 붙도록 sameSite=lax.
export function setChatCookie(res, token) {
  res.cookie(COOKIE_CHAT, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 90, // 90d
    path: "/",
  });
}

export function clearChatCookie(res) {
  res.clearCookie(COOKIE_CHAT, { path: "/" });
}

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

// Resolves both cookies (if present). 오너가 같은 브라우저에서 어드민+고객을 오가므로
// 두 세션을 모두 해석해 둔다 — req.principal 기본값은 admin 우선(어드민 콘솔·/auth/me 호환),
// 고객 라우트 가드(requireCustomer)와 고객향 핸들러가 고객 세션을 우선 선택해 401 루프를 막는다.
export async function attachPrincipal(req, _res, next) {
  try {
    const adminSid = req.cookies?.[COOKIE_ADMIN];
    const custSid = req.cookies?.[COOKIE_CUSTOMER];
    const [admin, customer] = await Promise.all([
      adminSid ? getSession(adminSid) : null,
      custSid ? getSession(custSid) : null,
    ]);
    req.principalAdmin = admin ? { type: admin.principal_type, id: Number(admin.principal_id) } : null;
    req.principalCustomer = customer?.principal_type === "customer"
      ? { type: "customer", id: Number(customer.principal_id) }
      : null;
    req.principal = req.principalAdmin || req.principalCustomer;
    next();
  } catch (e) { next(e); }
}

export function requireCustomer(req, _res, next) {
  // 어드민 쿠키가 함께 있어도 고객 라우트는 고객 세션으로 동작한다 (동시 로그인 401 방지)
  if (req.principalCustomer) {
    req.principal = req.principalCustomer;
    return next();
  }
  if (req.principal?.type === "customer") return next();
  next(new ApiError("CUSTOMER_AUTH_REQUIRED", 401));
}

// 스태프 공통 — full admin(사람)과 bot_admin(자동화) 둘 다 통과.
// 돈이 걸린 작업은 아래 requireFullAdmin(또는 이벤트 타입 검사)으로 별도 강제한다.
export function requireAdmin(req, _res, next) {
  if (req.principal?.type === "admin" || req.principal?.type === "bot_admin") return next();
  next(new ApiError("ADMIN_AUTH_REQUIRED", 401));
}

// 돈 관련 작업(설정 저장·제안 발송·결제 확인·잔금 요청·주문 취소)은 사람 어드민만
export function requireFullAdmin(req, _res, next) {
  if (req.principal?.type === "admin") return next();
  if (req.principal?.type === "bot_admin") return next(new ApiError("FULL_ADMIN_REQUIRED", 403));
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
