-- 2단계 어드민: full(사람) / bot(자동화) — bot은 돈 관련 작업(설정 저장·제안 발송·결제 확인·잔금 요청·주문 취소) 불가
alter table admin_users add column if not exists role text not null default 'full'
  check (role in ('full', 'bot'));

-- bot_admin 세션 타입 허용 (0003의 principal_type 체크 확장)
alter table sessions drop constraint if exists sessions_principal_type_check;
alter table sessions add constraint sessions_principal_type_check
  check (principal_type in ('customer', 'admin', 'bot_admin'));
