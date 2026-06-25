create table if not exists sessions (
  id text primary key,
  principal_type text not null check (principal_type in ('customer','admin')),
  principal_id bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists sessions_principal_idx on sessions (principal_type, principal_id);

create table if not exists magic_link_tokens (
  token_hash text primary key,
  email text not null check (email = lower(email)),
  intent text not null default 'login',
  order_code text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists magic_link_email_idx on magic_link_tokens (email, created_at desc);

create table if not exists admin_users (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email)),
  name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table customers add column if not exists password_hash text;
