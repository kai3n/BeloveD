import { query } from "./db.js";

// 끝난 날(오늘 이전)의 원본을 일별 집계로 적재하고, 90일 지난 원본과
// 90일 미활동·미연결 세션을 정리한다. 하루 1회 크론 호출 (멱등 — upsert).
export async function runActivityMaintenance() {
  const rollup = await query(`
    insert into activity_daily (day, event_type, entity_id, count)
    select created_at::date, event_type, coalesce(entity_id, ''), count(*)
    from activity_events
    where created_at < date_trunc('day', now())
    group by 1, 2, 3
    on conflict (day, event_type, entity_id) do update set count = excluded.count
    returning 1`);
  const pruneEvents = await query(
    "delete from activity_events where created_at < now() - interval '90 days' returning 1");
  const pruneSessions = await query(
    `delete from activity_sessions
     where customer_id is null and last_seen < now() - interval '90 days' returning 1`);
  return { rolledUp: rollup.rowCount, prunedEvents: pruneEvents.rowCount, prunedSessions: pruneSessions.rowCount };
}
