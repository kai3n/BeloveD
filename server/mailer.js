// Dev seam: capture outbound mail instead of sending. Swap for SMTP/Resend in prod.
const sink = [];

export async function sendMagicLink(email, link) {
  const msg = { type: "magic_link", to: email, link, at: new Date().toISOString() };
  sink.push(msg);
  if (process.env.NODE_ENV !== "test") console.log(`[mailer] magic link → ${email}: ${link}`);
  return msg;
}

export function drainMail() {
  return sink.splice(0);
}
