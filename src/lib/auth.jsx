import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { addUser, findUserByEmail, findUserByAccessCode, getUser } from "./store.js";
import { ApiUnavailableError, apiFetch } from "./api.js";

const SESSION_KEY = "lumina-session";
const EMAIL_KEY = "lumina-email"; // 서버 세션 복원용(고객 이메일 매핑)
const AuthContext = createContext(null);
const DEMO_PASSWORD = "demo1234"; // mock: 이메일 로그인 데모 공통 비밀번호

// Customer Web scope with an admin-only back office. Vendor/dealer portals live elsewhere.
// 어드민 게이트 경로는 비밀 유지 대상 — 미인증 /admin 접근을 여기로 리다이렉트하면 경로가
// 노출되므로 RequireRole은 admin에 한해 홈으로 보낸다.
export const LOGIN_FOR = { customer: "/sign-in", admin: "/gate-7f3k9x" };

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(SESSION_KEY));
  const [hydrating, setHydrating] = useState(true); // 서버 세션 정합 대기 중 여부
  const user = userId ? getUser(userId) : null;

  function commit(found) {
    localStorage.setItem(SESSION_KEY, found.id);
    setUserId(found.id);
    return found;
  }

  // 서버 principal(customer/admin)을 데모 스토어 유저로 브리지 — 기존 UI(포털·어드민) 호환 유지
  function commitServerPrincipal(principal, email) {
    const remember = (e) => { try { localStorage.setItem(EMAIL_KEY, e); } catch { /* no-op */ } };
    if (principal === "admin") {
      const admin = findUserByEmail("admin@demo.com");
      if (admin) { remember("admin@demo.com"); return commit(admin); }
    }
    const normalized = String(email || "").trim().toLowerCase();
    remember(normalized);
    const found = findUserByEmail(normalized);
    if (found) return commit(found);
    return commit(addUser({ email: normalized, name: normalized.split("@")[0], role: "customer" }));
  }

  // 부팅 시 서버 세션과 로컬 세션을 정합 — 서버 세션이 진실의 원천.
  //  · 서버가 "세션 없음"(reachable & principal=null) → 로컬 세션도 폐기(로그아웃/만료 후 스테일 로그인 방지)
  //  · 서버 세션 있음 + 로컬 없음 → 복원(어드민, 또는 로그인 때 저장한 이메일로 고객)
  //  · 서버 접속 불가(정적 데모) → throw → 로컬 세션 그대로 유지
  useEffect(() => {
    let cancelled = false;
    apiFetch("/auth/me").then((data) => {
      if (cancelled) return;
      const principal = data?.principal || null;
      if (!principal) {
        if (localStorage.getItem(SESSION_KEY)) { localStorage.removeItem(SESSION_KEY); setUserId(null); }
        return;
      }
      if (userId) return; // 양쪽 다 세션 있음 → 유지
      if (principal.type === "admin") { commitServerPrincipal("admin"); return; }
      // 서버가 준 이메일 우선 — 로컬 스토리지가 비워진 기기에서도 유효 쿠키면 복원 가능.
      const email = principal.email || localStorage.getItem(EMAIL_KEY);
      if (email) commitServerPrincipal("customer", email);
    }).catch(() => { /* 서버 부재(정적 데모) → 로컬 유지 */ })
      .finally(() => { if (!cancelled) setHydrating(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 사이트 표시 언어 — 서버가 customers.locale에 저장해 OTP·주문 메일을 이 언어로 보낸다
  const siteLocale = () => {
    try { return window.localStorage.getItem("lumina-locale") || "en"; } catch { return "en"; }
  };

  // 이메일 6자리 인증번호 — 요청. 서버 없으면 ApiUnavailableError를 그대로 던져 폴백 유도.
  async function requestLoginCode(email) {
    return apiFetch("/auth/code", { method: "POST", body: { email, locale: siteLocale() } }); // { ok, devCode? }
  }

  // 인증번호 검증 → 서버 세션 + 데모 스토어 브리지
  async function verifyLoginCode(email, code) {
    const data = await apiFetch("/auth/code/verify", { method: "POST", body: { email, code, locale: siteLocale() } });
    return commitServerPrincipal(data.principal, email);
  }

  // 어드민/고객 비밀번호 로그인 — 서버 우선, 서버 부재 시 데모 폴백
  async function loginServer(email, password, allow = null) {
    try {
      const data = await apiFetch("/auth/password", { method: "POST", body: { email, password } });
      const role = data.principal === "admin" ? "admin" : "customer";
      if (allow && !allow.includes(role)) throw new Error("wrongPortal");
      return commitServerPrincipal(data.principal, email);
    } catch (e) {
      if (e instanceof ApiUnavailableError) return login(email, password, allow); // 정적 데모 폴백
      if (e.code === "INVALID_CREDENTIALS") throw new Error("badCredentials");
      if (e.code === "RATE_LIMITED") throw new Error("rateLimited");
      throw e;
    }
  }

  // (데모 폴백) 이메일 + 비밀번호. allow=허용 역할 목록
  function login(email, password, allow = null) {
    const found = findUserByEmail(email);
    if (!found || password !== DEMO_PASSWORD) throw new Error("badCredentials");
    if (found.active === false) throw new Error("accountSuspended");
    if (allow && !allow.includes(found.role)) throw new Error("wrongPortal");
    return commit(found);
  }

  // 벤더(공방) — 접근 코드/매직링크 (비밀번호 없음). 어르신 벤더 마찰 최소화.
  function loginWithCode(code) {
    const found = findUserByAccessCode(code);
    if (!found || found.role !== "supplier") throw new Error("badCode");
    if (found.active === false) throw new Error("accountSuspended");
    return commit(found);
  }

  // 공개 가입 — 일반회원(고객)만. 딜러는 신청→승인, 벤더는 어드민 발급.
  function signup(name, email) {
    if (findUserByEmail(email)) throw new Error("emailExists");
    return commit(addUser({ email, name, role: "customer" }));
  }

  async function logout() {
    // 서버 세션 폐기를 기다린 뒤 로컬 정리 — fire-and-forget면 요청 유실 시 서버 세션이 살아남아
    // 다음 로드의 정합에서 재로그인될 수 있다(특히 어드민). 실패해도 로컬은 best-effort로 정리.
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch { /* best effort */ }
    localStorage.removeItem(SESSION_KEY);
    try { localStorage.removeItem(EMAIL_KEY); } catch { /* no-op */ }
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ user, hydrating, login, loginWithCode, signup, logout, requestLoginCode, verifyLoginCode, loginServer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireRole({ role, children }) {
  const { user, hydrating } = useAuth();
  const location = useLocation();
  // 서버 세션 정합이 끝나기 전엔 리다이렉트 보류 — 유효 쿠키 사용자가 조기 리다이렉트되는 것 방지
  if (!user && hydrating) return null;
  // admin은 로그인 페이지로 리다이렉트하지 않는다 — 게이트 경로 노출 방지 (직접 접속만 허용)
  if (!user) {
    if (role === "admin") return <Navigate to="/" replace />;
    return <Navigate to={LOGIN_FOR[role] || "/sign-in"} state={{ from: location.pathname }} replace />;
  }
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
