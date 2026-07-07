-- 라이브챗 — 익명 방문자·로그인 고객이 스태프와 1:1 대화. 스레드는 서버 발급
-- 토큰(bd_chat 쿠키, 해시 저장)으로 스코프 고정. 로그인 시 customer_id로 연결.
create sequence if not exists chat_code_seq start 100001;

create table if not exists chat_threads (
  id bigint generated always as identity primary key,
  thread_code text not null unique,                 -- CHAT-100001
  token_hash text unique,                            -- sha256(익명 bd_chat 토큰); 고객 전용이 되면 유지/무효 모두 가능
  customer_id bigint references customers(id) on delete set null,
  activity_session_id text,                          -- bd_aid — 스태프 컨텍스트 패널용
  status text not null default 'open' check (status in ('open', 'closed')),
  visitor_email text,                                -- 오프라인 이메일 답장용(알려진 경우)
  visitor_locale text not null default 'en',
  last_message_at timestamptz not null default now(),
  staff_unread int not null default 0,               -- 스태프가 마지막으로 읽은 뒤 인바운드 수
  customer_unread int not null default 0,            -- 방문자가 마지막으로 읽은 뒤 스태프 메시지 수
  customer_last_seen_at timestamptz,                 -- 오프라인 이메일 판단 기준
  staff_notified_at timestamptz,                     -- 스태프 알림 이메일 스로틀
  created_at timestamptz not null default now()
);
create index if not exists chat_threads_inbox_idx on chat_threads (status, last_message_at desc);
create index if not exists chat_threads_customer_idx on chat_threads (customer_id) where customer_id is not null;

create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references chat_threads(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'staff', 'system')),
  sender_admin_id bigint references admin_users(id) on delete set null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,    -- [{url, contentType, name}]
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on chat_messages (thread_id, id);
