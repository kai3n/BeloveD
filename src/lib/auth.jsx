import { createContext, useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { addUser, findUserByEmail, findUserByAccessCode, getUser } from "./store.js";

const SESSION_KEY = "lumina-session";
const AuthContext = createContext(null);
const DEMO_PASSWORD = "demo1234"; // mock: 이메일 로그인 데모 공통 비밀번호

// Customer Web scope with an admin-only back office. Vendor/dealer portals live elsewhere.
export const LOGIN_FOR = { customer: "/sign-in", admin: "/staff" };

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(SESSION_KEY));
  const user = userId ? getUser(userId) : null;

  function commit(found) {
    localStorage.setItem(SESSION_KEY, found.id);
    setUserId(found.id);
    return found;
  }

  // 이메일 + 비밀번호. allow=허용 역할 목록 — 진입 경로에 맞지 않는 역할은 거부(엉뚱한 포털 로그인 차단)
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
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithCode, signup, logout }}>
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
  if (!user) return <Navigate to={LOGIN_FOR[role] || "/sign-in"} state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
