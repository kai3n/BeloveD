import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useLocale } from "../i18n.jsx";

// 벤더(공방) 로그인 — 접근 코드 또는 매직링크(?code=). 비밀번호 없음, 어르신 친화.
export default function VendorLogin() {
  const { p } = useLocale();
  const { loginWithCode } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const tried = useRef(false);

  function enter(value) {
    setError("");
    try {
      loginWithCode(value);
      navigate("/supplier", { replace: true });
    } catch (err) {
      setError(p.login.errors[err.message] || err.message);
    }
  }

  // 매직링크: /vendor?code=XXXX-XXXX → 자동 로그인 (1회)
  useEffect(() => {
    const linkCode = params.get("code");
    if (linkCode && !tried.current) {
      tried.current = true;
      setCode(linkCode);
      enter(linkCode);
    }
  }, [params]);

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{p.login.vendorTitle}</h1>
      <p className="page-sub">{p.login.vendorSub}</p>
      <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); enter(code); }}>
        <label className="field"><span>{p.login.codeLabel}</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX"
            autoFocus style={{ fontSize: 20, letterSpacing: 2, textTransform: "uppercase" }} required /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary" type="submit">{p.login.codeBtn}</button>
      </form>

      <p className="form-hint" style={{ marginTop: 18, textAlign: "center" }}>
        <Link className="text-link" to="/login">{p.login.customerLink}</Link>
        {" · "}
        <Link className="text-link" to="/staff">{p.login.staffLink}</Link>
      </p>

      {import.meta.env.DEV && (
        <div className="panel demo-panel">
          <p className="section-label">{p.login.demoTitle}</p>
          <button className="button secondary" onClick={() => enter("CN01-7F3K")}>SUPPLIER-CN-01 · CN01-7F3K</button>
        </div>
      )}
    </div>
  );
}
