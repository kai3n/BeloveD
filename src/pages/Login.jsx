import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { ApiUnavailableError } from "../lib/api.js";
import { DEMO_AUTH_ENABLED, WITH_BACKOFFICE } from "../lib/flags.js";
import { useLocale } from "../i18n.jsx";

// 고객 로그인 — 이메일 6자리 인증번호(실서버). 서버가 없는 정적 데모에선 비밀번호 폴백.
const OTP_COPY = {
  en: {
    title: "Sign in", sub: "We'll email you a 6-digit code — no password needed.",
    email: "Email", sendCode: "Email me a code", codeLbl: "6-digit code",
    verify: "Sign in", resend: "Resend code", resendIn: (s) => `Resend in ${s}s`,
    sentTo: (e) => `Code sent to ${e}`, changeEmail: "Use a different email",
    errors: { CODE_INVALID: "That code is invalid or expired.", RATE_LIMITED: "Too many attempts — try again in a minute.", VALIDATION_ERROR: "Please check your email address.", SERVER_DOWN: "We can't reach the server right now — please try again in a moment." },
  },
  ko: {
    title: "로그인", sub: "이메일로 6자리 인증번호를 보내드려요 — 비밀번호가 필요 없습니다.",
    email: "이메일", sendCode: "인증번호 받기", codeLbl: "6자리 인증번호",
    verify: "로그인", resend: "재전송", resendIn: (s) => `${s}초 후 재전송`,
    sentTo: (e) => `${e}로 코드를 보냈어요`, changeEmail: "다른 이메일 사용",
    errors: { CODE_INVALID: "인증번호가 틀렸거나 만료됐어요.", RATE_LIMITED: "시도가 너무 많아요 — 1분 후 다시 시도해주세요.", VALIDATION_ERROR: "이메일 주소를 확인해주세요.", SERVER_DOWN: "지금은 서버에 연결할 수 없어요 — 잠시 후 다시 시도해 주세요." },
  },
  zh: {
    title: "登录", sub: "我们会将 6 位验证码发送到您的邮箱 — 无需密码。",
    email: "邮箱", sendCode: "获取验证码", codeLbl: "6 位验证码",
    verify: "登录", resend: "重新发送", resendIn: (s) => `${s} 秒后可重发`,
    sentTo: (e) => `验证码已发送至 ${e}`, changeEmail: "更换邮箱",
    errors: { CODE_INVALID: "验证码无效或已过期。", RATE_LIMITED: "尝试次数过多 — 请一分钟后再试。", VALIDATION_ERROR: "请检查邮箱地址。", SERVER_DOWN: "暂时无法连接服务器 — 请稍后再试。" },
  },
  es: {
    title: "Iniciar sesión", sub: "Te enviaremos un código de 6 dígitos por correo — sin contraseña.",
    email: "Correo", sendCode: "Enviarme un código", codeLbl: "Código de 6 dígitos",
    verify: "Entrar", resend: "Reenviar", resendIn: (s) => `Reenviar en ${s}s`,
    sentTo: (e) => `Código enviado a ${e}`, changeEmail: "Usar otro correo",
    errors: { CODE_INVALID: "Código inválido o expirado.", RATE_LIMITED: "Demasiados intentos — prueba en un minuto.", VALIDATION_ERROR: "Revisa tu dirección de correo.", SERVER_DOWN: "No podemos conectar con el servidor — inténtalo de nuevo en un momento." },
  },
};

// 6자리 코드 세그먼트 — 실제 입력은 박스 위를 덮는 투명 input 하나라
// 붙여넣기·iOS 코드 자동완성이 그대로 살고, 커서가 가운데 떠 보이는 문제가 없다
function OtpBoxes({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const activeIdx = focused ? Math.min(value.length, 5) : -1;
  return (
    <div className="otp-field">
      <input
        className="otp-input"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required
      />
      <div className="otp-boxes" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => {
          const d = value[i] || "";
          return (
            <span key={i} className={`otp-box${i === activeIdx ? " is-active" : ""}`}>
              {d}
              {i === activeIdx && !d && <i className="otp-caret" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Login() {
  const { p, locale } = useLocale();
  const c = OTP_COPY[locale] || OTP_COPY.en;
  const { login, requestLoginCode, verifyLoginCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("email"); // email | code | fallback
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const from = location.state?.from;
  function afterLogin() {
    navigate(from || "/account", { replace: true });
  }

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e) {
    e?.preventDefault();
    setError(""); setBusy(true);
    try {
      await requestLoginCode(email.trim());
      setStep("code");
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiUnavailableError) {
        // 비밀번호 폴백은 명시적으로 켠 정적 로컬 데모 빌드 전용 —
        // 실서버에서 API 장애 시 데모 계정 안내가 노출되면 안 된다
        if (!WITH_BACKOFFICE && DEMO_AUTH_ENABLED) setStep("fallback");
        else setError(c.errors.SERVER_DOWN);
      } else setError(c.errors[err.code] || c.errors.VALIDATION_ERROR);
    } finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await verifyLoginCode(email.trim(), code.trim());
      afterLogin();
    } catch (err) {
      setError(c.errors[err.code] || c.errors.CODE_INVALID);
    } finally { setBusy(false); }
  }

  function fallbackLogin(e) {
    e.preventDefault();
    setError("");
    try {
      login(email, password, ["customer"]);
      afterLogin();
    } catch (err) {
      setError(p.login.errors[err.message] || err.message);
    }
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{c.title}</h1>
      <p className="page-sub">{c.sub}</p>

      {step === "email" && (
        <form className="panel form-stack" onSubmit={sendCode}>
          <label className="field"><span>{c.email}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button primary" type="submit" disabled={busy}>{c.sendCode}</button>
        </form>
      )}

      {step === "code" && (
        <form className="panel form-stack" onSubmit={verify}>
          <p className="form-hint">{c.sentTo(email)}</p>
          <label className="field"><span>{c.codeLbl}</span>
            <OtpBoxes value={code} onChange={setCode} />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button primary" type="submit" disabled={busy || code.length !== 6}>{c.verify}</button>
          <div className="row-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="text-link" onClick={() => { setStep("email"); setCode(""); setError(""); }}>{c.changeEmail}</button>
            <button type="button" className="text-link" disabled={cooldown > 0} onClick={sendCode}>
              {cooldown > 0 ? c.resendIn(cooldown) : c.resend}
            </button>
          </div>
        </form>
      )}

      {step === "fallback" && DEMO_AUTH_ENABLED ? (
        <form className="panel form-stack" onSubmit={fallbackLogin}>
          <p className="form-hint">{p.login.demoTitle}</p>
          <label className="field"><span>{p.login.email}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field"><span>{p.login.password}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button primary" type="submit">{p.login.loginBtn}</button>
        </form>
      ) : null}

      {/* 고객 사이트에는 스태프 진입점을 노출하지 않는다 — 스태프는 비공개 게이트 경로로 직접 접속 */}
    </div>
  );
}
