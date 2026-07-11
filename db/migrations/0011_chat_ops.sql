-- 라이브챗 운영 도구 — 스레드 태그(가격/주문/AS/상담예약 등) + 담당자 배정
alter table chat_threads
  add column if not exists tags text[] not null default '{}',
  add column if not exists assigned_admin_id bigint references admin_users(id) on delete set null;

create index if not exists chat_threads_assigned_idx
  on chat_threads (assigned_admin_id) where assigned_admin_id is not null;
create index if not exists chat_threads_tags_idx on chat_threads using gin (tags);
