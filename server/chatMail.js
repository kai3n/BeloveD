// 라이브챗 이메일 알림 — 새 인바운드 시 스태프에게, 스태프 답장 시 오프라인 고객에게.
// mailer의 sendOrderMail(wrap 레이아웃)을 재사용. 값은 반드시 HTML 이스케이프(메일 인젝션 방지).
import { query } from "./db.js";
import { sendOrderMail } from "./mailer.js";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function site() {
  return process.env.PUBLIC_ORIGIN?.startsWith("https://") ? process.env.PUBLIC_ORIGIN : "https://belovediamond.com";
}

const ADMIN_CHAT_PATH = "/bo-4q9z7m/chat";

async function staffRecipient() {
  if (process.env.CHAT_NOTIFY_EMAIL) return process.env.CHAT_NOTIFY_EMAIL;
  const { rows } = await query("select email from admin_users where active = true order by id limit 1");
  return rows[0]?.email || null;
}

const quote = (text) =>
  `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #8f7d54;color:#4a4640;font-size:14px">${escapeHtml(text)}</blockquote>`;
const button = (href, label) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#16130f;color:#f8f7f5;padding:13px 24px;text-decoration:none;letter-spacing:.11em;font-size:13px">${label}</a></p>`;

export async function notifyStaffNewChat({ threadCode, preview, customerName }) {
  const to = await staffRecipient();
  if (!to) return null;
  const who = customerName ? escapeHtml(customerName) : "A visitor";
  return sendOrderMail(
    to,
    `New chat — ${threadCode}`,
    `<p style="font-size:15px;line-height:1.6">${who} started a chat and is waiting for a reply.</p>
     ${quote(preview)}
     ${button(`${site()}${ADMIN_CHAT_PATH}`, "OPEN INBOX")}`,
    { type: "chat_staff_notify", threadCode },
  );
}

const CUSTOMER_COPY = {
  en: { subject: "BeloveD replied to your message", line: "Our team just replied to your chat.", cta: "VIEW REPLY" },
  ko: { subject: "BeloveD가 답장을 보냈어요", line: "상담팀이 방금 채팅에 답장했어요.", cta: "답장 보기" },
  zh: { subject: "BeloveD 已回复您的消息", line: "我们的团队刚刚回复了您的聊天。", cta: "查看回复" },
  es: { subject: "BeloveD respondió a tu mensaje", line: "Nuestro equipo acaba de responder a tu chat.", cta: "VER RESPUESTA" },
};

export async function notifyCustomerReply({ to, locale = "en", preview }) {
  if (!to) return null;
  const t = CUSTOMER_COPY[locale] || CUSTOMER_COPY.en;
  return sendOrderMail(
    to,
    t.subject,
    `<p style="font-size:15px;line-height:1.6">${t.line}</p>
     ${quote(preview)}
     ${button(`${site()}/?chat=open`, t.cta)}`,
    { type: "chat_customer_reply", locale },
  );
}
