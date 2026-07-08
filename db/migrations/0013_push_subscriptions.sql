-- 스태프 웹푸시 구독 (브라우저 엔드포인트별)
create table if not exists push_subscriptions (
  id bigserial primary key,
  admin_id bigint not null references admin_users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_admin_idx on push_subscriptions (admin_id);
