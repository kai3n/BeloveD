import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useLocale } from "../i18n.jsx";

// 일반회원(고객) 로그인·가입. 스태프(어드민·딜러)는 /staff, 벤더는 /vendor.
export default function Login() {
  const { p } = useLocale();
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const from = location.state?.from;

  function afterLogin(user) {
    if (from) return navigate(from, { replace: true });
    if (user.role === "supplier") return navigate("/supplier", { replace: true });
    if (user.role === "dealer") return navigate("/dealer", { replace: true });
    if (user.role === "admin") return navigate("/admin", { replace: true });
    navigate("/account", { replace: true });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      afterLogin(mode === "login" ? login(email, password) : signup(name, email));
    } catch (err) {
      setError(p.login.errors[err.message] || err.message);
    }
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{mode === "login" ? p.login.title : p.login.signupTitle}</h1>
      <form className="panel form-stack" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label className="field">
            <span>{p.login.name}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="field">
          <span>{p.login.email}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode === "login" && (
          <label className="field">
            <span>{p.login.password}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="button primary" type="submit">
          {mode === "login" ? p.login.loginBtn : p.login.signupBtn}
        </button>
        <button
          type="button" className="text-link"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
        >
          {mode === "login" ? p.login.toSignup : p.login.toLogin}
        </button>
      </form>

      {/* 역할별 진입 안내 — 스태프/벤더는 전용 경로 */}
      <p className="form-hint" style={{ marginTop: 18, textAlign: "center" }}>
        <Link className="text-link" to="/staff">{p.login.staffLink}</Link>
        {" · "}
        <Link className="text-link" to="/vendor">{p.login.vendorLink}</Link>
      </p>

      {import.meta.env.DEV && <DemoPanel login={login} afterLogin={afterLogin} setError={setError} p={p} />}
    </div>
  );
}

// 데모 전용 — 실배포 빌드에선 렌더되지 않음 (import.meta.env.DEV)
const DEMO_ACCOUNTS = [
  { key: "demoCustomer", email: "customer@demo.com" },
  { key: "demoVendor", email: "supplier@demo.com" },
  { key: "demoDealer", email: "dealer@demo.com" },
  { key: "demoAdmin", email: "admin@demo.com" },
];
function DemoPanel({ login, afterLogin, setError, p }) {
  return (
    <div className="panel demo-panel">
      <p className="section-label">{p.login.demoTitle}</p>
      {DEMO_ACCOUNTS.map((acc) => (
        <button
          key={acc.email} className="button secondary"
          onClick={() => { try { afterLogin(login(acc.email, "demo1234")); } catch (err) { setError(p.login.errors[err.message] || err.message); } }}
        >
          {p.login[acc.key]}
        </button>
      ))}
    </div>
  );
}
