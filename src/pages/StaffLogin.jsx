import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useLocale } from "../i18n.jsx";

// 스태프 로그인 — 어드민·딜러 (이메일+비밀번호, 가입 없음). 딜러 계정은 신청→승인으로만 발급.
export default function StaffLogin() {
  const { p } = useLocale();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const from = location.state?.from;

  function afterLogin(user) {
    if (from && (user.role === "admin" || user.role === "dealer")) return navigate(from, { replace: true });
    navigate(user.role === "admin" ? "/admin" : "/dealer", { replace: true });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      // 스태프 전용 — 어드민·딜러만. 고객/벤더 계정은 거부(wrongPortal)
      afterLogin(login(email, password, ["admin", "dealer"]));
    } catch (err) {
      setError(p.login.errors[err.message] || err.message);
    }
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{p.login.staffTitle}</h1>
      <p className="page-sub">{p.login.staffSub}</p>
      <form className="panel form-stack" onSubmit={handleSubmit}>
        <label className="field"><span>{p.login.email}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="field"><span>{p.login.password}</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary" type="submit">{p.login.loginBtn}</button>
      </form>

      <p className="form-hint" style={{ marginTop: 18, textAlign: "center" }}>
        {p.login.dealerApplyHint} <Link className="text-link" to="/dealers/apply">{p.login.dealerApplyLink}</Link>
        {" · "}
        <Link className="text-link" to="/login">{p.login.customerLink}</Link>
      </p>

      {import.meta.env.DEV && (
        <div className="panel demo-panel">
          <p className="section-label">{p.login.demoTitle}</p>
          <button className="button secondary" onClick={() => { try { afterLogin(login("admin@demo.com", "demo1234", ["admin", "dealer"])); } catch (err) { setError(p.login.errors[err.message] || err.message); } }}>{p.login.demoAdmin}</button>
          <button className="button secondary" onClick={() => { try { afterLogin(login("dealer@demo.com", "demo1234", ["admin", "dealer"])); } catch (err) { setError(p.login.errors[err.message] || err.message); } }}>{p.login.demoDealer}</button>
        </div>
      )}
    </div>
  );
}
