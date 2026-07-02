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

const wrap = (inner) => `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#15130f">
    <p style="letter-spacing:.2em;font-size:12px;color:#8f7d54;margin:0 0 18px">BELOVED</p>
    ${inner}
    <p style="font-size:12px;color:#8e897e;margin-top:28px">If you didn't request this, you can ignore this email.</p>
  </div>`;

export async function sendMagicLink(email, link) {
  return deliver(email, "Your BeloveD sign-in link", wrap(
    `<p style="font-size:15px;line-height:1.6">Tap the button below to sign in. The link expires in 15 minutes.</p>
     <p style="margin:24px 0"><a href="${link}" style="background:#16130f;color:#f8f7f5;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">SIGN IN</a></p>`,
  ), { type: "magic_link", link });
}

export async function sendLoginCode(email, code) {
  return deliver(email, `${code} — your BeloveD verification code`, wrap(
    `<p style="font-size:15px;line-height:1.6">Enter this code to sign in. It expires in 10 minutes.</p>
     <p style="font-size:34px;letter-spacing:.35em;font-weight:700;margin:22px 0">${code}</p>`,
  ), { type: "login_code", code });
}

export function drainMail() {
  return sink.splice(0);
}
