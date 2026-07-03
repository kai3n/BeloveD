-- 0006: 카테고리 제약을 위저드 키와 정렬 — 손목 카테고리의 실제 키는 'bangle'
-- (0001은 'bracelet'만 허용해 bangle 인테이크가 500으로 전부 유실됐다. bracelet은 하위호환으로 유지)
alter table customer_intakes drop constraint if exists customer_intakes_category_check;
alter table customer_intakes add constraint customer_intakes_category_check
  check (category in ('ring', 'earrings', 'bracelet', 'bangle', 'necklace'));

alter table starter_designs drop constraint if exists starter_designs_category_check;
alter table starter_designs add constraint starter_designs_category_check
  check (category in ('ring', 'earrings', 'bracelet', 'bangle', 'necklace'));
