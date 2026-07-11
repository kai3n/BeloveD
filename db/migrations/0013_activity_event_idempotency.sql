-- pagehide/sendBeacon 재시도는 응답을 확인할 수 없어 같은 이벤트를 다시 보낼 수 있다.
-- 클라이언트가 생성한 UUID가 있는 이벤트만 전역 멱등 처리하고, 기존 ID 없는
-- 서버/레거시 이벤트는 종전처럼 정상 수집한다.
alter table activity_events
  add column if not exists client_event_id uuid;

create unique index if not exists activity_events_client_event_id_uidx
  on activity_events (client_event_id)
  where client_event_id is not null;
