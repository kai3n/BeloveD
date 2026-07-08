import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { requireAdmin } from "./middleware.js";
import { STAFF_AGENT } from "./chatRoutes.js";
import { notifyCustomerReply } from "./chatMail.js";
import {
  listInboxThreads, findThreadByCode, listMessages, markStaffRead,
  appendMessage, threadContext, setThreadStatus, customerIsOffline, threadView,
  setThreadTags, assignThread, chatStats,
} from "./chatRepository.js";
import { vapidPublicKey, saveSubscription, removeSubscription, pushEnabled } from "./push.js";

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
        res.json({ ok: true, threads: await listInboxThreads({ status, tag: req.query.tag || null }) });
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

  // 태그 설정 (전체 교체)
  r.post("/chat/threads/:code/tags",
    rateLimit({ limit: 60, windowMs: MINUTE, keyFn: (req) => `admin-chat:${req.ip}` }),
    async (req, res, next) => {
      try { res.json({ ok: true, thread: await setThreadTags(req.params.code, req.body?.tags) }); }
      catch (e) { next(e); }
    });

  // 담당자 배정 — self=true면 로그인 스태프에게, 아니면 해제
  r.post("/chat/threads/:code/assign",
    rateLimit({ limit: 60, windowMs: MINUTE, keyFn: (req) => `admin-chat:${req.ip}` }),
    async (req, res, next) => {
      try {
        const adminId = req.body?.self ? req.principal.id : null;
        res.json({ ok: true, thread: await assignThread(req.params.code, adminId) });
      } catch (e) { next(e); }
    });

  // 인박스 통계 (스탯 스트립)
  r.get("/chat/stats",
    rateLimit({ limit: 120, windowMs: MINUTE, keyFn: (req) => `admin-chat:${req.ip}` }),
    async (_req, res, next) => {
      try { res.json({ ok: true, stats: await chatStats() }); }
      catch (e) { next(e); }
    });

  // 웹푸시 — VAPID 공개키 + 활성 여부
  r.get("/chat/push/key", (_req, res) => res.json({ ok: true, key: vapidPublicKey(), enabled: pushEnabled }));

  // 데스크톱 알림 구독 등록 / 해제
  r.post("/chat/push/subscribe", async (req, res, next) => {
    try { await saveSubscription(req.principal.id, req.body?.subscription); res.json({ ok: true }); }
    catch (e) { next(e); }
  });
  r.post("/chat/push/unsubscribe", async (req, res, next) => {
    try { await removeSubscription(req.body?.endpoint); res.json({ ok: true }); }
    catch (e) { next(e); }
  });

  return r;
}
