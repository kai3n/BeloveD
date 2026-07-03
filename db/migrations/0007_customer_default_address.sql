-- 0007: 배송지를 회원 프로필에도 저장 — 다음 주문에서 프리필, 어드민 CRM에 노출
alter table customers add column if not exists default_address jsonb;
