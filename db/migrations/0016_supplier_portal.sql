-- Multi-vendor portal foundation. Product decision: one vendor = one login.
-- Every vendor-owned row carries supplier_id; the API derives it from session.
create sequence if not exists supplier_code_seq start 100001;
create sequence if not exists supplier_job_code_seq start 100001;

create table if not exists suppliers (
  id bigint generated always as identity primary key,
  supplier_code text not null unique,
  display_name text not null,
  email text not null unique check (email = lower(email)),
  contact_name text not null,
  password_hash text,
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'archived')),
  locale text not null default 'zh' check (locale in ('zh', 'en', 'ko')),
  timezone text not null default 'Asia/Shanghai',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists supplier_invites (
  token_hash text primary key,
  supplier_id bigint not null references suppliers(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by_admin_id bigint references admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists supplier_order_assignments (
  id bigint generated always as identity primary key,
  job_code text,
  supplier_id bigint not null references suppliers(id) on delete restrict,
  order_id bigint not null references customer_orders(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'revoked')),
  workflow_state text not null default 'ASSIGNED' check (workflow_state in (
    'ASSIGNED', 'CANDIDATES_REQUIRED', 'CANDIDATES_REVIEW', 'CANDIDATES_CHANGES',
    'CUSTOMER_STONE_SELECTION', 'DIAMOND_LOCKED',
    'ESTIMATE_REQUIRED', 'ESTIMATE_REVIEW', 'ESTIMATE_CHANGES', 'ESTIMATE_APPROVED',
    'QUOTE_CUSTOMER_REVIEW', 'DEPOSIT_REQUIRED',
    'DESIGN_REQUIRED', 'DESIGN_REVIEW', 'DESIGN_CHANGES', 'CUSTOMER_CAD_REVIEW', 'DESIGN_APPROVED',
    'IN_PRODUCTION', 'PROGRESS_REVIEW', 'PROGRESS_CHANGES', 'QC_REQUIRED', 'QC_REVIEW',
    'QC_CHANGES', 'QC_APPROVED', 'HANDOFF_READY', 'COMPLETED'
  )),
  assigned_by_admin_id bigint references admin_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  locked_diamond_ref text,
  diamond_locked_at timestamptz,
  customer_quote_accepted_at timestamptz,
  deposit_confirmed_at timestamptz,
  due_at timestamptz,
  revoked_at timestamptz,
  unique (supplier_id, order_id)
);

-- Vendors use this procurement task code. The customer-facing/internal order
-- code is deliberately not exposed by the vendor API.
alter table supplier_order_assignments add column if not exists job_code text;
update supplier_order_assignments
set job_code = 'JOB-' || lpad(nextval('supplier_job_code_seq')::text, 6, '0')
where job_code is null;
alter table supplier_order_assignments
  alter column job_code set default ('JOB-' || lpad(nextval('supplier_job_code_seq')::text, 6, '0')),
  alter column job_code set not null;
create unique index if not exists supplier_assignments_job_code_idx
  on supplier_order_assignments (job_code);

-- MVP: one active primary vendor per order. Historical/revoked assignments remain.
create unique index if not exists supplier_order_one_active_idx
  on supplier_order_assignments (order_id) where status = 'active';

create table if not exists supplier_updates (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references suppliers(id) on delete restrict,
  order_id bigint not null references customer_orders(id) on delete cascade,
  update_type text not null check (update_type in ('ACKNOWLEDGE', 'NOTE', 'STONE', 'ESTIMATE', 'CAD', 'PROGRESS', 'QC', 'SHIPPING', 'HANDOFF_READY')),
  note text,
  media jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  review_status text not null default 'submitted'
    check (review_status in ('submitted', 'approved', 'changes_requested', 'superseded')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by_admin_id bigint references admin_users(id) on delete set null,
  supersedes_update_id bigint references supplier_updates(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists supplier_inventory (
  id bigint generated always as identity primary key,
  supplier_id bigint not null references suppliers(id) on delete cascade,
  supplier_sku text not null,
  certificate_no text,
  shape text,
  carat numeric(8,3),
  color text,
  clarity text,
  growth_method text,
  procurement_cost_usd numeric(12,2),
  availability text not null default 'available' check (availability in ('available', 'reserved', 'unavailable', 'sold')),
  reserved_order_id bigint references customer_orders(id) on delete set null,
  media jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, supplier_sku)
);

create index if not exists suppliers_status_created_idx
  on suppliers (status, created_at desc);
create index if not exists supplier_invites_supplier_created_idx
  on supplier_invites (supplier_id, created_at desc);
create index if not exists supplier_assignments_supplier_status_idx
  on supplier_order_assignments (supplier_id, status, assigned_at desc);
create index if not exists supplier_updates_order_created_idx
  on supplier_updates (supplier_id, order_id, created_at desc);
create index if not exists supplier_inventory_status_idx
  on supplier_inventory (supplier_id, availability, updated_at desc)
  where archived_at is null;

-- Supplier accounts share the existing polymorphic session table.
alter table sessions drop constraint if exists sessions_principal_type_check;
alter table sessions add constraint sessions_principal_type_check
  check (principal_type in ('customer', 'admin', 'bot_admin', 'supplier'));
