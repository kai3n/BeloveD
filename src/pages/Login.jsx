import { useState } from "react";
import { Link } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useLocale } from "../i18n.jsx";

// Customer Web login/signup. Admin access uses /staff; vendor/dealer access lives in separate apps.
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
    navigate("/account", { replace: true });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      // 고객 전용 진입 — 스태프/벤더 계정은 전용 경로로 안내
      afterLogin(mode === "login" ? login(email, password, ["customer"]) : signup(name, email));
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
      <p className="form-hint" style={{ marginTop: 18, textAlign: "center" }}>
        <Link className="text-link" to="/staff">{p.login.staffLink}</Link>
      </p>

      {import.meta.env.DEV && <DemoPanel login={login} afterLogin={afterLogin} setError={setError} p={p} />}
    </div>
  );
}

// 데모 전용 — 실배포 빌드에선 렌더되지 않음 (import.meta.env.DEV). 고객 진입이라 고객 계정만.
function DemoPanel({ login, afterLogin, setError, p }) {
  return (
    <div className="panel demo-panel">
      <p className="section-label">{p.login.demoTitle}</p>
      <button
        className="button secondary"
        onClick={() => { try { afterLogin(login("customer@demo.com", "demo1234", ["customer"])); } catch (err) { setError(p.login.errors[err.message] || err.message); } }}
      >
        {p.login.demoCustomer}
      </button>
    </div>
  );
}
