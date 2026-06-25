// Dev seam: capture outbound mail instead of sending. Swap for SMTP/Resend in prod.
const sink = [];

export async function sendMagicLink(email, link) {
  const msg = { type: "magic_link", to: email, link, at: new Date().toISOString() };
  sink.push(msg);
  // Only surface the live token in dev — never in production (logs/aggregation)
  // or test (M1).
  const env = process.env.NODE_ENV;
  if (env !== "production" && env !== "test") console.log(`[mailer] magic link → ${email}: ${link}`);
  return msg;
}

export function drainMail() {
  return sink.splice(0);
}
