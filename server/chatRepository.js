import { randomBytes } from "node:crypto";
import { query, withTransaction } from "./db.js";
import { hashToken } from "./session.js";
import { nextCode } from "./codes.js";
import { ApiError } from "./errors.js";

// 라이브챗 저장소 — 스레드는 서버 발급 토큰(bd_chat, 해시 저장)이나 고객 세션으로만
// 접근. 채팅 본문은 마스킹하지 않는다: 1:1 비공개 채널이라 스태프가 연락처를 봐야 하고,
// 오프라인 이메일 답장을 위해 방문자가 남긴 이메일도 읽을 수 있어야 한다.

const BODY_MAX = 4000;
const ATTACH_MAX = 4;
const OFFLINE_AFTER_MS = 60 * 1000;            // 고객이 이 시간 이상 안 보면 오프라인 → 이메일
const STAFF_NOTIFY_THROTTLE_MS = 5 * 60 * 1000; // 스레드당 스태프 알림 이메일 스로틀

export function newThreadToken() {
  return randomBytes(32).toString("hex");
}

export function cleanBody(body) {
  return String(body ?? "").trim().slice(0, BODY_MAX);
}

export function sanitizeAttachments(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && typeof a.url === "string" && a.url)
    .slice(0, ATTACH_MAX)
    .map((a) => ({
      url: String(a.url).slice(0, 600),
      contentType: String(a.contentType || "").slice(0, 120),
      name: String(a.name || "").slice(0, 200),
    }));
}

export function messageView(row) {
  return {
    id: Number(row.id),
    sender: row.sender,
    body: row.body,
    attachments: row.attachments || [],
    senderAdminId: row.sender_admin_id != null ? Number(row.sender_admin_id) : null,
    createdAt: row.created_at,
  };
}

export function threadView(row) {
  return {
    code: row.thread_code,
    status: row.status,
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    visitorEmail: row.visitor_email || null,
    locale: row.visitor_locale,
    lastMessageAt: row.last_message_at,
    staffUnread: row.staff_unread,
    customerUnread: row.customer_unread,
    createdAt: row.created_at,
  };
}

// ── 조회 ────────────────────────────────────────────────────────────────
export async function findThreadByToken(token) {
  if (!token) return null;
  const { rows } = await query("select * from chat_threads where token_hash = $1", [hashToken(token)]);
  return rows[0] || null;
}

export async function findThreadByCode(code) {
  if (!code) return null;
  const { rows } = await query("select * from chat_threads where thread_code = $1", [String(code)]);
  return rows[0] || null;
}

// 고객의 가장 최근 스레드 (열린 것 우선)
export async function findCustomerThread(customerId) {
  if (!customerId) return null;
  const { rows } = await query(
    `select * from chat_threads where customer_id = $1
     order by (status = 'open') desc, last_message_at desc limit 1`,
    [customerId],
  );
  return rows[0] || null;
}

export async function listMessages(threadId, sinceId = 0) {
  const { rows } = await query(
    "select * from chat_messages where thread_id = $1 and id > $2 order by id asc",
    [threadId, Number(sinceId) || 0],
  );
  return rows.map(messageView);
}

// ── 생성·추가 ────────────────────────────────────────────────────────────
export async function createVisitorThread({ token, activitySessionId = null, locale = "en", customerId = null, visitorEmail = null }) {
  return withTransaction(async (client) => {
    const code = await nextCode(client, "CHAT");
    const { rows } = await client.query(
      `insert into chat_threads (thread_code, token_hash, activity_session_id, visitor_locale, customer_id, visitor_email)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [code, token ? hashToken(token) : null, activitySessionId, String(locale || "en").slice(0, 5), customerId, visitorEmail],
    );
    return rows[0];
  });
}

// 메시지 추가 + 미확인 카운터/타임스탬프 갱신. sender: 'visitor' | 'staff' | 'system'
export async function appendMessage(threadId, { sender, senderAdminId = null, body = "", attachments = [] }) {
  const cleanedBody = cleanBody(body);
  const atts = sanitizeAttachments(attachments);
  if (!cleanedBody && atts.length === 0) throw new ApiError("VALIDATION_ERROR", 400, "empty message");
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into chat_messages (thread_id, sender, sender_admin_id, body, attachments)
       values ($1, $2, $3, $4, $5) returning *`,
      [threadId, sender, senderAdminId, cleanedBody, JSON.stringify(atts)],
    );
    // 방문자 메시지 → staff_unread++, 스태프 메시지 → customer_unread++
    const unreadCol = sender === "visitor" ? "staff_unread" : sender === "staff" ? "customer_unread" : null;
    await client.query(
      `update chat_threads set last_message_at = now()
        ${unreadCol ? `, ${unreadCol} = ${unreadCol} + 1` : ""}
       where id = $1`,
      [threadId],
    );
    return messageView(rows[0]);
  });
}

// ── 읽음 처리 ────────────────────────────────────────────────────────────
export async function markStaffRead(threadId) {
  await query("update chat_threads set staff_unread = 0 where id = $1", [threadId]);
}

export async function markCustomerSeen(threadId) {
  await query(
    "update chat_threads set customer_unread = 0, customer_last_seen_at = now() where id = $1",
    [threadId],
  );
}

// ── 로그인 연결 ──────────────────────────────────────────────────────────
// 로그인 성공 시 익명 bd_chat 스레드를 고객과 연결. 이미 고객 스레드가 있으면 병합하지 않고
// 토큰 스레드에 customer_id만 부여(단순화). 이메일 백필.
export async function linkChatToCustomer(token, customerId, email = null) {
  if (!token || !customerId) return;
  await query(
    `update chat_threads
       set customer_id = $2,
           visitor_email = coalesce(visitor_email, $3)
     where token_hash = $1 and (customer_id is null or customer_id = $2)`,
    [hashToken(token), customerId, email],
  );
}

// ── 알림 판단 ────────────────────────────────────────────────────────────
export function shouldNotifyStaff(threadRow) {
  const last = threadRow.staff_notified_at ? new Date(threadRow.staff_notified_at).getTime() : 0;
  return Date.now() - last > STAFF_NOTIFY_THROTTLE_MS;
}

export async function markStaffNotified(threadId) {
  await query("update chat_threads set staff_notified_at = now() where id = $1", [threadId]);
}

// 스태프 답장 시 고객이 오프라인이면 이메일 (마지막 조회가 오래됨 & 이메일 알려짐)
export function customerIsOffline(threadRow) {
  const seen = threadRow.customer_last_seen_at ? new Date(threadRow.customer_last_seen_at).getTime() : 0;
  return Date.now() - seen > OFFLINE_AFTER_MS;
}

// ── 상태 ────────────────────────────────────────────────────────────────
export async function setThreadStatus(code, status) {
  if (status !== "open" && status !== "closed") throw new ApiError("VALIDATION_ERROR", 400, "bad status");
  const { rows } = await query(
    "update chat_threads set status = $2 where thread_code = $1 returning *",
    [String(code), status],
  );
  if (!rows[0]) throw new ApiError("NOT_FOUND", 404);
  return threadView(rows[0]);
}

export async function setVisitorEmail(threadId, email) {
  await query("update chat_threads set visitor_email = $2 where id = $1", [threadId, email]);
}

// ── 어드민 인박스 ────────────────────────────────────────────────────────
export async function listInboxThreads({ status = "open" } = {}) {
  const { rows } = await query(
    `select t.*, c.name as customer_name, c.email as customer_email,
       (select body from chat_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_body,
       (select sender from chat_messages m where m.thread_id = t.id order by m.id desc limit 1) as last_sender
     from chat_threads t
     left join customers c on c.id = t.customer_id
     ${status === "all" ? "" : "where t.status = $1"}
     order by t.staff_unread > 0 desc, t.last_message_at desc
     limit 100`,
    status === "all" ? [] : [status],
  );
  return rows.map((r) => ({
    ...threadView(r),
    customerName: r.customer_name || null,
    customerEmail: r.customer_email || null,
    preview: (r.last_body || "").slice(0, 120),
    lastSender: r.last_sender || null,
  }));
}

// 스레드 컨텍스트 — 연결된 고객·주문·최근 활동 (스태프 사이드 패널)
export async function threadContext(threadRow) {
  const ctx = { customer: null, orders: [], activity: [] };
  if (threadRow.customer_id) {
    const c = await query("select id, name, email, locale, created_at from customers where id = $1", [threadRow.customer_id]);
    ctx.customer = c.rows[0]
      ? { name: c.rows[0].name, email: c.rows[0].email, locale: c.rows[0].locale, since: c.rows[0].created_at }
      : null;
    const o = await query(
      "select order_code, stage, created_at from customer_orders where customer_id = $1 order by created_at desc limit 10",
      [threadRow.customer_id],
    );
    ctx.orders = o.rows.map((row) => ({ orderCode: row.order_code, stage: row.stage, createdAt: row.created_at }));
  }
  if (threadRow.activity_session_id) {
    const a = await query(
      "select event_type, path, entity_id, created_at from activity_events where session_id = $1 order by id desc limit 12",
      [threadRow.activity_session_id],
    );
    ctx.activity = a.rows.map((row) => ({ type: row.event_type, path: row.path, entityId: row.entity_id, at: row.created_at }));
  }
  return ctx;
}
