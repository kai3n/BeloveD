-- 이메일 6자리 인증번호(OTP) 로그인 — 코드는 해시로만 저장, 시도 횟수 제한
create table if not exists login_codes (
  id bigserial primary key,
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_codes_email_idx on login_codes (email, created_at desc);
