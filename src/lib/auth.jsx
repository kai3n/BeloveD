import { createContext, useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { addUser, findUserByEmail, getUser } from "./store.js";

const SESSION_KEY = "lumina-session";
const AuthContext = createContext(null);
const DEMO_PASSWORD = "demo1234"; // mock: 모든 데모 계정 공통

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(SESSION_KEY));
  const user = userId ? getUser(userId) : null;

  function login(email, password) {
    const found = findUserByEmail(email);
    // 에러 메시지는 코드로 던지고 UI에서 언어별로 매핑한다
    if (!found || password !== DEMO_PASSWORD) throw new Error("badCredentials");
    localStorage.setItem(SESSION_KEY, found.id);
    setUserId(found.id);
    return found;
  }

  function signup(name, email) {
    if (findUserByEmail(email)) throw new Error("emailExists");
    const created = addUser({ email, name, role: "customer" });
    localStorage.setItem(SESSION_KEY, created.id);
    setUserId(created.id);
    return created;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
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
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
