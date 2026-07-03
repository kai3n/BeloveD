# Admin Activity Dashboard (회원 활동 대시보드) — Design Spec

날짜: 2026-07-02 · 승인: A안(자체 이벤트 로그, Postgres + 비콘 API) 사용자 확정

## 1. 배경 / 목표

어드민에서 회원 목록, 누적 주문현황, 그리고 "어떤 제품을 클릭했는지" 같은 행동 흔적을
한 화면에서 보고 싶다는 요청. 결정 사항:

1. **추적 범위**: 모든 방문자를 익명 세션으로 추적하고, 로그인하면 그 세션을 회원과 연결.
   로그인 전 카탈로그 탐색 기록도 회원 여정에 포함된다.
2. **이벤트 종류**: 페이지 뷰 + 상품 인터랙션 + 전환 이벤트 (스크롤 깊이 등 미세행동 제외).
3. **주문현황**: 실제 주문/인테이크는 아직 localStorage 데모 스토어에만 있으므로,
   대시보드의 주문 섹션은 Postgres `customer_orders`를 바라보게만 만들어 둔다.
   인테이크→Postgres 마이그레이션(별도 프로젝트)이 끝나면 자동으로 채워진다.
4. **보관 정책**: 원본 이벤트 90일 + 일별 집계 영구.

서드파티 분석 도구(B안)는 회원별 여정 연결·어드민 통합 제약으로, `audit_log` 재활용(C안)은
어드민 감사 추적 오염 문제로 제외.

## 2. 데이터 모델 — `db/migrations/0005_activity.sql`

```sql
activity_sessions (
  session_id   uuid primary key,          -- 클라이언트 쿠키의 익명 UUID
  customer_id  bigint null references customers(id),
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  user_agent   text
)

activity_events (
  id          bigserial primary key,
  session_id  uuid not null,              -- FK 없이 느슨하게 (세션 행 삭제와 독립)
  event_type  text not null,              -- §3 화이트리스트
  path        text,
  entity_type text,                       -- 'style' 등
  entity_id   text,                       -- 스타일 ID 등
  meta        jsonb,
  created_at  timestamptz not null default now()
)
-- 인덱스: (session_id, created_at), (event_type, created_at), (entity_id) where entity_id is not null

activity_daily (
  day         date not null,
  event_type  text not null,
  entity_id   text not null default '',   -- 엔티티 무관 집계는 ''
  count       integer not null,
  primary key (day, event_type, entity_id)
)
```

- **로그인 연결**: 로그인/가입 성공 시 서버가 해당 `session_id` 행에 `customer_id`를 채운다.
  과거 이벤트는 UPDATE하지 않고 조인으로 연결 — 로그인 전 흔적이 자동 포함된다.
- **집계·정리**: Vercel Cron(일 1회)이 ① 전날 원본을 `activity_daily`로 upsert 집계,
  ② 90일 초과 `activity_events` 삭제, ③ 90일 이상 미활동·미연결 `activity_sessions` 삭제.

## 3. 이벤트 화이트리스트 (10개)

| event_type | 발생 지점 | entity/meta |
|---|---|---|
| `page_view` | 라우트 이동마다 (클라이언트) | path |
| `style_click` | 카탈로그/홈에서 스타일 카드 클릭 | entity=styleId |
| `style_view` | StyleDetail 마운트 | entity=styleId |
| `option_select` | 상세에서 메탈/캐럿 선택 | entity=styleId, meta={metal|carat} |
| `media_zoom` | MediaZoomModal 열림 | entity=styleId |
| `intake_start` | 인테이크 폼 진입 | meta={styleId?} |
| `intake_submit` | 인테이크 제출 성공 | meta={intakeId} |
| `review_submit` | 리뷰 제출 성공 | — |
| `login` | 서버 auth 라우트에서 직접 기록 | customer 연결 시점 |
| `signup` | 서버 auth 라우트에서 직접 기록 | customer 연결 시점 |

서버는 화이트리스트 밖 event_type을 400으로 거부한다.

## 4. 클라이언트 추적기 — `src/lib/track.js`

- 익명 세션 UUID를 쿠키(`bd_aid`, SameSite=Lax, 1년)로 유지.
  (`bd_sid`는 고객 세션 httpOnly 쿠키로 이미 사용 중 — 충돌 금지.)
- `track(eventType, fields)` — 큐에 쌓고 **5초 간격 또는 페이지 이탈**(visibilitychange→hidden)에
  `navigator.sendBeacon('/v1/activity', batch)` 전송. fetch keepalive 폴백.
- fire-and-forget: 실패해도 재시도·사용자 노출 없음.
- **추적 제외**: 어드민 라우트(`/gate-7f3k9x`, `/admin/*`) 및 스태프 세션.
- **데모 빌드 제외**: GitHub Pages 데모(백오피스 제외 플래그와 동일한 `src/lib/flags.js` 패턴)에서는
  모듈 전체 no-op.

## 5. 서버 API

| 라우트 | 설명 |
|---|---|
| `POST /v1/activity` | 배치 수집(최대 25건). 화이트리스트 검증, 기존 `rateLimit.js` 재사용, 세션 upsert + last_seen 갱신 |
| `GET /v1/admin/activity/overview` | KPI(오늘/7일 세션·페이지뷰·활성회원), 인기 스타일 Top 10, 전환 퍼널, 일별 트렌드 (원본+`activity_daily` 합산) |
| `GET /v1/admin/members` | 회원 목록 + 최근 활동시각·이벤트 수·주문 수(`customer_orders` count — 당분간 0) |
| `GET /v1/admin/members/:id/timeline` | 해당 회원의 세션들 + 시간순 이벤트 (페이지네이션) |

admin 라우트는 기존 어드민 인증 미들웨어(`middleware.js`의 principal 검사) 필수.
`login`/`signup` 이벤트와 세션→customer 연결은 `authRoutes.js` 성공 핸들러에서 수행
(클라이언트가 보낸 `bd_aid` 쿠키 사용).

## 6. 어드민 UI — 새 페이지 "회원" (`src/pages/admin/AdminMembers.jsx`)

기존 어드민 내비게이션에 메뉴 추가. 라벨은 `opsStrings.js` 다국어 패턴 준수.

- **개요 탭**: KPI 타일(오늘/7일 세션, 페이지뷰, 활성 회원), 인기 스타일 Top 10(클릭·조회수),
  전환 퍼널(style_view → intake_start → intake_submit), 일별 트렌드 차트.
- **회원 목록 탭**: 이름·이메일·가입일·최근 활동·이벤트 수·주문 수 테이블. 검색·정렬.
- **회원 상세**: 프로필 + 활동 타임라인("6/30 21:04 Oval Solitaire 상세 조회" 식,
  스타일 ID는 이름으로 해석) + 주문현황 섹션(마이그레이션 전까지는 빈 상태 안내 문구).

## 7. 테스트

- `server/__tests__` 패턴: 수집 API(화이트리스트 검증·배치 상한·rate limit·세션 upsert),
  로그인 시 세션 연결, admin 집계 쿼리(시드 이벤트 → 기대 KPI), 90일 정리 쿼리.
- 클라이언트: 추적기 배치/플러시 로직, 어드민 라우트·데모 플래그 제외 단위 테스트.

## 8. 범위 밖 (다음 프로젝트)

- 인테이크/주문 → Postgres 마이그레이션 (주문현황 실데이터의 전제)
- 미세행동(스크롤 깊이·체류시간), 이메일 리포트, 실시간 대시보드
