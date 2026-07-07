import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { requireAdmin } from "./middleware.js";
import { STAFF_AGENT } from "./chatRoutes.js";
import { notifyCustomerReply } from "./chatMail.js";
import {
  listInboxThreads, findThreadByCode, listMessages, markStaffRead,
  appendMessage, threadContext, setThreadStatus, customerIsOffline, threadView,
} from "./chatRepository.js";

const MINUTE = 60 * 1000;

function fireMail(promise, label) {
  Promise.resolve(promise).catch((e) => console.error(`[chatMail] ${label}: ${e.message}`));
}

export function adminChatRouter() {
  const r = Router();
  r.use(requireAdmin); // 라우터 레벨 백스톱 — 이 아래 모든 경로는 어드민 전용

  // 인박스 목록
  r.get("/chat/threads",
    rateLimit({ limit: 120, windowMs: MINUTE, keyFn: (req) => `admin-chat:${req.ip}` }),
    async (req, res, next) => {
      try {
        const status = req.query.status === "all" || req.query.status === "closed" ? req.query.status : "open";
        res.json({ ok: true, threads: await listInboxThreads({ status }) });
      } catch (e) { next(e); }
    });

  // 스레드 상세 + 컨텍스트 (읽음 처리)
  r.get("/chat/threads/:code",
    rateLimit({ limit: 240, windowMs: MINUTE, keyFn: (req) => `admin-chat:${req.ip}` }),
    async (req, res, next) => {
      try {
        const t = await findThreadByCode(req.params.code);
        if (!t) throw new ApiError("NOT_FOUND", 404);
        const messages = await listMessages(t.id, req.query.since);
        await markStaffRead(t.id);
        const context = await threadContext(t);
        res.json({ ok: true, thread: threadView(t), messages, context, staffAgent: STAFF_AGENT });
      } catch (e) { next(e); }
    });

  // 스태프 답장 — 고객 오프라인이면 이메일 폴백
  r.post("/chat/threads/:code/messages",
    rateLimit({ limit: 60, windowMs: MINUTE, keyFn: (req) => `admin-chat-send:${req.ip}` }),
    async (req, res, next) => {
      try {
        const { body, attachments } = req.body || {};
        const t = await findThreadByCode(req.params.code);
        if (!t) throw new ApiError("NOT_FOUND", 404);
        const message = await appendMessage(t.id, {
          sender: "staff", senderAdminId: req.principal.id, body, attachments,
        });
        if (customerIsOffline(t) && t.visitor_email) {
          fireMail(notifyCustomerReply({
            to: t.visitor_email, locale: t.visitor_locale, preview: message.body || "(image)",
          }), "customer-reply");
        }
        res.status(201).json({ ok: true, message });
      } catch (e) { next(e); }
    });

  // 상태 변경 (open/closed)
  r.post("/chat/threads/:code/status",
    rateLimit({ limit: 60, windowMs: MINUTE, keyFn: (req) => `admin-chat:${req.ip}` }),
    async (req, res, next) => {
      try {
        res.json({ ok: true, thread: await setThreadStatus(req.params.code, req.body?.status) });
      } catch (e) { next(e); }
    });

  return r;
}
