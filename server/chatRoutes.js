import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { createUploadUrl } from "./media.js";
import { query } from "./db.js";
import { COOKIE_CHAT, setChatCookie, clearChatCookie } from "./middleware.js";
import { notifyStaffNewChat } from "./chatMail.js";
import {
  newThreadToken, findThreadByToken, findCustomerThread, createVisitorThread,
  appendMessage, listMessages, markCustomerSeen, findThreadByCode,
  shouldNotifyStaff, markStaffNotified, setThreadStatus, setVisitorEmail, threadView,
} from "./chatRepository.js";

const MINUTE = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 위젯 헤더에 보여줄 응대 스태프 페르소나 (v1은 단일 공유 페르소나)
export const STAFF_AGENT = {
  name: process.env.CHAT_AGENT_NAME || "Sophie",
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
  return token ? findThreadByToken(token) : null;
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
        if (email && EMAIL_RE.test(String(email))) await setVisitorEmail(thread.id, String(email).slice(0, 200));
        const message = await appendMessage(thread.id, { sender: "visitor", body, attachments });
        // 스태프 알림 (스레드당 스로틀) — 전송 전 상태로 판단
        if (shouldNotifyStaff(thread)) {
          await markStaffNotified(thread.id);
          const c = thread.customer_id
            ? (await query("select name from customers where id = $1", [thread.customer_id])).rows[0]
            : null;
          fireMail(notifyStaffNewChat({
            threadCode: thread.thread_code,
            preview: message.body || "(image)",
            customerName: c?.name || null,
          }), "staff-notify");
        }
        const fresh = await findThreadByCode(thread.thread_code);
        res.status(201).json({ ok: true, thread: threadView(fresh), message, staffAgent: STAFF_AGENT });
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

  return r;
}
