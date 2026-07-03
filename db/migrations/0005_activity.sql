-- 방문자 행동 로그 (스펙: docs/superpowers/specs/2026-07-02-admin-activity-dashboard-design.md)
-- 익명 세션(bd_aid 쿠키) 단위로 이벤트를 쌓고, 로그인 시 customer_id를 채워 조인으로 연결한다.
create table if not exists activity_sessions (
  session_id  uuid primary key,
  customer_id bigint references customers(id),
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  user_agent  text
);
create index if not exists activity_sessions_customer_idx on activity_sessions (customer_id) where customer_id is not null;

create table if not exists activity_events (
  id          bigserial primary key,
  session_id  uuid not null,
  event_type  text not null,
  path        text,
  entity_type text,
  entity_id   text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_events_session_idx on activity_events (session_id, created_at);
create index if not exists activity_events_type_idx on activity_events (event_type, created_at);
create index if not exists activity_events_entity_idx on activity_events (entity_id) where entity_id is not null;

-- 90일 지난 원본을 지워도 트렌드가 남는 일별 집계 (유지보수 크론이 upsert)
create table if not exists activity_daily (
  day         date not null,
  event_type  text not null,
  entity_id   text not null default '',
  count       integer not null,
  primary key (day, event_type, entity_id)
);
