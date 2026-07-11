import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api.js";

// 매직링크 착지 페이지 — 이메일 링크(/auth/callback?token=…)가 여기로 온다.
// 토큰을 서버에 검증시켜(세션 쿠키 발급) 로그인 처리한 뒤, 전체 로드로 /account 로 이동해
// AuthProvider의 /me 정합이 로그인 상태를 복원하게 한다.
export default function MagicCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { navigate("/sign-in", { replace: true }); return; }
    apiFetch(`/auth/callback?token=${encodeURIComponent(token)}`)
      .then(() => { window.location.replace("/account"); })
      .catch(() => setFailed(true));
  }, [navigate]);
  return (
    <main style={{ maxWidth: 440, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      {failed
        ? <p style={{ lineHeight: 1.6 }}>This sign-in link is invalid or expired. <a href="/sign-in">Sign in again</a>.</p>
        : <p style={{ lineHeight: 1.6 }}>Signing you in…</p>}
    </main>
  );
}
