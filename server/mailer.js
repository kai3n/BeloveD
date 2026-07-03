// 메일 발송 — RESEND_API_KEY가 있으면 Resend로 실제 발송, 없으면 dev sink.
const sink = [];
const FROM = process.env.MAIL_FROM || "BeloveD <onboarding@resend.dev>";

async function deliver(to, subject, html, meta) {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[mailer] resend ${res.status}: ${detail.slice(0, 200)}`);
      throw new Error("MAIL_SEND_FAILED");
    }
    return { delivered: true };
  }
  const msg = { ...meta, to, at: new Date().toISOString() };
  sink.push(msg);
  const env = process.env.NODE_ENV;
  if (env !== "production" && env !== "test") console.log(`[mailer] ${meta.type} → ${to}: ${meta.link || meta.code}`);
  return msg;
}

// 메일 이미지는 절대 URL 필수 — 프로덕션 도메인 고정 (dev에서도 메일 미리보기가 로고를 로드하도록)
const MAIL_ASSET_ORIGIN = process.env.PUBLIC_ORIGIN?.startsWith("https://")
  ? process.env.PUBLIC_ORIGIN
  : "https://belovediamond.com";

const wrap = (inner) => `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#15130f">
    <img src="${MAIL_ASSET_ORIGIN}/assets/email-logo.png" alt="BELOVED" width="128" height="auto"
      style="display:block;width:128px;max-width:40%;margin:0 0 20px;border:0" />
    ${inner}
    <p style="font-size:12px;color:#8e897e;margin-top:28px">If you didn't request this, you can ignore this email.</p>
  </div>`;

export async function sendMagicLink(email, link) {
  return deliver(email, "Your BeloveD sign-in link", wrap(
    `<p style="font-size:15px;line-height:1.6">Tap the button below to sign in. The link expires in 15 minutes.</p>
     <p style="margin:24px 0"><a href="${link}" style="background:#16130f;color:#f8f7f5;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">SIGN IN</a></p>`,
  ), { type: "magic_link", link });
}

// OTP 메일 — 고객이 로그인 시점에 쓰던 사이트 언어로 발송 (customers.locale과 동일 소스)
const LOGIN_CODE_COPY = {
  en: { subject: (c) => `${c} — your BeloveD verification code`, line: "Enter this code to sign in. It expires in 10 minutes." },
  ko: { subject: (c) => `${c} — BeloveD 인증번호`, line: "로그인하려면 이 번호를 입력해 주세요. 10분 후 만료됩니다." },
  zh: { subject: (c) => `${c} — BeloveD 验证码`, line: "请输入此验证码登录，10 分钟后失效。" },
  es: { subject: (c) => `${c} — tu código de verificación BeloveD`, line: "Ingresa este código para iniciar sesión. Expira en 10 minutos." },
};

export async function sendLoginCode(email, code, locale = "en") {
  const t = LOGIN_CODE_COPY[locale] || LOGIN_CODE_COPY.en;
  return deliver(email, t.subject(code), wrap(
    `<p style="font-size:15px;line-height:1.6">${t.line}</p>
     <p style="font-size:34px;letter-spacing:.35em;font-weight:700;margin:22px 0">${code}</p>`,
  ), { type: "login_code", code, locale });
}

// 주문 알림 등 임의 메일 — wrap 레이아웃 적용 후 발송. meta는 dev sink 검증용.
export async function sendOrderMail(to, subject, innerHtml, meta = {}) {
  return deliver(to, subject, wrap(innerHtml), { ...meta, subject });
}

export function drainMail() {
  return sink.splice(0);
}
