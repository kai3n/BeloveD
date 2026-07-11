-- 화상 상담 예약 슬롯 (20분 단위). 한 슬롯당 booked 1건만 허용.
create table if not exists consultation_bookings (
  id bigserial primary key,
  thread_id bigint references chat_threads(id) on delete set null,
  slot_start timestamptz not null,
  name text,
  contact text,
  note text,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at timestamptz not null default now()
);

create unique index if not exists consultation_bookings_slot_uniq
  on consultation_bookings (slot_start) where status = 'booked';
create index if not exists consultation_bookings_slot_idx on consultation_bookings (slot_start);
