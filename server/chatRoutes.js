import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { createUploadUrl } from "./media.js";
import { query } from "./db.js";
import { COOKIE_CHAT, setChatCookie, clearChatCookie } from "./middleware.js";
import { notifyConsultation, notifyBookingConfirmed } from "./chatMail.js";
import { sendPushToStaff } from "./push.js";
import { matchFaq } from "../src/lib/chatFaq.js";
import { generateAvailableSlots, isValidSlot, formatSlot } from "./consultationSlots.js";
import {
  newThreadToken, findThreadByToken, findCustomerThread, createVisitorThread,
  appendMessage, listMessages, markCustomerSeen, findThreadByCode,
  shouldNotifyStaff, markStaffNotified, setThreadStatus, setVisitorEmail, threadView, addThreadTag, setThreadCsat,
  listBookedSlots, createBooking,
} from "./chatRepository.js";

const MINUTE = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 위젯 헤더에 보여줄 응대 스태프 페르소나 (v1은 단일 공유 페르소나)
export const STAFF_AGENT = {
  name: process.env.CHAT_AGENT_NAME || "Emma",
  title: process.env.CHAT_AGENT_TITLE || "BeloveD concierge",
  avatar: process.env.CHAT_AGENT_AVATAR || null, // 없으면 위젯이 이니셜 아바타 렌더
};

function fireMail(promise, label) {
  Promise.resolve(promise).catch((e) => console.error(`[chatMail] ${label}: ${e.message}`));
}

// 현재 요청자의 스레드 해석 — 로그인 고객이면 고객 스레드, 아니면 bd_chat 토큰
async function resolveThread(req) {
  if (req.principal?.type === "customer") {
    const t = await findCustomerThread(req.principal.id);
    if (t) return t;
  }
  const token = req.cookies?.[COOKIE_CHAT];
  if (!token) return null;
  const t = await findThreadByToken(token);
  if (!t) return null;
  // 로그인 고객인데 토큰 스레드가 '다른 고객' 소유면 무시 — 공용/키오스크 브라우저에서
  // (로그아웃 없이) 이전 사용자의 대화가 새 로그인 사용자에게 노출되는 것을 막는다.
  if (req.principal?.type === "customer" && t.customer_id != null
      && Number(t.customer_id) !== Number(req.principal.id)) {
    return null;
  }
  return t;
}

// 없으면 새 스레드 + bd_chat 쿠키 발급 (항상 소유자 스코프가 보장됨)
async function resolveOrCreateThread(req, res, locale) {
  const existing = await resolveThread(req);
  if (existing) return existing;
  const token = newThreadToken();
  const thread = await createVisitorThread({
    token,
    activitySessionId: req.cookies?.bd_aid || null,
    locale: locale || "en",
    customerId: req.principal?.type === "customer" ? req.principal.id : null,
  });
  setChatCookie(res, token);
  return thread;
}

export function chatRouter() {
  const r = Router();

  // 방문자/고객 메시지 전송
  r.post("/messages",
    rateLimit({ limit: 20, windowMs: MINUTE, keyFn: (req) => `chat-send:${req.cookies?.bd_chat || req.ip}` }),
    async (req, res, next) => {
      try {
        const { body, attachments, locale, email } = req.body || {};
        const thread = await resolveOrCreateThread(req, res, locale);
        const validEmail = email && EMAIL_RE.test(String(email)) ? String(email).slice(0, 200) : null;
        if (validEmail) await setVisitorEmail(thread.id, validEmail);
        const message = await appendMessage(thread.id, { sender: "visitor", body, attachments });

        // FAQ 자동응답 — 기본 질문이면 컨시어지(자동)가 즉시 답변한다. 없으면 사람이 응대.
        let autoReply = null;
        const faq = matchFaq(body, thread.visitor_locale || locale || "en");
        if (faq) autoReply = await appendMessage(thread.id, { sender: "staff", body: faq.answer });

        // 스태프 데스크톱 알림(웹푸시) — 자동응답이 못 한(사람 필요)·미디어 포함, 또는
        // 명시적 '상담원 연결' 요청(consultation 매칭)이면 자동응답이 있어도 즉시 알린다.
        const wantsHuman = faq?.id === "consultation";
        const hasMediaPush = Array.isArray(attachments) && attachments.length > 0;
        if (!faq || wantsHuman || hasMediaPush) {
          sendPushToStaff({
            title: `New chat · ${thread.thread_code.replace("CHAT-", "#")}`,
            body: body && String(body).trim() ? String(body).slice(0, 120) : "📎 Attachment",
            code: thread.thread_code,
          }).catch(() => {});
        }

        // 상담 요청을 support@로 전달 — 신규/스로틀 해제 또는 사진·영상 포함 시,
        // 전체 대화 내용 + 모든 미디어를 함께 보낸다.
        const hasMedia = Array.isArray(attachments) && attachments.length > 0;
        if (shouldNotifyStaff(thread) || hasMedia || wantsHuman) {
          await markStaffNotified(thread.id);
          const cust = thread.customer_id
            ? (await query("select name from customers where id = $1", [thread.customer_id])).rows[0]
            : null;
          const transcript = await listMessages(thread.id, 0);
          fireMail(notifyConsultation({
            threadCode: thread.thread_code,
            visitorEmail: validEmail || thread.visitor_email || null,
            customerName: cust?.name || null,
            messages: transcript,
          }), "consultation");
        }

        const fresh = await findThreadByCode(thread.thread_code);
        res.status(201).json({ ok: true, thread: threadView(fresh), message, autoReply, staffAgent: STAFF_AGENT });
      } catch (e) { next(e); }
    });

  // 폴링 — since 이후 메시지. peek=1이면 읽음 처리·last_seen 갱신 안 함(닫힌 버블 뱃지용).
  r.get("/thread",
    rateLimit({ limit: 180, windowMs: MINUTE, keyFn: (req) => `chat-poll:${req.cookies?.bd_chat || req.ip}` }),
    async (req, res, next) => {
      try {
        const thread = await resolveThread(req);
        if (!thread) return res.json({ ok: true, thread: null, messages: [], staffAgent: STAFF_AGENT });
        const messages = await listMessages(thread.id, req.query.since);
        if (!req.query.peek) await markCustomerSeen(thread.id);
        const fresh = await findThreadByCode(thread.thread_code);
        res.json({ ok: true, thread: threadView(fresh), messages, staffAgent: STAFF_AGENT });
      } catch (e) { next(e); }
    });

  // 첨부 업로드 URL — 스레드 소유자로 스코프(없으면 생성). scope=chat 고정.
  r.post("/upload-url",
    rateLimit({ limit: 20, windowMs: MINUTE, keyFn: (req) => `chat-upload:${req.cookies?.bd_chat || req.ip}` }),
    async (req, res, next) => {
      try {
        const { contentType, size, locale } = req.body || {};
        if (typeof contentType !== "string") throw new ApiError("VALIDATION_ERROR", 400);
        await resolveOrCreateThread(req, res, locale);
        const signed = await createUploadUrl({ scope: "chat", contentType, size });
        res.status(201).json({ ok: true, ...signed });
      } catch (e) { next(e); }
    });

  // 예약 가능한 20분 슬롯(UTC ISO) — 위젯 캘린더가 방문자 로컬 시간대로 렌더.
  r.get("/consultation/slots",
    rateLimit({ limit: 30, windowMs: MINUTE, keyFn: (req) => `chat-slots:${req.cookies?.bd_chat || req.ip}` }),
    async (_req, res, next) => {
      try {
        const now = new Date();
        const to = new Date(now.getTime() + 20 * 86400000).toISOString();
        const booked = new Set(await listBookedSlots(now.toISOString(), to));
        res.json({ ok: true, slots: generateAvailableSlots(now, booked) });
      } catch (e) { next(e); }
    });

  // 화상 상담 예약 — 슬롯 확정. 시스템 메시지 + 'consultation' 태그 + 스태프 알림 + 고객 확정 메일(Zoom 링크).
  r.post("/consultation",
    rateLimit({ limit: 8, windowMs: MINUTE, keyFn: (req) => `chat-consult:${req.cookies?.bd_chat || req.ip}` }),
    async (req, res, next) => {
      try {
        const { name, contact, note, slot, tz, locale } = req.body || {};
        const now = new Date();
        if (!slot || !isValidSlot(String(slot), now)) throw new ApiError("VALIDATION_ERROR", 400, "invalid slot");
        const thread = await resolveOrCreateThread(req, res, locale);
        const email = contact && EMAIL_RE.test(String(contact)) ? String(contact).slice(0, 200) : null;
        if (email) await setVisitorEmail(thread.id, email);
        const booking = await createBooking({
          threadId: thread.id, slotStart: slot,
          name: name && String(name).slice(0, 80),
          contact: contact && String(contact).slice(0, 140),
          note: note && String(note).slice(0, 500),
        });
        if (!booking) throw new ApiError("SLOT_TAKEN", 409, "slot already booked");
        const ptLabel = formatSlot(slot); // 스태프용(영업 타임존 PT)
        const lines = [
          "📅 Consultation booked",
          `• When: ${ptLabel}`,
          name ? `• Name: ${String(name).slice(0, 80)}` : null,
          contact ? `• Contact: ${String(contact).slice(0, 140)}` : null,
          note ? `• Note: ${String(note).slice(0, 500)}` : null,
        ].filter(Boolean);
        const message = await appendMessage(thread.id, { sender: "system", body: lines.join("\n") });
        await addThreadTag(thread.id, "consultation");
        await query("update chat_threads set staff_unread = staff_unread + 1 where id = $1", [thread.id]);
        sendPushToStaff({
          title: `Consultation · ${thread.thread_code.replace("CHAT-", "#")}`,
          body: `Booked: ${ptLabel}`,
          code: thread.thread_code,
        }).catch(() => {});
        const cust = thread.customer_id
          ? (await query("select name from customers where id = $1", [thread.customer_id])).rows[0] : null;
        const transcript = await listMessages(thread.id, 0);
        fireMail(notifyConsultation({
          threadCode: thread.thread_code,
          visitorEmail: email || thread.visitor_email || null,
          customerName: cust?.name || name || null,
          messages: transcript,
        }), "consultation-booking");
        if (email) {
          const loc = thread.visitor_locale || locale || "en";
          fireMail(notifyBookingConfirmed({
            to: email, locale: loc, when: formatSlot(slot, tz, loc),
            meetingUrl: process.env.CONSULTATION_MEETING_URL || null,
          }), "booking-confirmed");
        }
        const fresh = await findThreadByCode(thread.thread_code);
        res.status(201).json({ ok: true, thread: threadView(fresh), message, slot, staffAgent: STAFF_AGENT });
      } catch (e) { next(e); }
    });

  // 이메일만 별도 저장(오프라인 이메일 답장용) — 메시지 없이도 저장 가능
  r.post("/email",
    rateLimit({ limit: 20, windowMs: MINUTE, keyFn: (req) => `chat-email:${req.cookies?.bd_chat || req.ip}` }),
    async (req, res, next) => {
      try {
        const { email, locale } = req.body || {};
        if (!email || !EMAIL_RE.test(String(email))) throw new ApiError("VALIDATION_ERROR", 400);
        const thread = await resolveOrCreateThread(req, res, locale);
        await setVisitorEmail(thread.id, String(email).slice(0, 200));
        res.json({ ok: true });
      } catch (e) { next(e); }
    });

  // 방문자가 대화 종료
  r.post("/close", async (req, res, next) => {
    try {
      const thread = await resolveThread(req);
      if (!thread) throw new ApiError("NOT_FOUND", 404);
      const updated = await setThreadStatus(thread.thread_code, "closed");
      clearChatCookie(res);
      res.json({ ok: true, thread: updated });
    } catch (e) { next(e); }
  });

  // CSAT — 대화 만족도(1~5). 스레드 소유자(쿠키/로그인)만.
  r.post("/csat",
    rateLimit({ limit: 10, windowMs: MINUTE, keyFn: (req) => `chat-csat:${req.cookies?.[COOKIE_CHAT] || req.ip}` }),
    async (req, res, next) => {
      try {
        const rating = Math.round(Number(req.body?.rating));
        if (!(rating >= 1 && rating <= 5)) throw new ApiError("VALIDATION_ERROR", 400, "rating 1-5");
        const thread = await resolveThread(req);
        if (!thread) throw new ApiError("NOT_FOUND", 404);
        await setThreadCsat(thread.id, rating);
        res.json({ ok: true });
      } catch (e) { next(e); }
    });

  return r;
}
