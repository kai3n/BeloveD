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

const BOOKING_COPY = {
  en: { subject: "Your BeloveD video consultation is booked", line: (w) => `You're booked for a video consultation on <strong>${w}</strong>.`, join: "Join the video call", noLink: "We'll send your video link before the call.", note: "Add it to your calendar. Reply to this email to reschedule." },
  ko: { subject: "BeloveD 화상 상담 예약이 확정됐어요", line: (w) => `<strong>${w}</strong>에 화상 상담이 예약되었어요.`, join: "화상 상담 입장", noLink: "상담 전에 화상 링크를 보내드릴게요.", note: "캘린더에 추가해 주세요. 일정 변경은 이 메일에 답장해 주세요." },
  zh: { subject: "您的 BeloveD 视频咨询已预约", line: (w) => `您已预约 <strong>${w}</strong> 的视频咨询。`, join: "加入视频通话", noLink: "我们会在通话前发送视频链接。", note: "请加入日历。如需改期，请回复此邮件。" },
  es: { subject: "Tu videoconsulta con BeloveD está reservada", line: (w) => `Tienes una videoconsulta reservada el <strong>${w}</strong>.`, join: "Unirse a la videollamada", noLink: "Te enviaremos el enlace antes de la llamada.", note: "Agrégalo a tu calendario. Responde a este correo para reprogramar." },
};

// 예약 확정 메일 — 고객에게 선택 슬롯 + Zoom 링크(CONSULTATION_MEETING_URL). 링크 없으면 안내만.
export async function notifyBookingConfirmed({ to, locale = "en", when, meetingUrl }) {
  if (!to) return null;
  const t = BOOKING_COPY[locale] || BOOKING_COPY.en;
  const link = isHttpUrl(meetingUrl)
    ? button(escapeHtml(meetingUrl), t.join)
    : `<p style="font-size:14px;color:#6a6357">${t.noLink}</p>`;
  return sendOrderMail(
    to,
    t.subject,
    `<p style="font-size:15px;line-height:1.6">${t.line(escapeHtml(when))}</p>
     ${link}
     <p style="font-size:13px;color:#8a8377;line-height:1.5">${t.note}</p>`,
    { type: "chat_booking_confirmed", locale, to },
  );
}

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
