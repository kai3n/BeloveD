-- 고객 리뷰 — 배송 완료 주문 인증(주문번호+운송장) 후 제출, 어드민 검수(published) 후 홈 노출.
-- order_id가 null이면 어드민이 수동 큐레이션한 리뷰(레거시 시드 이관 포함).
create sequence if not exists review_code_seq start 100001;

create table if not exists customer_reviews (
  id bigint generated always as identity primary key,
  review_code text not null unique,
  order_id bigint references customer_orders(id) on delete set null,
  name text not null default '',
  location text not null default '',
  rating int not null default 5 check (rating between 1 and 5),
  quote text not null default '',
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 주문당 살아있는(숨김 아님) 리뷰는 1건 — 동시 제출 레이스는 이 인덱스가 막는다
create unique index if not exists customer_reviews_one_live_per_order
  on customer_reviews (order_id) where order_id is not null and status <> 'hidden';

create index if not exists customer_reviews_status_idx
  on customer_reviews (status, created_at desc);
