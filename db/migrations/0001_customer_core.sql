create sequence if not exists customer_code_seq start 100001;
create sequence if not exists intake_code_seq start 100001;
create sequence if not exists order_code_seq start 100001;
create sequence if not exists action_code_seq start 100001;
create sequence if not exists artifact_code_seq start 100001;
create sequence if not exists timeline_code_seq start 100001;
create sequence if not exists media_code_seq start 100001;

create table if not exists customers (
  id bigint generated always as identity primary key,
  customer_code text not null unique,
  email text not null unique check (email = lower(email)),
  name text not null,
  phone text,
  locale text not null default 'en' check (locale in ('en', 'ko', 'zh', 'es')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists starter_designs (
  id bigint generated always as identity primary key,
  style_code text not null unique,
  category text not null check (category in ('ring', 'earrings', 'bracelet', 'necklace')),
  name jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  hero_media jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  supported_metals text[] not null default '{}',
  stone_range text,
  lead_time_min_days integer not null default 21,
  lead_time_max_days integer not null default 42,
  published boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_intakes (
  id bigint generated always as identity primary key,
  intake_code text not null unique,
  customer_id bigint references customers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'cancelled')),
  entry_mode text not null default 'help_me_choose' check (entry_mode in ('design', 'references', 'help_me_choose')),
  category text check (category in ('ring', 'earrings', 'bracelet', 'necklace')),
  product_line text check (product_line in ('solitaire', 'multi')),
  style_code text references starter_designs(style_code) on delete set null,
  locale text not null default 'en' check (locale in ('en', 'ko', 'zh', 'es')),
  customer_name text,
  contact_email text check (contact_email is null or contact_email = lower(contact_email)),
  contact_phone text,
  budget_minor_units bigint,
  currency text not null default 'USD' check (char_length(currency) = 3),
  required_date date,
  delivery_country text,
  form_payload jsonb not null default '{}'::jsonb,
  reference_media jsonb not null default '[]'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists customer_orders (
  id bigint generated always as identity primary key,
  order_code text not null unique,
  customer_id bigint not null references customers(id) on delete restrict,
  intake_id bigint not null references customer_intakes(id) on delete restrict,
  stage text not null check (stage in (
    'OPS_REVIEW', 'STONE_SELECTION', 'QUOTE', 'DEPOSIT', 'CAD', 'PRODUCTION',
    'FINAL_QC', 'BALANCE', 'SHIPPING', 'DELIVERED', 'CANCELLED'
  )),
  phase text not null check (phase in ('DEFINE', 'APPROVE_DESIGN', 'MAKING', 'DELIVERY', 'CLOSED')),
  waiting_on text not null default 'BELOVEDIAMOND' check (waiting_on in ('CUSTOMER', 'BELOVEDIAMOND', 'EXTERNAL', 'NONE')),
  expected_completion_at timestamptz,
  next_action_id bigint,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists published_artifacts (
  id bigint generated always as identity primary key,
  artifact_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  type text not null check (type in ('REFERENCE', 'DIAMOND_OPTION', 'QUOTE', 'CAD', 'QC', 'CERTIFICATE', 'SHIPMENT')),
  version_label text not null,
  subject_version_id text not null,
  payload jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists customer_actions (
  id bigint generated always as identity primary key,
  action_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  kind text not null check (kind in (
    'DIAMOND_SELECTION', 'QUOTE_ACCEPTANCE', 'CAD_REVIEW', 'FINAL_WEIGHT_ACCEPTANCE',
    'FINAL_QC_CONFIRMATION', 'DELIVERY_ADDRESS'
  )),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESPONDED', 'EXPIRED', 'CANCELLED', 'STALE')),
  title text not null,
  description text,
  subject_type text not null,
  subject_version_id text not null,
  due_at timestamptz,
  allowed_responses text[] not null default '{}',
  response_payload jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_orders
  drop constraint if exists customer_orders_next_action_fk;
alter table customer_orders
  add constraint customer_orders_next_action_fk
  foreign key (next_action_id) references customer_actions(id) on delete set null;

create table if not exists customer_timeline_events (
  id bigint generated always as identity primary key,
  event_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  title text not null,
  body text,
  visibility text not null default 'customer' check (visibility in ('customer', 'internal')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists media_assets (
  id bigint generated always as identity primary key,
  media_code text not null unique,
  owner_customer_id bigint references customers(id) on delete set null,
  order_id bigint references customer_orders(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'UPLOADED', 'PROCESSING', 'READY', 'REJECTED', 'DELETED')),
  kind text not null check (kind in ('image', 'video', 'document')),
  mime_type text not null,
  byte_size bigint,
  storage_key text not null,
  public_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  route text not null,
  idempotency_key text not null,
  request_hash text not null,
  status_code integer not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (route, idempotency_key)
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_type text not null,
  actor_ref text,
  entity_type text not null,
  entity_ref text not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_intakes_customer_status_updated_idx
  on customer_intakes (customer_id, status, updated_at desc);
create index if not exists customer_intakes_style_code_idx
  on customer_intakes (style_code);
create index if not exists customer_orders_customer_updated_idx
  on customer_orders (customer_id, updated_at desc);
create index if not exists customer_orders_stage_updated_idx
  on customer_orders (stage, updated_at desc);
create index if not exists published_artifacts_order_type_published_idx
  on published_artifacts (order_id, type, published_at desc);
create index if not exists customer_actions_order_status_due_idx
  on customer_actions (order_id, status, due_at);
create index if not exists customer_actions_open_idx
  on customer_actions (order_id, due_at)
  where status = 'OPEN';
create index if not exists customer_timeline_order_created_idx
  on customer_timeline_events (order_id, created_at desc);
create index if not exists media_assets_order_status_idx
  on media_assets (order_id, status, created_at desc);

insert into starter_designs (
  style_code, category, name, summary, hero_media, media, supported_metals,
  stone_range, lead_time_min_days, lead_time_max_days, published, sort_order
) values
  (
    'RING-SOL-001', 'ring',
    '{"en":"Solitaire Ring","ko":"솔리테어 링","zh":"单钻戒","es":"Anillo solitario"}',
    '{"en":"A clean six-prong starter setting for a single center stone.","ko":"센터스톤 하나를 돋보이게 하는 6프롱 기본 세팅.","zh":"以单颗主石为核心的六爪经典起始款。","es":"Montura inicial de seis uñas para una piedra central."}',
    '{"kind":"image","src":"/assets/lineup-ring.png"}',
    '[{"kind":"image","src":"/assets/lineup-ring.png"},{"kind":"image","src":"/assets/lab-diamond-tweezers.webp"}]',
    array['18kw','18ky','pt950'], '0.8ct - 3.0ct', 21, 35, true, 10
  ),
  (
    'EAR-STUD-001', 'earrings',
    '{"en":"Classic Studs","ko":"클래식 스터드","zh":"经典耳钉","es":"Aretes clásicos"}',
    '{"en":"Everyday diamond studs with custom stone matching.","ko":"스톤 매칭까지 맞춤으로 진행하는 데일리 다이아 스터드.","zh":"适合日常佩戴，并支持主石配对的钻石耳钉。","es":"Aretes diarios con emparejamiento de piedras a medida."}',
    '{"kind":"image","src":"/assets/lineup-studs.png"}',
    '[{"kind":"image","src":"/assets/lineup-studs.png"}]',
    array['18kw','18ky','pt950'], '0.5ctw - 3.0ctw', 21, 35, true, 20
  ),
  (
    'BR-TENNIS-001', 'bracelet',
    '{"en":"Tennis Bracelet","ko":"테니스 브레이슬릿","zh":"网球手链","es":"Pulsera tenis"}',
    '{"en":"A refined bracelet calibrated around matched lab diamonds.","ko":"매칭 랩다이아를 균일하게 세팅하는 정제된 브레이슬릿.","zh":"以配对培育钻石校准制作的精致手链。","es":"Pulsera refinada calibrada con diamantes de laboratorio."}',
    '{"kind":"image","src":"/assets/lineup-bracelet.png"}',
    '[{"kind":"image","src":"/assets/lineup-bracelet.png"}]',
    array['18kw','18ky','pt950'], '1.0ctw - 8.0ctw', 28, 49, true, 30
  ),
  (
    'NECK-PEND-001', 'necklace',
    '{"en":"Solitaire Pendant","ko":"솔리테어 펜던트","zh":"单钻吊坠","es":"Colgante solitario"}',
    '{"en":"A minimal pendant designed around a single certified stone.","ko":"인증 스톤 하나를 중심으로 제작하는 미니멀 펜던트.","zh":"围绕单颗认证钻石设计的极简吊坠。","es":"Colgante minimalista alrededor de una piedra certificada."}',
    '{"kind":"image","src":"/assets/lineup-pendant.png"}',
    '[{"kind":"image","src":"/assets/lineup-pendant.png"}]',
    array['18kw','18ky','pt950'], '0.5ct - 3.0ct', 21, 35, true, 40
  )
on conflict (style_code) do update set
  category = excluded.category,
  name = excluded.name,
  summary = excluded.summary,
  hero_media = excluded.hero_media,
  media = excluded.media,
  supported_metals = excluded.supported_metals,
  stone_range = excluded.stone_range,
  lead_time_min_days = excluded.lead_time_min_days,
  lead_time_max_days = excluded.lead_time_max_days,
  published = excluded.published,
  sort_order = excluded.sort_order,
  updated_at = now();
