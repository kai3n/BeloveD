import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { addUser, findUserByEmail, findUserByAccessCode, getUser } from "./store.js";
import { ApiUnavailableError, apiFetch } from "./api.js";

const SESSION_KEY = "lumina-session";
const AuthContext = createContext(null);
const DEMO_PASSWORD = "demo1234"; // mock: 이메일 로그인 데모 공통 비밀번호

// Customer Web scope with an admin-only back office. Vendor/dealer portals live elsewhere.
// 어드민 게이트 경로는 비밀 유지 대상 — 미인증 /admin 접근을 여기로 리다이렉트하면 경로가
// 노출되므로 RequireRole은 admin에 한해 홈으로 보낸다.
export const LOGIN_FOR = { customer: "/sign-in", admin: "/gate-7f3k9x" };

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(SESSION_KEY));
  const user = userId ? getUser(userId) : null;

  function commit(found) {
    localStorage.setItem(SESSION_KEY, found.id);
    setUserId(found.id);
    return found;
  }

  // 서버 principal(customer/admin)을 데모 스토어 유저로 브리지 — 기존 UI(포털·어드민) 호환 유지
  function commitServerPrincipal(principal, email) {
    if (principal === "admin") {
      const admin = findUserByEmail("admin@demo.com");
      if (admin) return commit(admin);
    }
    const normalized = String(email || "").trim().toLowerCase();
    const found = findUserByEmail(normalized);
    if (found) return commit(found);
    return commit(addUser({ email: normalized, name: normalized.split("@")[0], role: "customer" }));
  }

  // 부팅 시 서버 세션 하이드레이션 — 쿠키가 살아 있으면 로컬 세션 복원
  useEffect(() => {
    if (userId) return; // 로컬 세션이 이미 있으면 유지
    let cancelled = false;
    apiFetch("/auth/me").then((data) => {
      if (cancelled || !data?.principal) return;
      // 서버는 이메일을 안 주므로(id만) 데모 스토어 매핑은 로그인 시점에 저장된 이메일에 의존.
      // 하이드레이션은 어드민만 확실히 복원 가능.
      if (data.principal.type === "admin") commitServerPrincipal("admin");
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이메일 6자리 인증번호 — 요청. 서버 없으면 ApiUnavailableError를 그대로 던져 폴백 유도.
  async function requestLoginCode(email) {
    return apiFetch("/auth/code", { method: "POST", body: { email } }); // { ok, devCode? }
  }

  // 인증번호 검증 → 서버 세션 + 데모 스토어 브리지
  async function verifyLoginCode(email, code) {
    const data = await apiFetch("/auth/code/verify", { method: "POST", body: { email, code } });
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

  function logout() {
    apiFetch("/auth/logout", { method: "POST" }).catch(() => {}); // 서버 세션도 폐기 (없으면 무시)
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithCode, signup, logout, requestLoginCode, verifyLoginCode, loginServer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireRole({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  // admin은 로그인 페이지로 리다이렉트하지 않는다 — 게이트 경로 노출 방지 (직접 접속만 허용)
  if (!user) {
    if (role === "admin") return <Navigate to="/" replace />;
    return <Navigate to={LOGIN_FOR[role] || "/sign-in"} state={{ from: location.pathname }} replace />;
  }
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
