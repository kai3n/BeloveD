// 메일 발송 — RESEND_API_KEY가 있으면 Resend로 실제 발송, 없으면 dev sink.
const sink = [];
const FROM = process.env.MAIL_FROM || "BeloveD <onboarding@resend.dev>";
// no-reply 발신이지만 "답장"을 누른 고객의 메일은 지원팀으로 흐르게 — 본문 안내(support@)와 같은 주소
const REPLY_TO = process.env.MAIL_REPLY_TO || "support@belovediamond.com";

async function deliver(to, subject, html, meta) {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    // 8초 상한 — 메일 발송을 응답 전에 await하므로, Resend 지연이 HTTP 응답을 무한정 붙잡지 않게.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [to], reply_to: [REPLY_TO], subject, html }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`[mailer] resend ${res.status}: ${detail.slice(0, 200)}`);
        throw new Error("MAIL_SEND_FAILED");
      }
      return { delivered: true };
    } finally {
      clearTimeout(timer);
    }
  }
  const msg = { ...meta, to, at: new Date().toISOString() };
  sink.push(msg);
  const env = process.env.NODE_ENV;
  // The sink is useful in local automation, but console output is often copied
  // into shared logs. Never print recipients, magic links, or OTP values.
  if (env !== "production" && env !== "test") console.log(`[mailer] ${meta.type} captured by local sink`);
  return msg;
}

// 메일 이미지는 절대 URL 필수 — 프로덕션 도메인 고정 (dev에서도 메일 미리보기가 로고를 로드하도록)
const MAIL_ASSET_ORIGIN = process.env.PUBLIC_ORIGIN?.startsWith("https://")
  ? process.env.PUBLIC_ORIGIN
  : "https://belovediamond.com";

// 면책 문구는 메일 종류·로케일마다 다르다 — 호출부가 넘긴 것만 붙인다 (고정 영어 문구로 인한 이중 표기 방지)
const wrap = (inner, disclaimer) => `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#15130f">
    <img src="${MAIL_ASSET_ORIGIN}/assets/email-logo.png" alt="BELOVED" width="128" height="auto"
      style="display:block;width:128px;max-width:40%;margin:0 0 20px;border:0" />
    ${inner}${disclaimer ? `
    <p style="font-size:12px;color:#8e897e;margin-top:28px">${disclaimer}</p>` : ""}
  </div>`;

// 인증 메일(로그인 링크·OTP) 면책 문구 — 주문 메일은 orderMail의 CHROME.ignore를 쓴다 (내용이 다름)
const AUTH_IGNORE = {
  en: "If you didn't request this, you can ignore this email.",
  ko: "직접 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.",
  zh: "如果这不是您本人的操作，可以忽略此邮件。",
  es: "Si no lo solicitaste, puedes ignorar este correo.",
};

export const MAGIC_LINK_COPY = {
  en: { subject: "Your BeloveD sign-in link", line: "Tap the button below to sign in. The link expires in 15 minutes.", cta: "SIGN IN" },
  ko: { subject: "BeloveD 로그인 링크", line: "아래 버튼을 눌러 로그인해 주세요. 링크는 15분 후 만료됩니다.", cta: "로그인" },
  zh: { subject: "BeloveD 登录链接", line: "点击下方按钮登录，链接 15 分钟后失效。", cta: "登录" },
  es: { subject: "Tu enlace de acceso a BeloveD", line: "Toca el botón para iniciar sesión. El enlace expira en 15 minutos.", cta: "INICIAR SESIÓN" },
};

export async function sendMagicLink(email, link, locale = "en") {
  const t = MAGIC_LINK_COPY[locale] || MAGIC_LINK_COPY.en;
  return deliver(email, t.subject, wrap(
    `<p style="font-size:15px;line-height:1.6">${t.line}</p>
     <p style="margin:24px 0"><a href="${link}" style="background:#16130f;color:#f8f7f5;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">${t.cta}</a></p>`,
    AUTH_IGNORE[locale] || AUTH_IGNORE.en,
  ), { type: "magic_link", link, locale, subject: t.subject });
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
    AUTH_IGNORE[locale] || AUTH_IGNORE.en,
  ), { type: "login_code", code, locale });
}

const VENDOR_RESET_COPY = {
  en: {
    subject: "Reset your De Lune Vendor password",
    line: "A password reset was requested for your Vendor account. This link expires in 1 hour.",
    cta: "RESET PASSWORD",
    ignore: "If you did not request this reset, you can ignore this email and your password will remain unchanged.",
  },
  zh: {
    subject: "重置您的得月供应商账号密码",
    line: "我们收到了您的供应商账号密码重置请求。此链接将在 1 小时后失效。",
    cta: "重置密码",
    ignore: "如果这不是您本人的操作，可以忽略此邮件，您的密码不会改变。",
  },
  ko: {
    subject: "De Lune 벤더 비밀번호 재설정",
    line: "벤더 계정의 비밀번호 재설정 요청이 접수되었습니다. 링크는 1시간 후 만료됩니다.",
    cta: "비밀번호 재설정",
    ignore: "직접 요청하지 않으셨다면 이 메일을 무시하세요. 기존 비밀번호는 변경되지 않습니다.",
  },
};

export async function sendVendorPasswordReset(email, link, locale = "en") {
  const t = VENDOR_RESET_COPY[locale] || VENDOR_RESET_COPY.en;
  return deliver(email, t.subject, wrap(
    `<p style="font-size:15px;line-height:1.6">${t.line}</p>
     <p style="margin:24px 0"><a href="${link}" style="background:#123f3a;color:#fff;padding:14px 26px;text-decoration:none;letter-spacing:.1em;font-size:13px">${t.cta}</a></p>`,
    t.ignore,
  ), { type: "vendor_password_reset", link, locale, subject: t.subject });
}

const VENDOR_INVITE_COPY = {
  en: {
    subject: "You are invited to the De Lune Vendor workspace",
    line: "Your Vendor account is ready. Use the secure link below to set a password and activate your account. The link expires in 7 days.",
    cta: "ACTIVATE ACCOUNT",
    ignore: "This invitation was created by the BeloveD operations team. If you were not expecting it, contact your operations representative.",
  },
  zh: {
    subject: "得月供应商工作台邀请",
    line: "您的供应商账号已经创建。请使用下方安全链接设置密码并激活账号。链接将在 7 天后失效。",
    cta: "激活账号",
    ignore: "此邀请由 BeloveD 订单团队创建。如您并未预期收到邀请，请联系对应的订单负责人。",
  },
  ko: {
    subject: "De Lune 벤더 작업공간 초대",
    line: "벤더 계정이 준비되었습니다. 아래 보안 링크에서 비밀번호를 설정하고 계정을 활성화하세요. 링크는 7일 후 만료됩니다.",
    cta: "계정 활성화",
    ignore: "이 초대는 BeloveD 운영팀이 만들었습니다. 예상하지 못한 초대라면 담당자에게 문의해 주세요.",
  },
};

export async function sendVendorInvite(email, link, locale = "en") {
  const t = VENDOR_INVITE_COPY[locale] || VENDOR_INVITE_COPY.en;
  return deliver(email, t.subject, wrap(
    `<p style="font-size:15px;line-height:1.6">${t.line}</p>
     <p style="margin:24px 0"><a href="${link}" style="background:#123f3a;color:#fff;padding:14px 26px;text-decoration:none;letter-spacing:.1em;font-size:13px">${t.cta}</a></p>`,
    t.ignore,
  ), { type: "vendor_invite", link, locale, subject: t.subject });
}

// 주문 알림 등 임의 메일 — wrap 레이아웃 적용 후 발송. meta는 dev sink 검증용.
// disclaimer: 하단 면책 문구(로케일별) — 호출부가 넘기지 않으면 붙이지 않는다.
export async function sendOrderMail(to, subject, innerHtml, meta = {}, disclaimer = "") {
  return deliver(to, subject, wrap(innerHtml, disclaimer), { ...meta, subject });
}

export function drainMail() {
  return sink.splice(0);
}
