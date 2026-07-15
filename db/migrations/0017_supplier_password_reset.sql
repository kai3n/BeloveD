create table if not exists supplier_password_reset_tokens (
  token_hash text primary key,
  supplier_id bigint not null references suppliers(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists supplier_password_reset_supplier_created_idx
  on supplier_password_reset_tokens (supplier_id, created_at desc);

create index if not exists supplier_password_reset_expiry_idx
  on supplier_password_reset_tokens (expires_at)
  where used_at is null;
