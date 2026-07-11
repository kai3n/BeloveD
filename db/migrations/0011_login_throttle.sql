-- Durable, cross-instance login throttling.
-- The in-memory rate limiter (server/rateLimit.js) resets per serverless
-- instance and is keyed by IP, so it is bypassable by IP rotation on Vercel.
-- Password brute-force protection therefore lives in the DB instead.
create table if not exists login_attempts (
  id bigserial primary key,
  email text not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_time on login_attempts (email, created_at);
create index if not exists login_attempts_time on login_attempts (created_at);

-- Supports the durable per-email OTP issuance cap in createLoginCode().
create index if not exists login_codes_email_time on login_codes (email, created_at);
