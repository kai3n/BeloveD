# BeloveDiamond — Customer Web + Admin Backend (MVP) 설계

| 항목 | 값 |
| --- | --- |
| 상태 | Draft v1 (리뷰 대기) |
| 작성일 | 2026-06-24 |
| 부모 문서 | `belovediamond_customer_web_hld_v0_2.md` |
| 범위 | 고객 웹(공개 + 주문 워크스페이스) + 어드민 백오피스 + PostgreSQL 백엔드 |
| 제외 | vendor/dealer/supplier 일체, 실제 결제·실메일·클라우드 미디어(전부 목 시임) |

## 0. 확정 결정 (브레인스토밍)

| 영역 | 결정 |
| --- | --- |
| 프론트 스택 | 기존 **Vite + React 19 SPA 유지**. Next.js 이전 안 함. |
| 백엔드 | **Node(Express) + `pg` + PostgreSQL**, 단일 오리진. |
| 목표 수준 | **동작하는 MVP** — 진짜 DB·진짜 워크플로우, 결제·이메일·미디어는 인터페이스 뒤 목. |
| 인증 | **게스트 주문 + 매직링크(패스워드리스) + 선택 비번 + HttpOnly DB세션**, 어드민 분리. 경쟁사(Brilliant Earth·VRAI·Ada·Frank Darling 류) 표준. |
| 워크플로우 | **전체 라이프사이클** — 인테이크→Ops리뷰→다이아 선택→견적→CAD 루프→생산→최종 QC→잔금/주소→배송→배송완료. 결제는 어드민 "입금확인" 목. |
| 서피스 | 어드민 + 고객(custom)만. vendor/dealer 제거. |
| 코덱스 자산 | 스키마 `0001`은 계승, 앱 레이어·워크플로우·인증·멱등키·마이그레이션 러너는 재작성. `store.js` 목 도메인 로직을 진실의 원천으로 포팅. |

## 1. 코덱스 구현 평가 (재작성 근거)

**살릴 것:** `db/migrations/0001_customer_core.sql` — 시퀀스 기반 공개코드, append-only 아티팩트, 멱등키·감사로그 테이블, 부분 인덱스. HLD 불변식에 충실.

**버릴/고칠 것:**
1. **워크플로우 루프 부재 (최대 결함).** 어드민 API에 고객 액션 생성·아티팩트 발행 경로가 전무 → 고객 워크스페이스가 영원히 빈 상태. 제품 본체가 작동 안 함.
2. **가짜 인증.** `x-customer-email`/`x-admin-key` 헤더를 그대로 신뢰 → 남의 주문 조회 가능. HLD 불변식 #4 위반.
3. **멱등키 버그.** `runIdempotent` 트랜잭션 안에서 `submitIntake`가 별도 커넥션으로 또 트랜잭션 → 원자성 깨짐 + check-then-insert 레이스.
4. **미완성.** `migrate.js`가 `0002` 미실행 · `listOrderActions`는 `[...[]]` 죽은 코드 · 미디어 전량 목.
5. **프론트-백 단절.** 프론트는 `localStorage` 목, 백엔드는 미연결.

## 2. 자산 인벤토리 (재사용 우선)

**프론트 (유지·재배선):** `src/lib/store.js`(1186줄)는 전체 워크플로우를 이미 구현 — `createIntake`, `listQuotes/createQuote/acceptQuote`, `listCadReviews/addCadVersion/decideCad/freeRevisionsLeft`, `listCandidates/publishCandidate/lockCandidate/toggleShortlist`, `submitQcForPr/recordActualWeight/confirmFinal`, `submitShipment/markOrderDelivered`, `listCustomerActions/createCustomerAction/respondCustomerAction`, `portalView`(고객 안전 프로젝션). 페이지(`IntakeForm`·`ClientPortal`·`Account`·`admin/*`)는 이 함수면에 묶여 있음 → **백엔드는 이 함수들의 의미를 그대로 구현**하고 프론트는 store import를 API 백드 모듈로 교체.

**제거 대상:** `src/pages/dealer/*`, `src/pages/supplier/*`, `VendorLogin.jsx`, `DealerApply.jsx`, `Diamonds.jsx`/`DiamondDetail.jsx`(공개 다이아 검색 — HLD 비목표), `dealerStrings.js`, `src/lib/dealer.js`, 관련 store 함수(`pool*`, `wholesale*`, `claim*`, `warranty*`, `dealer*`, `vendor*`)와 그 테스트.

## 3. 아키텍처

### 3.1 토폴로지 — 단일 오리진 (HLD 불변식 #13)

```
운영:  [Browser] → [Node/Express 1프로세스]
                     ├─ 정적 SPA (dist/)
                     └─ /v1/* JSON API → [PostgreSQL]
                                       → [mailer/payment/media 시임(목)]
개발:  [Vite :5173] --proxy /v1--> [Node API :8787] → [PostgreSQL]
```

CORS 없음(동일 오리진). 한 덩어리로 VPS/Railway/Render/Fly 배포.

### 3.2 백엔드 레이어

```
server/
  index.js            Express 앱 부트스트랩, 정적 SPA 서빙, 라우터 마운트
  app.js              미들웨어 체인(json, cookie, session, error, idempotency)
  routes/
    public.js         GET /v1/customer/styles, /styles/:code
    auth.js           매직링크·세션·로그아웃·게스트
    customer.js       intakes, orders, actions, diamond-options, quotes, media
    admin.js          어드민 워크플로우 오퍼레이션
  domain/             (구 repository — 애그리거트별, 순수 SQL + 규칙)
    customers.js  styles.js  intakes.js  orders.js
    workflow.js         ★ 핵심 엔진 (액션/아티팩트/스테이지 원자 전이)
    quotes.js  diamonds.js  cad.js  qc.js  shipments.js
    projection.js       고객 안전 뷰 직렬화(allowlist)
  lib/
    db.js               Pool, withTransaction, query
    session.js          세션 발급/검증/폐기
    mailer.js           시임: dev=콘솔/응답, prod=SMTP
    payments.js         시임: dev=수동확인, prod=Stripe
    media.js            시임: dev=로컬디스크, prod=S3 서명URL
    errors.js           ApiError + 안정 에러코드
    codes.js            시퀀스 기반 공개코드
  migrate.js            db/migrations/*.sql 자동발견·정렬·적용
```

**표준 선택:** Express, `cookie`/세션은 DB 백드(폐기 가능, HLD 로그아웃 요구), 비번 해시 `argon2`(또는 `bcrypt`), 토큰은 `crypto.randomBytes`, 모든 SQL 파라미터 바인딩, 설정은 `.env`.

### 3.3 프론트 레이어

```
src/lib/
  api/
    client.js     fetch 래퍼(credentials:'include', Idempotency-Key, 에러코드→도메인에러)
    customer.js   고객 엔드포인트 바인딩
    admin.js      어드민 엔드포인트 바인딩
  data/           React 훅(useOrder, useStyles, useAccount…) — TanStack 불필요, 경량 자체 훅 + refetch-on-focus
  auth.jsx        세션 쿠키 + 매직링크 + 게스트 (재작성)
```

`store.js`는 단계적으로 비우고, 페이지는 `data/` 훅으로 전환.

## 4. 데이터 모델

### 4.1 계승 (코덱스 `0001`, 소폭 수정)
`customers`, `starter_designs`, `customer_intakes`, `customer_orders`, `customer_actions`, `customer_timeline_events`, `media_assets`, `idempotency_keys`, `audit_log`.
- **`published_artifacts` 폐기** — 1급 도메인 테이블로 대체.
- `customers`에 `password_hash text null` 추가.
- `customer_orders.selected_candidate_id`, `free_revisions_used int default 0` 추가.

### 4.2 신규 마이그레이션

`0003_auth.sql`
```sql
create table sessions (
  id text primary key,                       -- 쿠키에 담기는 opaque id (랜덤)
  principal_type text not null check (principal_type in ('customer','admin')),
  principal_id bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index sessions_principal_idx on sessions (principal_type, principal_id);

create table magic_link_tokens (
  token_hash text primary key,               -- sha256(raw token)
  email text not null,
  intent text not null default 'login',      -- login | claim_order
  order_code text,                           -- claim_order 시 대상
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index magic_link_email_idx on magic_link_tokens (email, created_at desc);

create table admin_users (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email)),
  name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table customers add column if not exists password_hash text;
```

`0004_workflow.sql`
```sql
drop table if exists published_artifacts;
alter table customer_orders add column if not exists selected_candidate_id bigint;
alter table customer_orders add column if not exists free_revisions_used integer not null default 0;
create sequence if not exists quote_code_seq start 100001;
create sequence if not exists cad_code_seq start 100001;
create sequence if not exists qc_code_seq start 100001;
create sequence if not exists shipment_code_seq start 100001;

create table quotes (
  id bigint generated always as identity primary key,
  quote_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  version integer not null,
  est_weight_g numeric(8,2),
  metal_amount_minor bigint not null default 0,
  non_metal_amount_minor bigint not null default 0,
  diamond_amount_minor bigint not null default 0,
  total_minor bigint not null default 0,
  deposit_minor bigint not null default 0,
  balance_minor bigint not null default 0,
  currency text not null default 'USD',
  valid_until date,
  lead_days int,
  status text not null default 'sent' check (status in ('draft','sent','accepted','superseded','cancelled')),
  internal_json jsonb not null default '{}'::jsonb,   -- 원가·멀티플라이어. 고객 DTO에서 절대 제외
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create table diamond_candidates (
  id bigint generated always as identity primary key,
  candidate_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  shape text, carat numeric(5,2), color text, clarity text,
  cut text, growth_method text, lab text, cert_no text,
  measurements jsonb not null default '{}'::jsonb,
  customer_price_minor bigint,
  procurement_cost_minor bigint,                       -- 어드민 전용
  availability text not null default 'available' check (availability in ('available','reserved','sold','expired')),
  published boolean not null default false,
  internal_review text,
  recommendation text,
  batch_valid_until timestamptz,
  shortlisted boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index diamond_candidates_order_pub_idx on diamond_candidates (order_id, published, availability);

create table cad_reviews (
  id bigint generated always as identity primary key,
  cad_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  version integer not null,
  media jsonb not null default '[]'::jsonb,
  confirmed_metal text,
  confirmed_stone jsonb not null default '{}'::jsonb,
  confirmed_measurements jsonb not null default '{}'::jsonb,
  status text not null default 'published' check (status in ('published','approved','revision_requested','superseded')),
  decision text,
  annotations jsonb not null default '[]'::jsonb,      -- 정규화 % 좌표 핀
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create table qc_records (
  id bigint generated always as identity primary key,
  qc_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  media jsonb not null default '[]'::jsonb,
  actual_weight_g numeric(8,2),
  cert_confirmed boolean not null default false,
  cert_no text,
  status text not null default 'published' check (status in ('published','approved','issue_reported')),
  created_at timestamptz not null default now()
);

create table shipments (
  id bigint generated always as identity primary key,
  shipment_code text not null unique,
  order_id bigint not null references customer_orders(id) on delete cascade,
  carrier text, tracking_no text,
  ship_to jsonb not null default '{}'::jsonb,
  shipped_at timestamptz, delivered_at timestamptz,
  created_at timestamptz not null default now()
);
```

### 4.3 마이그레이션 러너 수정
`migrate.js`는 하드코딩 배열 대신 `db/migrations/`를 읽어 파일명 정렬 후 미적용분만 트랜잭션 적용. `0002`도 자동 포함.

## 5. 워크플로우 엔진 (`domain/workflow.js`)

규칙: **모든 어드민 오퍼레이션 = 단일 트랜잭션** = [도메인 행 쓰기] + [관련 열린 액션을 `STALE` 처리] + [새 `customer_action`을 정확한 `subject_version_id`에 바인딩] + [`customer_timeline_events`] + [`customer_orders.stage/phase/waiting_on/next_action_id/expected_completion_at`] + [`audit_log`].

| # | 행위자 | 오퍼레이션 | 결과 (stage / waiting_on / 액션) |
| --- | --- | --- | --- |
| 1 | 고객 | `submitIntake` | OPS_REVIEW / BD / — (주문·타임라인 생성) |
| 2 | 어드민 | `publishDiamondCandidates(order, stones[])` | STONE_SELECTION / CUSTOMER / `DIAMOND_SELECTION` |
| 3 | 고객 | `shortlist` · `requestStockConfirm` · `selectCandidate` | (선택) 응답 → BD |
| 4 | 어드민 | `publishQuote(order, {...})` | QUOTE / CUSTOMER / `QUOTE_ACCEPTANCE` (이전 견적 superseded·액션 STALE) |
| 5 | 고객 | `acceptQuote` | 응답 → DEPOSIT / BD |
| 6 | 어드민 | `confirmDeposit(order)` *(목 결제)* | CAD / BD |
| 7 | 어드민 | `publishCadVersion(order, {media,confirmed…})` | CAD / CUSTOMER / `CAD_REVIEW` (이전 CAD superseded) |
| 8 | 고객 | `approveCad` \| `requestRevision(annotations)` | 승인→PRODUCTION/BD · 수정→BD(어드민 다음 버전 발행, `free_revisions_used++`) |
| 9 | 어드민 | `publishQc(order, {media,actualWeight,cert})` | FINAL_QC / CUSTOMER / `FINAL_QC_CONFIRMATION`+`FINAL_WEIGHT_ACCEPTANCE`(+`DELIVERY_ADDRESS`) |
| 10 | 고객 | `approveQc` · `acceptWeight` · `confirmAddress` | 전부 응답 시 → BALANCE / BD |
| 11 | 어드민 | `confirmBalance(order)` *(목 결제)* | SHIPPING / BD |
| 12 | 어드민 | `addShipment(tracking)` → `markDelivered` | SHIPPING→DELIVERED / NONE |

**불변식 강제 (HLD §4):**
- 고객 응답: 소유권 + `status='OPEN'` + `expectedSubjectVersionId == subject_version_id`. 불일치 시 `ACTION_STALE`(409).
- 새 버전 발행 시 동일 종류의 열린 액션 자동 `STALE`, 새 액션 신규 발행.
- 단계 전이 화이트리스트 검증(역행/건너뜀 차단). 고객은 stage/price/payment 직접 설정 불가.
- 판매완료/만료 후보 `selectCandidate` 시 `DIAMOND_SOLD`/`DIAMOND_BATCH_EXPIRED` 반환.

## 6. 고객 안전 프로젝션 (`domain/projection.js`)

`GET /v1/customer/orders/:code` → `CustomerOrderView`(HLD §10). **allowlist 직렬화** — 다음은 절대 미포함: vendor 식별자, `procurement_cost_minor`, `internal_json`, 마진/내부 금속가, 내부 노트, 원시 DB id(공개코드 대체), 미발행 버전, 타 고객 식별자. 기존 `portalView`의 마스킹 규칙을 그대로 이식. 직렬화기 화이트리스트는 단위 테스트로 강제.

## 7. API 표면

**공개/고객** (HLD §11 준수)
```
GET  /v1/customer/styles                         GET  /v1/customer/styles/:code
POST /v1/auth/magic-link        {email}          GET  /v1/auth/callback?token=
POST /v1/auth/password          {email,password} POST /v1/auth/logout
POST /v1/auth/set-password      {password}        (세션 필요)
POST /v1/customer/intakes        (게스트 허용)    PATCH /v1/customer/intakes/:id
POST /v1/customer/intakes/:id/submit             GET  /v1/customer/orders          (세션)
GET  /v1/customer/orders/:code                   GET  /v1/customer/orders/:code/actions
POST /v1/customer/actions/:id/responses          GET  /v1/customer/orders/:code/diamond-options
POST /v1/customer/orders/:code/diamond-options/:id/shortlist
POST /v1/customer/orders/:code/diamond-options/stock-checks
POST /v1/customer/media/upload-sessions          GET  /v1/customer/media/:id/delivery-url
```
**어드민** (`requireAdmin` 세션)
```
GET/POST/PATCH/DELETE /v1/admin/styles[/:code]
GET /v1/admin/orders            GET /v1/admin/orders/:code
POST /v1/admin/orders/:code/diamond-candidates       (publishDiamondCandidates)
POST /v1/admin/orders/:code/quotes                   (publishQuote)
POST /v1/admin/orders/:code/deposit-confirm          (목 결제)
POST /v1/admin/orders/:code/cad-versions             (publishCadVersion)
POST /v1/admin/orders/:code/qc                        (publishQc)
POST /v1/admin/orders/:code/balance-confirm          (목 결제)
POST /v1/admin/orders/:code/shipments                (addShipment)
POST /v1/admin/orders/:code/deliver                  (markDelivered)
POST /v1/admin/media/upload-sessions
```
**쓰기 요구:** 재시도형 쓰기에 `Idempotency-Key`, subjectVersion·소유권 검증, 안정 에러코드(`ACTION_STALE`·`ACTION_EXPIRED`·`ARTIFACT_SUPERSEDED`·`DIAMOND_SOLD`·`DIAMOND_BATCH_EXPIRED`·`PAYMENT_PENDING`·`ORDER_ACCESS_DENIED`·`UPLOAD_SESSION_EXPIRED`·`RATE_LIMITED`).

## 8. 인증 상세

- **게스트 인테이크:** 세션 없이 `POST /intakes`+`/submit` 허용. 주문이 이메일에 묶임. 제출 응답에 주문코드 + 단기 게스트 열람을 위한 매직링크(dev 노출) 동봉.
- **매직링크:** `POST /auth/magic-link {email}` → 토큰 생성, `magic_link_tokens`에 sha256 해시 저장(만료 15분, 1회용). dev `mailer`는 링크를 응답/콘솔에 반환. `GET /auth/callback?token` → 검증·used 마킹 → `sessions` 행 생성 → `Set-Cookie: bd_sid` (HttpOnly, SameSite=Lax, prod Secure) → 안전 리다이렉트(allowlist).
- **선택 비번:** 세션 보유 시 `set-password`, 이후 `POST /auth/password`로 즉시 로그인.
- **어드민:** 시드된 `admin_users` 계정, `POST /auth/password`(어드민 판별) → `principal_type='admin'` 세션, 쿠키 `bd_admin`. `requireAdmin`/`requireCustomer`가 principal_type로 오디언스 분리(HLD §15).
- **세션:** DB 백드라 로그아웃=`revoked_at` 세팅. 결제·주소 변경 전 recent-auth 체크는 MVP에서 선택.

## 9. 시임 (목, 실물 형태)

| 시임 | dev (MVP) | prod 교체 |
| --- | --- | --- |
| `mailer` | 링크/알림을 응답·콘솔로 반환 | SMTP/Resend |
| `payments` | 어드민 `deposit-confirm`/`balance-confirm`가 결제확정 대역 | Stripe Checkout + 웹훅(서버 확정, URL 추론 금지) |
| `media` | `POST upload-sessions`→로컬 `media/` 경로 PUT, 서버 MIME/바이트 검증·EXIF GPS 제거·포스터 생성 | S3 서명 업로드/딜리버리 URL |

## 10. 롤아웃 (구현 순서)

- **P0 — 기반:** `0003`/`0004` 마이그레이션 + 러너 수정 · Express 앱 + 미들웨어 · 세션/매직링크/게스트/어드민 인증 · `lib/api` 클라이언트 · vendor/dealer/supplier 제거.
- **P1 — 발견·인테이크:** 공개 styles(목록/상세) · 게스트 인테이크 저장/제출 · `/account` 대시보드 · 주문 워크스페이스 읽기(프로젝션). 종료: 모바일 Playwright 통과, 제출이 API로 주문 1건 생성.
- **P2 — 워크플로우 엔진:** 다이아 선택 · 견적 수락 · CAD 발행/수정 루프. 종료: 인테이크→Ops→CAD V1→수정→CAD V2→승인 전 과정이 버전·액션·감사 보존.
- **P3 — 상거래 완결:** QC · 실중량 수락 · 주소 · 잔금(목) · 배송 · 배송완료 · 완료주문 보관.
- **P4 — 하드닝/테스트:** 교차고객 격리(릴리스 차단), STALE CAD, 판매완료 다이아, 업로드 재시도, 금지필드 누출, 모바일 계층.

## 11. 테스트 전략

- **Vitest(도메인):** 워크플로우 전이, STALE 처리, subjectVersion 검증, 멱등키, 프로젝션 allowlist(금지필드 0건). 기존 `store.js` 테스트 자산 일부 이식.
- **Playwright(e2e):** 골든패스(게스트 인테이크→매직링크→워크스페이스→각 액션 승인→배송완료) + **교차고객 격리(릴리스 차단)** + 게스트 주문.
- **DB:** 테스트 DB에 마이그레이션 적용 후 결정적 픽스처.

## 12. 비목표 (MVP 제외)
공개 다이아 검색·장바구니·위시리스트·실시간 3D·고객 CAD 편집·소셜로그인(후순위 쉬운 추가)·ERP/딜러/벤더 일체·실시간 이벤트(포커스 리페치로 충분).

## 13. 미해결/확인 필요
1. **소셜 로그인(Google/Apple)** MVP 포함 여부 — 현재 후순위로 가정.
2. **배포 타깃** 단일 VPS vs Railway/Render/Fly — 코드 영향 없음, 운영 결정.
3. **공개 가격 표기** — HLD 미결정. 현재 "가격 미표기(견적은 확정 사양 후)"로 가정.
4. **CAD 무료 수정 횟수/디자인변경 수수료** 수치 — `settings`에서 구성, 기본값 필요.
