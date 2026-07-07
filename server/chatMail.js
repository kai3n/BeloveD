// 라이브챗 이메일 — 상담 요청(내용+사진/영상)을 support@로 전달, 스태프 답장 시 오프라인 고객에게.
// mailer의 sendOrderMail(wrap 레이아웃) 재사용. 값은 반드시 HTML 이스케이프(메일 인젝션 방지),
// 첨부 링크는 http(s)만 렌더.
import { sendOrderMail } from "./mailer.js";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const isHttpUrl = (u) => /^https?:\/\//i.test(String(u || ""));

function site() {
  return process.env.PUBLIC_ORIGIN?.startsWith("https://") ? process.env.PUBLIC_ORIGIN : "https://belovediamond.com";
}

const ADMIN_CHAT_PATH = "/bo-4q9z7m/chat";
// 상담 요청 수신함 — 기본 support@belovediamond.com (CHAT_NOTIFY_EMAIL로 override)
const SUPPORT_EMAIL = () => process.env.CHAT_NOTIFY_EMAIL || "support@belovediamond.com";

const button = (href, label) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#16130f;color:#f8f7f5;padding:13px 24px;text-decoration:none;letter-spacing:.11em;font-size:13px">${label}</a></p>`;

// 첨부 렌더 — 이미지는 인라인, 그 외(영상 등)는 링크
function renderAttachments(attachments) {
  return (attachments || [])
    .filter((a) => a && isHttpUrl(a.url))
    .map((a) => {
      const url = escapeHtml(a.url);
      const name = escapeHtml(a.name || a.contentType || "attachment");
      if (String(a.contentType || "").startsWith("image/")) {
        return `<div><img src="${url}" alt="${name}" style="max-width:320px;border-radius:8px;margin:6px 0" /></div>`;
      }
      const label = String(a.contentType || "").startsWith("video/") ? `▶ ${name}` : `📎 ${name}`;
      return `<div style="margin:4px 0"><a href="${url}">${label}</a></div>`;
    })
    .join("");
}

// 상담 요청을 support@로 — 전체 대화 내용 + 모든 사진/영상 함께
export async function notifyConsultation({ threadCode, visitorEmail, customerName, messages }) {
  const to = SUPPORT_EMAIL();
  const who = customerName ? escapeHtml(customerName) : visitorEmail ? escapeHtml(visitorEmail) : "A visitor";
  const rows = (messages || [])
    .map((m) => {
      const label = m.sender === "staff" ? "BeloveD" : m.sender === "system" ? "System" : (customerName || visitorEmail || "Visitor");
      return `<div style="margin:12px 0">
        <div style="font-size:12px;color:#8f7d54;font-weight:700;letter-spacing:.04em">${escapeHtml(label)}</div>
        <div style="font-size:14px;line-height:1.55;color:#15130f">${escapeHtml(m.body || "")}</div>
        ${renderAttachments(m.attachments)}
      </div>`;
    })
    .join("");
  return sendOrderMail(
    to,
    `Consultation request — ${threadCode}${customerName ? ` · ${customerName}` : ""}`,
    `<p style="font-size:15px;line-height:1.6">New live-chat consultation from <strong>${who}</strong>${visitorEmail ? ` — reply-to ${escapeHtml(visitorEmail)}` : ""}.</p>
     <div style="border-top:1px solid #e6e0d4;margin-top:12px;padding-top:6px">${rows}</div>
     ${button(`${site()}${ADMIN_CHAT_PATH}`, "OPEN IN CONSOLE")}`,
    { type: "chat_consultation", threadCode, to, replyTo: visitorEmail || null },
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
     <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #8f7d54;color:#4a4640;font-size:14px">${escapeHtml(preview)}</blockquote>
     ${button(`${site()}/?chat=open`, t.cta)}`,
    { type: "chat_customer_reply", locale },
  );
}
