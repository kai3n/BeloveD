import { query, withTransaction } from "./db.js";
import { ApiError } from "./errors.js";

// 방문자 행동 이벤트 화이트리스트 — 여기 없는 타입은 수집 자체를 거부한다.
export const EVENT_TYPES = new Set([
  "page_view", "style_click", "style_view", "option_select", "media_zoom",
  "intake_start", "intake_submit", "review_submit", "login", "signup",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertSessionId(sessionId) {
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
    throw new ApiError("VALIDATION_ERROR", 400, "invalid session id");
  }
}

function assertClientEventId(eventId) {
  if (eventId !== undefined && eventId !== null && (typeof eventId !== "string" || !UUID_RE.test(eventId))) {
    throw new ApiError("VALIDATION_ERROR", 400, "invalid event id");
  }
}

// 세션 upsert(last_seen 갱신) + 이벤트 일괄 기록.
// events[i] = { id?: UUID, type, path?, entityType?, entityId?, meta? }
export async function recordEvents({ sessionId, userAgent = null, events }) {
  assertSessionId(sessionId);
  if (!Array.isArray(events) || events.length === 0) return { inserted: 0 };
  for (const ev of events) {
    if (!ev || !EVENT_TYPES.has(ev.type)) throw new ApiError("VALIDATION_ERROR", 400, "unknown event type");
    assertClientEventId(ev.id);
  }
  return withTransaction(async (client) => {
    await client.query(
      `insert into activity_sessions (session_id, user_agent) values ($1, $2)
       on conflict (session_id) do update set last_seen = now()`,
      [sessionId, userAgent]);
    let inserted = 0;
    for (const ev of events) {
      const result = await client.query(
        `insert into activity_events (session_id, client_event_id, event_type, path, entity_type, entity_id, meta)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (client_event_id) where client_event_id is not null do nothing
         returning id`,
        [sessionId, ev.id ?? null, ev.type, ev.path ?? null, ev.entityType ?? null, ev.entityId ?? null,
         ev.meta ? JSON.stringify(ev.meta) : null]);
      inserted += result.rowCount;
    }
    return { inserted };
  });
}

// 로그인 성공 시 익명 세션을 회원과 연결 — 과거 이벤트는 조인으로 자동 포함된다.
export async function linkSessionToCustomer(sessionId, customerId) {
  assertSessionId(sessionId);
  await query(
    `insert into activity_sessions (session_id, customer_id) values ($1, $2)
     on conflict (session_id) do update set customer_id = excluded.customer_id, last_seen = now()`,
    [sessionId, customerId]);
}

export async function recordAuthEvent(sessionId, type) {
  if (type !== "login" && type !== "signup") throw new ApiError("VALIDATION_ERROR", 400);
  await recordEvents({ sessionId, events: [{ type }] });
}
