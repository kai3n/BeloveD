import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useLocale } from "../i18n.jsx";

// 스태프 로그인 — 현재 앱에서는 admin만 허용한다. Vendor/dealer 포털은 별도 앱에서 다룬다.
export default function StaffLogin() {
  const { p } = useLocale();
  const { login, loginServer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const from = location.state?.from;

  function afterLogin(user) {
    if (from && user.role === "admin") return navigate(from, { replace: true });
    navigate("/admin/orders", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      // 실서버 우선(스크립트 해시 검증) — 서버 부재 시 데모 폴백은 loginServer 내부에서 처리
      afterLogin(await loginServer(email, password, ["admin"]));
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
        <Link className="text-link" to="/login">{p.login.customerLink}</Link>
      </p>

      {import.meta.env.DEV && (
        <div className="panel demo-panel">
          <p className="section-label">{p.login.demoTitle}</p>
          <button className="button secondary" onClick={() => { try { afterLogin(login("admin@demo.com", "demo1234", ["admin"])); } catch (err) { setError(p.login.errors[err.message] || err.message); } }}>{p.login.demoAdmin}</button>
        </div>
      )}
    </div>
  );
}
