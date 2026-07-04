-- 카탈로그·운영 설정 서버 배선 — 어드민 편집이 고객에게 도달하도록.
-- starter_designs.payload: 클라이언트 스타일 객체 원본(무손실) — 기존 좁은 컬럼은
-- 정렬/필터용 인덱스 컬럼으로만 유지한다.
alter table starter_designs add column if not exists payload jsonb not null default '{}'::jsonb;

-- 키-값 설정 저장소 — diamondPricing / metalRefUsdPerG / payment(Zelle·Venmo) /
-- designCopy / styleSpecs / 견적 정책값. 값은 jsonb 원본 그대로.
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- 0001의 자리표시 시드(RING-SOL-001 등)는 서빙 라우트가 없어 고객에게 노출된 적 없음 —
-- payload 기반 카탈로그로 대체되므로 제거한다.
delete from starter_designs where payload = '{}'::jsonb;
