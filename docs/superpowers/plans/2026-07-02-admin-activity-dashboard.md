# Admin Activity Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 방문자를 익명 세션으로 추적해 Postgres에 남기고, 로그인 시 회원과 연결하며, 어드민 "회원" 페이지에서 KPI·인기 스타일·회원 목록·개인 타임라인을 보여준다.

**Architecture:** 클라이언트 `track.js`가 `bd_aid` 쿠키(익명 UUID)로 이벤트를 배치 수집해 `POST /v1/activity`로 전송. 서버는 `activity_sessions`/`activity_events`에 기록하고, 로그인 성공 시 세션 행에 `customer_id`를 채운다(조인 연결). 어드민 조회 3개 API + 유지보수(일별 집계·90일 정리) 엔드포인트를 Vercel Cron이 호출.

**Tech Stack:** Express(server/), pg(Neon), vitest+supertest(server/__tests__), React+react-router(src/), Vercel Cron.

## Global Constraints

- 익명 쿠키 이름은 **`bd_aid`** (`bd_sid`=고객 세션, `bd_admin`=어드민 세션과 충돌 금지)
- 이벤트 타입 화이트리스트(10종): `page_view`, `style_click`, `style_view`, `option_select`, `media_zoom`, `intake_start`, `intake_submit`, `review_submit`, `login`, `signup`
- 배치 최대 25건, 초과·미등록 타입은 `VALIDATION_ERROR` 400
- 원본 이벤트 보관 90일, `activity_daily` 집계는 영구
- 어드민 라우트(`/admin`, `/gate-`)와 데모 빌드(`WITH_BACKOFFICE === false`)에서는 추적 no-op
- 서버 에러는 기존 `ApiError` 계약(`{ error: { code } }`), JS 파일은 ESM(.js import 확장자 필수)
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

- `db/migrations/0005_activity.sql` — 신규 3테이블
- `server/activityRepository.js` — 이벤트 기록·세션 연결·조회 SQL (신규)
- `server/activityRoutes.js` — `POST /v1/activity` 수집 라우터 (신규)
- `server/adminActivityRoutes.js` — 어드민 조회 3 API (신규)
- `server/activityMaintenance.js` — 일별 집계 + 90일 정리 (신규)
- `server/app.js` — 라우터 마운트 (수정)
- `server/authRoutes.js` — 로그인 성공 시 세션 연결 + login 이벤트 (수정)
- `server/__tests__/activity.test.js`, `server/__tests__/helpers.js` — 테스트 (신규/수정)
- `src/lib/track.js` — 클라이언트 추적기 (신규), `src/lib/__tests__/track.test.js`
- `src/App.jsx` — page_view 훅 + `/admin/members` 라우트 (수정)
- 이벤트 호출부: `src/pages/Home.jsx`, `src/pages/StyleCatalog.jsx`, `src/pages/StyleDetail.jsx`, `src/components/ui.jsx`(MediaZoomModal), `src/pages/IntakeForm.jsx`, `src/pages/ReviewNew.jsx`, `src/lib/auth.jsx`(login track은 서버가 기록하므로 클라이언트 생략)
- `src/pages/admin/AdminMembers.jsx` — 개요/회원/타임라인 UI (신규)
- `src/pages/admin/Admin.jsx`, `src/opsStrings.js` — 메뉴 (수정)
- `vercel.json` — crons (수정)

---

### Task 1: Activity 스키마 마이그레이션

**Files:**
- Create: `db/migrations/0005_activity.sql`
- Test: `server/__tests__/activity-schema.test.js`

**Interfaces:**
- Produces: 테이블 `activity_sessions(session_id uuid pk, customer_id bigint null, first_seen, last_seen, user_agent)`, `activity_events(id bigserial pk, session_id uuid, event_type text, path text, entity_type text, entity_id text, meta jsonb, created_at)`, `activity_daily(day date, event_type text, entity_id text default '', count int, pk(day,event_type,entity_id))`

- [ ] **Step 1: 실패하는 스키마 테스트 작성**

```js
// server/__tests__/activity-schema.test.js
import { describe, it, expect } from "vitest";
import { query } from "../db.js";

// 0005_activity.sql이 적용됐는지 — 테이블·핵심 컬럼 존재 확인
describe("activity schema", () => {
  it.each([
    ["activity_sessions", ["session_id", "customer_id", "first_seen", "last_seen", "user_agent"]],
    ["activity_events", ["id", "session_id", "event_type", "path", "entity_type", "entity_id", "meta", "created_at"]],
    ["activity_daily", ["day", "event_type", "entity_id", "count"]],
  ])("%s has expected columns", async (table, cols) => {
    const { rows } = await query(
      "select column_name from information_schema.columns where table_name = $1", [table]);
    const names = rows.map((r) => r.column_name);
    for (const c of cols) expect(names).toContain(c);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- activity-schema` → Expected: FAIL (테이블 없음)

- [ ] **Step 3: 마이그레이션 작성**

```sql
-- db/migrations/0005_activity.sql
-- 방문자 행동 로그 (스펙: docs/superpowers/specs/2026-07-02-admin-activity-dashboard-design.md)
create table if not exists activity_sessions (
  session_id  uuid primary key,
  customer_id bigint references customers(id),
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  user_agent  text
);
create index if not exists activity_sessions_customer_idx on activity_sessions (customer_id) where customer_id is not null;

create table if not exists activity_events (
  id          bigserial primary key,
  session_id  uuid not null,
  event_type  text not null,
  path        text,
  entity_type text,
  entity_id   text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_events_session_idx on activity_events (session_id, created_at);
create index if not exists activity_events_type_idx on activity_events (event_type, created_at);
create index if not exists activity_events_entity_idx on activity_events (entity_id) where entity_id is not null;

create table if not exists activity_daily (
  day         date not null,
  event_type  text not null,
  entity_id   text not null default '',
  count       integer not null,
  primary key (day, event_type, entity_id)
);
```

- [ ] **Step 4: 마이그레이션 적용 후 테스트 통과 확인**

Run: `npm run db:migrate && npm run test:server -- activity-schema` → Expected: PASS

- [ ] **Step 5: Commit** — `git add db/migrations/0005_activity.sql server/__tests__/activity-schema.test.js && git commit -m "feat: activity log schema (sessions/events/daily)"`

---

### Task 2: activityRepository — 기록·연결

**Files:**
- Create: `server/activityRepository.js`
- Modify: `server/__tests__/helpers.js` (truncate에 activity 테이블 추가)
- Test: `server/__tests__/activity.test.js`

**Interfaces:**
- Produces:
  - `EVENT_TYPES: Set<string>` (Global Constraints의 10종)
  - `async recordEvents({ sessionId, userAgent, events }) -> { inserted: number }` — 세션 upsert(last_seen 갱신) + 이벤트 일괄 insert. `events[i] = { type, path?, entityType?, entityId?, meta? }`
  - `async linkSessionToCustomer(sessionId, customerId) -> void`
  - `async recordAuthEvent(sessionId, type /* 'login'|'signup' */) -> void`

- [ ] **Step 1: helpers.js의 truncate 목록에 activity 테이블 추가** (기존 `truncateAuth` 옆에 별도 함수)

```js
// server/__tests__/helpers.js 에 추가
export async function truncateActivity() {
  await query("truncate activity_events, activity_daily restart identity");
  await query("delete from activity_sessions");
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```js
// server/__tests__/activity.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { truncateAuth, truncateActivity } from "./helpers.js";
import { recordEvents, linkSessionToCustomer, EVENT_TYPES } from "../activityRepository.js";

beforeEach(async () => { await truncateAuth(); await truncateActivity(); });

describe("activityRepository", () => {
  it("recordEvents upserts session and inserts whitelisted events", async () => {
    const sid = randomUUID();
    const { inserted } = await recordEvents({
      sessionId: sid, userAgent: "vitest",
      events: [
        { type: "page_view", path: "/" },
        { type: "style_view", path: "/designs/x", entityType: "style", entityId: "ST-1" },
      ],
    });
    expect(inserted).toBe(2);
    const s = await query("select * from activity_sessions where session_id = $1", [sid]);
    expect(s.rows).toHaveLength(1);
    const e = await query("select event_type, entity_id from activity_events where session_id = $1 order by id", [sid]);
    expect(e.rows[1]).toMatchObject({ event_type: "style_view", entity_id: "ST-1" });
  });

  it("rejects non-whitelisted event types", async () => {
    const sid = randomUUID();
    await expect(recordEvents({ sessionId: sid, events: [{ type: "evil" }] }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(EVENT_TYPES.has("evil")).toBe(false);
  });

  it("linkSessionToCustomer fills customer_id", async () => {
    const sid = randomUUID();
    await recordEvents({ sessionId: sid, events: [{ type: "page_view", path: "/" }] });
    const { rows: [cust] } = await query(
      "insert into customers (customer_code, email, name) values ('C-1','a@b.com','A') returning id");
    await linkSessionToCustomer(sid, cust.id);
    const { rows } = await query("select customer_id from activity_sessions where session_id = $1", [sid]);
    expect(Number(rows[0].customer_id)).toBe(Number(cust.id));
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `npm run test:server -- __tests__/activity.test` → FAIL (module not found)

- [ ] **Step 4: 구현**

```js
// server/activityRepository.js
import { query, withTransaction } from "./db.js";
import { ApiError } from "./errors.js";

export const EVENT_TYPES = new Set([
  "page_view", "style_click", "style_view", "option_select", "media_zoom",
  "intake_start", "intake_submit", "review_submit", "login", "signup",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertSessionId(sessionId) {
  if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
    throw new ApiError("VALIDATION_ERROR", 400, "invalid session id");
  }
}

export async function recordEvents({ sessionId, userAgent = null, events }) {
  assertSessionId(sessionId);
  if (!Array.isArray(events) || events.length === 0) return { inserted: 0 };
  for (const ev of events) {
    if (!ev || !EVENT_TYPES.has(ev.type)) throw new ApiError("VALIDATION_ERROR", 400, "unknown event type");
  }
  return withTransaction(async (client) => {
    await client.query(
      `insert into activity_sessions (session_id, user_agent) values ($1, $2)
       on conflict (session_id) do update set last_seen = now()`,
      [sessionId, userAgent]);
    let inserted = 0;
    for (const ev of events) {
      await client.query(
        `insert into activity_events (session_id, event_type, path, entity_type, entity_id, meta)
         values ($1, $2, $3, $4, $5, $6)`,
        [sessionId, ev.type, ev.path ?? null, ev.entityType ?? null, ev.entityId ?? null,
         ev.meta ? JSON.stringify(ev.meta) : null]);
      inserted += 1;
    }
    return { inserted };
  });
}

export async function linkSessionToCustomer(sessionId, customerId) {
  assertSessionId(sessionId);
  await query(
    `insert into activity_sessions (session_id, customer_id) values ($1, $2)
     on conflict (session_id) do update set customer_id = excluded.customer_id, last_seen = now()`,
    [sessionId, customerId]);
}

export async function recordAuthEvent(sessionId, type) {
  if (type !== "login" && type !== "signup") throw new ApiError("VALIDATION_ERROR", 400);
  await recordEvents({ sessionId, events: [{ type }] });
}
```

- [ ] **Step 5: 통과 확인** — Run: `npm run test:server -- __tests__/activity.test` → PASS
- [ ] **Step 6: Commit** — `git add server/activityRepository.js server/__tests__/activity.test.js server/__tests__/helpers.js && git commit -m "feat: activity repository — record/link/auth events"`

---

### Task 3: POST /v1/activity 수집 라우트

**Files:**
- Create: `server/activityRoutes.js`
- Modify: `server/app.js` (마운트)
- Test: `server/__tests__/activityRoutes.test.js`

**Interfaces:**
- Consumes: Task 2의 `recordEvents`
- Produces: `POST /v1/activity` — body `{ events: [{ type, path?, entityType?, entityId?, meta? }] }`, 쿠키 `bd_aid` 필수. 204 No Content. 배치 >25 → 400. rate limit: IP당 분당 60.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// server/__tests__/activityRoutes.test.js
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { truncateAuth, truncateActivity } from "./helpers.js";
import { __resetRateLimit } from "../rateLimit.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); await truncateActivity(); __resetRateLimit(); });

describe("POST /v1/activity", () => {
  it("records a batch and returns 204", async () => {
    const sid = randomUUID();
    const res = await request(app).post("/v1/activity")
      .set("Cookie", [`bd_aid=${sid}`])
      .send({ events: [{ type: "page_view", path: "/" }, { type: "style_click", entityType: "style", entityId: "ST-9" }] });
    expect(res.status).toBe(204);
    const { rows } = await query("select count(*)::int as n from activity_events where session_id = $1", [sid]);
    expect(rows[0].n).toBe(2);
  });

  it("400 on unknown type / oversized batch / missing cookie", async () => {
    const sid = randomUUID();
    const bad = await request(app).post("/v1/activity").set("Cookie", [`bd_aid=${sid}`])
      .send({ events: [{ type: "nope" }] });
    expect(bad.status).toBe(400);
    const big = await request(app).post("/v1/activity").set("Cookie", [`bd_aid=${sid}`])
      .send({ events: Array.from({ length: 26 }, () => ({ type: "page_view" })) });
    expect(big.status).toBe(400);
    const noCookie = await request(app).post("/v1/activity").send({ events: [{ type: "page_view" }] });
    expect(noCookie.status).toBe(400);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- activityRoutes` → FAIL (404)

- [ ] **Step 3: 구현 + 마운트**

```js
// server/activityRoutes.js
import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { recordEvents } from "./activityRepository.js";

const MINUTE = 60_000;
const MAX_BATCH = 25;

export function activityRouter() {
  const r = Router();
  // sendBeacon은 Content-Type을 못 정할 수 있어 text/plain body도 허용해야 한다 —
  // app.js에서 express.text 파싱 후 JSON.parse 폴백 (Step 3b 참조)
  r.post("/", rateLimit({ limit: 60, windowMs: MINUTE }), async (req, res, next) => {
    try {
      const sessionId = req.cookies?.bd_aid;
      if (!sessionId) throw new ApiError("VALIDATION_ERROR", 400, "bd_aid required");
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const events = body.events;
      if (!Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH) {
        throw new ApiError("VALIDATION_ERROR", 400, "events must be 1..25");
      }
      await recordEvents({ sessionId, userAgent: req.get("user-agent") || null, events });
      res.status(204).end();
    } catch (e) {
      next(e instanceof SyntaxError ? new ApiError("INVALID_JSON", 400) : e);
    }
  });
  return r;
}
```

`server/app.js`의 authRouter 마운트 옆에 추가:

```js
import { activityRouter } from "./activityRoutes.js";
// sendBeacon 기본 Content-Type(text/plain) 대응 — activity 경로만 텍스트도 수용
app.use("/v1/activity", express.text({ type: "text/plain", limit: "64kb" }));
app.use("/v1/activity", activityRouter());
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server -- activityRoutes` → PASS
- [ ] **Step 5: Commit** — `git add server/activityRoutes.js server/app.js server/__tests__/activityRoutes.test.js && git commit -m "feat: activity collector endpoint POST /v1/activity"`

---

### Task 4: 로그인 성공 시 세션 연결 + login 이벤트

**Files:**
- Modify: `server/authRoutes.js` (`/callback`, `/code/verify`, `/password`의 customer 분기)
- Test: `server/__tests__/activityRoutes.test.js`에 케이스 추가

**Interfaces:**
- Consumes: Task 2의 `linkSessionToCustomer`, `recordAuthEvent`

- [ ] **Step 1: 실패하는 테스트 추가** (기존 authRoutes.test.js의 `issueCustomerCookie` 패턴 재사용)

```js
// server/__tests__/activityRoutes.test.js 에 추가
describe("auth link", () => {
  it("customer login links bd_aid session and records login event", async () => {
    const sid = randomUUID();
    // magic-link 로그인 플로우에 bd_aid 쿠키 동봉
    const ml = await request(app).post("/v1/auth/magic-link").send({ email: "t@b.com" });
    const token = new URL(ml.body.devLink).searchParams.get("token");
    const cb = await request(app).get(`/v1/auth/callback?token=${token}`).set("Cookie", [`bd_aid=${sid}`]);
    expect(cb.status).toBe(200);
    const { rows: [s] } = await query("select customer_id from activity_sessions where session_id = $1", [sid]);
    expect(s.customer_id).not.toBeNull();
    const { rows: [e] } = await query(
      "select count(*)::int as n from activity_events where session_id = $1 and event_type = 'login'", [sid]);
    expect(e.n).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- activityRoutes` → FAIL

- [ ] **Step 3: authRoutes.js 수정** — 헬퍼 하나 추가하고 세 곳에서 호출 (실패해도 로그인은 성공해야 하므로 try/catch 삼킴):

```js
// server/authRoutes.js 상단 import에 추가
import { linkSessionToCustomer, recordAuthEvent } from "./activityRepository.js";

// authRouter() 안, 라우트들 위에:
async function linkActivity(req, customerId) {
  const aid = req.cookies?.bd_aid;
  if (!aid) return;
  try {
    await linkSessionToCustomer(aid, customerId);
    await recordAuthEvent(aid, "login");
  } catch { /* 추적 실패가 로그인을 막으면 안 된다 */ }
}
```

`/callback` 핸들러의 `setSessionCookie(...)` 다음에 `await linkActivity(req, session.principalId ?? session.principal_id);`
`/code/verify` 동일. `/password`는 `principalType === "customer"`일 때만.
(세션 객체의 고객 id 필드명은 `server/session.js`의 `createSession` 반환값을 열어 확인 — `principal_id` snake/camel 여부에 맞춰 사용.)

`signup` 이벤트: `verifyMagicLink`/`verifyLoginCode`가 신규 고객 생성 여부를 반환하면
(`isNew` 류 플래그 — auth.js를 열어 확인) 그때는 `recordAuthEvent(aid, "signup")`을 대신 기록.
플래그가 없으면 이번 범위에서는 `login`만 기록하고 auth.js에 플래그 추가는 하지 않는다(YAGNI).

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server` → 전체 PASS (기존 auth 테스트 회귀 없음)
- [ ] **Step 5: Commit** — `git add server/authRoutes.js server/__tests__/activityRoutes.test.js && git commit -m "feat: link anonymous activity session on customer login"`

---

### Task 5: 어드민 조회 API 3종

**Files:**
- Create: `server/adminActivityRoutes.js`
- Modify: `server/app.js` (마운트)
- Test: `server/__tests__/adminActivity.test.js`

**Interfaces:**
- Consumes: `requireAdmin`(middleware.js), Task 1 테이블
- Produces:
  - `GET /v1/admin/activity/overview` → `{ kpi: { sessionsToday, sessions7d, pageViews7d, activeMembers7d }, topStyles: [{ entityId, views, clicks }], funnel: { styleViews, intakeStarts, intakeSubmits }, trend: [{ day, pageViews }] }` (trend는 최근 14일, `activity_daily` + 당일 원본 합산)
  - `GET /v1/admin/members` → `{ members: [{ id, customerCode, name, email, createdAt, lastActive, eventCount, orderCount }] }` (orderCount = customer_orders count, 현재 0)
  - `GET /v1/admin/members/:id/timeline?limit=50&before=<eventId>` → `{ events: [{ id, type, path, entityType, entityId, meta, createdAt }] }` (그 회원의 모든 세션 조인, 최신순)

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// server/__tests__/adminActivity.test.js
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../app.js";
import { query } from "../db.js";
import { truncateAuth, truncateActivity } from "./helpers.js";
import { hashPassword } from "../passwords.js";
import { __resetRateLimit } from "../rateLimit.js";
import { recordEvents, linkSessionToCustomer } from "../activityRepository.js";

const app = createApp();
beforeEach(async () => { await truncateAuth(); await truncateActivity(); __resetRateLimit(); });

async function adminCookie() {
  await query("insert into admin_users (email,name,password_hash) values ($1,$2,$3)",
    ["adm@b.com", "Adm", hashPassword("admin12345")]);
  const login = await request(app).post("/v1/auth/password").send({ email: "adm@b.com", password: "admin12345" });
  return login.headers["set-cookie"];
}

async function seedActivity() {
  const sid = randomUUID();
  await recordEvents({ sessionId: sid, events: [
    { type: "page_view", path: "/" },
    { type: "style_view", entityType: "style", entityId: "ST-1" },
    { type: "style_click", entityType: "style", entityId: "ST-1" },
    { type: "intake_start" }, { type: "intake_submit" },
  ]});
  const { rows: [cust] } = await query(
    "insert into customers (customer_code,email,name) values ('C-9','m@b.com','Mina') returning id");
  await linkSessionToCustomer(sid, cust.id);
  return { sid, customerId: Number(cust.id) };
}

describe("admin activity APIs", () => {
  it("401 without admin session", async () => {
    expect((await request(app).get("/v1/admin/activity/overview")).status).toBe(401);
    expect((await request(app).get("/v1/admin/members")).status).toBe(401);
  });

  it("overview returns kpi/topStyles/funnel/trend", async () => {
    await seedActivity();
    const res = await request(app).get("/v1/admin/activity/overview").set("Cookie", await adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.kpi.sessionsToday).toBe(1);
    expect(res.body.topStyles[0]).toMatchObject({ entityId: "ST-1", views: 1, clicks: 1 });
    expect(res.body.funnel).toMatchObject({ styleViews: 1, intakeStarts: 1, intakeSubmits: 1 });
    expect(Array.isArray(res.body.trend)).toBe(true);
  });

  it("members list + timeline", async () => {
    const { customerId } = await seedActivity();
    const cookie = await adminCookie();
    const list = await request(app).get("/v1/admin/members").set("Cookie", cookie);
    expect(list.status).toBe(200);
    const m = list.body.members.find((x) => x.id === customerId);
    expect(m).toMatchObject({ email: "m@b.com", eventCount: 6, orderCount: 0 }); // 5 + login 이벤트... seedActivity에는 login 없음 → 5
    const tl = await request(app).get(`/v1/admin/members/${customerId}/timeline`).set("Cookie", cookie);
    expect(tl.status).toBe(200);
    expect(tl.body.events.length).toBe(5);
    expect(tl.body.events[0].type).toBe("intake_submit"); // 최신순
  });
});
```

주의: 위 `eventCount` 기대값은 `seedActivity`가 만든 5건이 정답이다 — 테스트 작성 시 5로 넣는다(주석의 6은 오답 예시).

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- adminActivity` → FAIL (404)

- [ ] **Step 3: 구현**

```js
// server/adminActivityRoutes.js
import { Router } from "express";
import { query } from "./db.js";
import { requireAdmin } from "./middleware.js";

export function adminActivityRouter() {
  const r = Router();
  r.use(requireAdmin);

  r.get("/activity/overview", async (_req, res, next) => {
    try {
      const [today, week, pv, active, top, funnel, trend] = await Promise.all([
        query("select count(distinct session_id)::int as n from activity_events where created_at >= date_trunc('day', now())"),
        query("select count(distinct session_id)::int as n from activity_events where created_at >= now() - interval '7 days'"),
        query("select count(*)::int as n from activity_events where event_type = 'page_view' and created_at >= now() - interval '7 days'"),
        query(`select count(distinct s.customer_id)::int as n from activity_events e
               join activity_sessions s on s.session_id = e.session_id
               where s.customer_id is not null and e.created_at >= now() - interval '7 days'`),
        query(`select entity_id as "entityId",
                 count(*) filter (where event_type = 'style_view')::int as views,
                 count(*) filter (where event_type = 'style_click')::int as clicks
               from activity_events
               where entity_type = 'style' and created_at >= now() - interval '30 days'
               group by entity_id order by count(*) desc limit 10`),
        query(`select
                 count(*) filter (where event_type = 'style_view')::int as "styleViews",
                 count(*) filter (where event_type = 'intake_start')::int as "intakeStarts",
                 count(*) filter (where event_type = 'intake_submit')::int as "intakeSubmits"
               from activity_events where created_at >= now() - interval '30 days'`),
        query(`select day, sum(n)::int as "pageViews" from (
                 select day, count as n from activity_daily where event_type = 'page_view' and day >= current_date - 13
                 union all
                 select created_at::date as day, count(*) as n from activity_events
                   where event_type = 'page_view' and created_at >= current_date - 13
                   group by created_at::date
               ) t group by day order by day`),
      ]);
      res.json({
        kpi: { sessionsToday: today.rows[0].n, sessions7d: week.rows[0].n,
               pageViews7d: pv.rows[0].n, activeMembers7d: active.rows[0].n },
        topStyles: top.rows, funnel: funnel.rows[0], trend: trend.rows,
      });
    } catch (e) { next(e); }
  });

  r.get("/members", async (_req, res, next) => {
    try {
      const { rows } = await query(`
        select c.id::int, c.customer_code as "customerCode", c.name, c.email,
               c.created_at as "createdAt",
               max(s.last_seen) as "lastActive",
               coalesce(sum(ec.n), 0)::int as "eventCount",
               (select count(*)::int from customer_orders o where o.customer_id = c.id) as "orderCount"
        from customers c
        left join activity_sessions s on s.customer_id = c.id
        left join lateral (select count(*) as n from activity_events e where e.session_id = s.session_id) ec on true
        group by c.id order by max(s.last_seen) desc nulls last, c.created_at desc`);
      res.json({ members: rows });
    } catch (e) { next(e); }
  });

  r.get("/members/:id/timeline", async (req, res, next) => {
    try {
      const customerId = Number(req.params.id);
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const before = req.query.before ? Number(req.query.before) : null;
      const { rows } = await query(`
        select e.id::int, e.event_type as type, e.path, e.entity_type as "entityType",
               e.entity_id as "entityId", e.meta, e.created_at as "createdAt"
        from activity_events e
        join activity_sessions s on s.session_id = e.session_id
        where s.customer_id = $1 and ($2::bigint is null or e.id < $2)
        order by e.id desc limit $3`, [customerId, before, limit]);
      res.json({ events: rows });
    } catch (e) { next(e); }
  });

  return r;
}
```

`server/app.js`:

```js
import { adminActivityRouter } from "./adminActivityRoutes.js";
app.use("/v1/admin", adminActivityRouter());
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server -- adminActivity` → PASS
- [ ] **Step 5: Commit** — `git add server/adminActivityRoutes.js server/app.js server/__tests__/adminActivity.test.js && git commit -m "feat: admin activity APIs — overview, members, timeline"`

---

### Task 6: 일별 집계 + 90일 정리 (Vercel Cron)

**Files:**
- Create: `server/activityMaintenance.js`
- Modify: `server/app.js`, `vercel.json`
- Test: `server/__tests__/activityMaintenance.test.js`

**Interfaces:**
- Produces: `async runActivityMaintenance() -> { rolledUp, prunedEvents, prunedSessions }`; `GET /v1/internal/activity-maintenance` (헤더 `authorization: Bearer ${process.env.CRON_SECRET}` 필수, 미설정 시 404 취급)

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// server/__tests__/activityMaintenance.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { truncateActivity } from "./helpers.js";
import { recordEvents } from "../activityRepository.js";
import { runActivityMaintenance } from "../activityMaintenance.js";

beforeEach(async () => { await truncateActivity(); });

describe("activity maintenance", () => {
  it("rolls up finished days into activity_daily and prunes >90d events", async () => {
    const sid = randomUUID();
    await recordEvents({ sessionId: sid, events: [{ type: "page_view", path: "/" }] });
    // 어제 발생한 이벤트와 100일 지난 이벤트를 직접 심는다
    await query(`insert into activity_events (session_id, event_type, created_at)
                 values ($1,'page_view', now() - interval '1 day'),
                        ($1,'style_view', now() - interval '100 days')`, [sid]);
    const out = await runActivityMaintenance();
    expect(out.prunedEvents).toBe(1); // 100일짜리만 삭제
    const { rows } = await query(
      "select count::int from activity_daily where event_type='page_view' and day = (now() - interval '1 day')::date");
    expect(rows[0].count).toBe(1); // 어제 page_view 집계
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- activityMaintenance` → FAIL

- [ ] **Step 3: 구현**

```js
// server/activityMaintenance.js
import { query } from "./db.js";

// 끝난 날(오늘 이전)의 원본을 일별 집계로 적재하고, 90일 지난 원본과
// 90일 미활동·미연결 세션을 정리한다. 하루 1회 크론 호출 (멱등).
export async function runActivityMaintenance() {
  const rollup = await query(`
    insert into activity_daily (day, event_type, entity_id, count)
    select created_at::date, event_type, coalesce(entity_id, ''), count(*)
    from activity_events
    where created_at < date_trunc('day', now())
    group by 1, 2, 3
    on conflict (day, event_type, entity_id) do update set count = excluded.count
    returning 1`);
  const pruneEvents = await query(
    "delete from activity_events where created_at < now() - interval '90 days' returning 1");
  const pruneSessions = await query(
    `delete from activity_sessions
     where customer_id is null and last_seen < now() - interval '90 days' returning 1`);
  return { rolledUp: rollup.rowCount, prunedEvents: pruneEvents.rowCount, prunedSessions: pruneSessions.rowCount };
}
```

`server/app.js` (v1 NOT_FOUND 캐치올보다 위에):

```js
import { runActivityMaintenance } from "./activityMaintenance.js";
app.get("/v1/internal/activity-maintenance", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get("authorization") !== `Bearer ${secret}`) {
      return next(new ApiError("NOT_FOUND", 404)); // 존재 자체를 숨긴다
    }
    res.json(await runActivityMaintenance());
  } catch (e) { next(e); }
});
```

`vercel.json`에 crons 추가 (UTC 18:00 = KST 03:00):

```json
"crons": [{ "path": "/v1/internal/activity-maintenance", "schedule": "0 18 * * *" }]
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server -- activityMaintenance` → PASS. 그리고 `npm run test:server` 전체 PASS.
- [ ] **Step 5: Commit** — `git add server/activityMaintenance.js server/app.js vercel.json server/__tests__/activityMaintenance.test.js && git commit -m "feat: activity daily rollup + 90d retention cron"`
- [ ] **Step 6: 배포 전 준비 메모** — Vercel 환경변수 `CRON_SECRET` 필요 (배포 단계에서 `vercel env add CRON_SECRET production`).

---

### Task 7: 클라이언트 추적기 track.js

**Files:**
- Create: `src/lib/track.js`
- Test: `src/lib/__tests__/track.test.js`

**Interfaces:**
- Produces: `track(type, fields?)` — fields `{ path?, entityType?, entityId?, meta? }`; `flushNow()` (테스트/이탈용); 내부: 5초 간격 플러시, `visibilitychange→hidden` 시 sendBeacon, 큐 상한 25 도달 시 즉시 플러시.
- 게이트: `WITH_BACKOFFICE === false`(데모 빌드)면 완전 no-op; `location.pathname`이 `/admin` 또는 `/gate-`로 시작하면 무시.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/lib/__tests__/track.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// jsdom 환경 (vitest 기본 config가 jsdom인지 vitest.config 확인 — 클라이언트 테스트들이 이미 jsdom을 쓴다)
describe("track", () => {
  let sent;
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    vi.stubGlobal("fetch", vi.fn(async (url, opts) => { sent.push({ url, body: opts?.body }); return { ok: true }; }));
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn((url, body) => { sent.push({ url, body, beacon: true }); return true; }),
    });
    document.cookie = "bd_aid=; max-age=0; path=/"; // reset
    vi.resetModules();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("sets bd_aid cookie and batches events on the flush interval", async () => {
    const { track } = await import("../track.js");
    track("page_view", { path: "/" });
    track("style_click", { entityType: "style", entityId: "ST-1" });
    expect(document.cookie).toMatch(/bd_aid=[0-9a-f-]{36}/);
    expect(sent).toHaveLength(0); // 아직 큐
    await vi.advanceTimersByTimeAsync(5100);
    expect(sent).toHaveLength(1);
    const payload = JSON.parse(sent[0].body);
    expect(payload.events).toHaveLength(2);
    expect(payload.events[1].type).toBe("style_click");
  });

  it("ignores admin/gate paths", async () => {
    const { track } = await import("../track.js");
    window.history.pushState({}, "", "/admin/orders");
    track("page_view", { path: "/admin/orders" });
    await vi.advanceTimersByTimeAsync(6000);
    expect(sent).toHaveLength(0);
    window.history.pushState({}, "", "/");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/track.test.js` → FAIL

- [ ] **Step 3: 구현**

```js
// src/lib/track.js
// 방문자 행동 추적 — bd_aid 익명 쿠키 + 배치 sendBeacon/fetch.
// fire-and-forget: 어떤 실패도 사용자 경험/콘솔에 영향을 주지 않는다.
import { WITH_BACKOFFICE } from "./flags.js";

const FLUSH_MS = 5000;
const MAX_QUEUE = 25;
const ENDPOINT = "/v1/activity";

let queue = [];
let timer = null;

function cookieId() {
  const m = document.cookie.match(/(?:^|;\s*)bd_aid=([0-9a-f-]{36})/i);
  if (m) return m[1];
  const id = crypto.randomUUID();
  document.cookie = `bd_aid=${id}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  return id;
}

function blockedPath() {
  const p = window.location.pathname;
  return p.startsWith("/admin") || p.startsWith("/gate-");
}

function send(body) {
  try {
    const json = JSON.stringify(body);
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, json)) return;
    fetch(ENDPOINT, { method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: json }).catch(() => {});
  } catch { /* no-op */ }
}

export function flushNow() {
  if (queue.length === 0) return;
  cookieId(); // 쿠키 보장
  const events = queue.splice(0, MAX_QUEUE);
  send({ events });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flushNow(); }, FLUSH_MS);
}

export function track(type, fields = {}) {
  if (!WITH_BACKOFFICE) return;         // GitHub Pages 데모 빌드: 추적 없음
  if (typeof window === "undefined") return;
  if (blockedPath()) return;            // 어드민·게이트 화면은 남기지 않는다
  queue.push({ type, ...fields });
  if (queue.length >= MAX_QUEUE) flushNow();
  else schedule();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/track.test.js` → PASS
- [ ] **Step 5: Commit** — `git add src/lib/track.js src/lib/__tests__/track.test.js && git commit -m "feat: client activity tracker (bd_aid, batched beacon)"`

---

### Task 8: 이벤트 호출부 배선

**Files:**
- Modify: `src/App.jsx` (page_view — Layout에서 `useLocation` effect)
- Modify: `src/pages/Home.jsx` (컬렉션 카드 `style_click` — 카테고리 링크는 entityId 없이 `meta:{category}`)
- Modify: `src/pages/StyleCatalog.jsx` (스타일 카드 클릭 `style_click`, entityId=styleId)
- Modify: `src/pages/StyleDetail.jsx` (마운트 `style_view`, 메탈/캐럿 변경 `option_select`)
- Modify: `src/components/ui.jsx` (MediaZoomModal 마운트 `media_zoom`)
- Modify: `src/pages/IntakeForm.jsx` (마운트 `intake_start`, 제출 성공 `intake_submit`)
- Modify: `src/pages/ReviewNew.jsx` (제출 성공 `review_submit`)

**Interfaces:**
- Consumes: Task 7의 `track(type, fields)`

- [ ] **Step 1: page_view 배선** — App.jsx의 Layout(또는 Routes를 감싸는 컴포넌트)에:

```jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { track } from "./lib/track.js";

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => { track("page_view", { path: location.pathname }); }, [location.pathname]);
  return null;
}
// <Routes> 위(같은 Router 컨텍스트 안)에 <PageViewTracker /> 삽입
```

- [ ] **Step 2: 각 페이지 배선** — 각 파일에서 `import { track } from "../lib/track.js";` 후:
  - StyleDetail: `useEffect(() => { if (style) track("style_view", { path: location.pathname, entityType: "style", entityId: style.id }); }, [style?.id]);` / 메탈·캐럿 선택 핸들러에 `track("option_select", { entityType: "style", entityId: style.id, meta: { metal } })`
  - StyleCatalog: 카드 Link onClick에 `track("style_click", { entityType: "style", entityId: item.id })`
  - Home 컬렉션 카드: `track("style_click", { meta: { category: category.key } })`
  - MediaZoomModal 마운트 effect: `track("media_zoom", {})` (styleId를 props로 받으면 entityId 포함)
  - IntakeForm: 마운트 `track("intake_start", {})`, 제출 성공 콜백 `track("intake_submit", { meta: { intakeId } })`
  - ReviewNew: 제출 성공 시 `track("review_submit", {})`
  - 각 파일의 실제 함수/핸들러 이름은 구현 시 열어 확인한다 — 이 태스크는 한 파일씩 열고, 이벤트 1개 심고, `npm test`로 회귀 없음을 확인하는 반복.

- [ ] **Step 3: 회귀 확인** — Run: `npm test` → 전체 PASS (기존 103+신규)
- [ ] **Step 4: Commit** — `git add -A src/ && git commit -m "feat: wire activity events across customer surfaces"`

---

### Task 9: AdminMembers 페이지 + 라우트 + 메뉴

**Files:**
- Create: `src/pages/admin/AdminMembers.jsx`
- Modify: `src/App.jsx` (lazy import + `/admin/members`, `/admin/members/:memberId` 라우트)
- Modify: `src/pages/admin/Admin.jsx` (menu 배열에 `{ to: "/admin/members", key: "members", ops: true }`)
- Modify: `src/opsStrings.js` (4개 언어 `opsA.menu.members` = "회원"/"Members"/"会员"/"Miembros" + 페이지 문구 블록)

**Interfaces:**
- Consumes: Task 5 API 3종, `apiFetch`(src/lib/api.js — 실패 시 ApiUnavailableError → 데모 안내 문구)
- Produces: `/admin/members` (개요 KPI + 인기 스타일 + 퍼널 + 회원 테이블), `/admin/members/:memberId` (타임라인)

- [ ] **Step 1: 페이지 뼈대 구현** — 기존 admin 페이지(AdminReviews.jsx 등)의 패널/테이블 클래스(`panel`, `admin-*`)를 재사용. 데이터 로딩:

```jsx
// src/pages/admin/AdminMembers.jsx (핵심 구조)
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../../lib/api.js";
import { useLocale } from "../../i18n.jsx";

export default function AdminMembers() {
  const { p } = useLocale();
  const s = p.opsA.members; // Task 9 Step 2에서 추가하는 문구 블록
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    Promise.all([apiFetch("/admin/activity/overview"), apiFetch("/admin/members")])
      .then(([o, m]) => { setOverview(o); setMembers(m.members); })
      .catch((e) => setError(e instanceof ApiUnavailableError ? "demo" : "error"));
  }, []);
  if (error === "demo") return <p className="muted">{s.demoUnavailable}</p>;
  // ... KPI 타일 4개, topStyles 목록(스타일명은 lib/store.js findSpec/listOpsStyles로 해석, 없으면 ID 그대로),
  // funnel 3단계, 회원 테이블(각 행 → Link to={`/admin/members/${m.id}`})
}

export function AdminMemberTimeline() {
  const { memberId } = useParams();
  const [events, setEvents] = useState(null);
  useEffect(() => {
    apiFetch(`/admin/members/${memberId}/timeline`).then((r) => setEvents(r.events)).catch(() => setEvents([]));
  }, [memberId]);
  // ... 시간순 리스트: createdAt 로컬시각 + 이벤트 설명 문구(s.eventLabels[type]) + entityId
}
```

- [ ] **Step 2: opsStrings 4개 언어에 `members` 블록 추가** — `menu.members`, 페이지 제목, KPI 라벨(오늘 세션/7일 세션/7일 페이지뷰/활성 회원), 퍼널 라벨(조회→시작→제출), 테이블 헤더(이름/이메일/가입일/최근 활동/이벤트/주문), `eventLabels` 10종, `demoUnavailable`("실서버 API가 필요한 화면입니다" 류) — 4개 언어 모두 작성. 럭셔리 톤보다 **운영 명료함** 우선(백오피스).
- [ ] **Step 3: 라우트·메뉴 연결** — App.jsx lazy import(`WITH_BACKOFFICE` 가드 동일 패턴) + Admin.jsx menu 추가.
- [ ] **Step 4: 수동 확인** — `npm run api` + `npm run dev` 후 어드민 로그인 → `/admin/members`에서 KPI·목록·타임라인 렌더 확인 (시드: 홈에서 몇 번 클릭해 이벤트 생성). Playwright로 스크린샷.
- [ ] **Step 5: 전체 테스트** — Run: `npm test` → PASS
- [ ] **Step 6: Commit** — `git add -A src/ && git commit -m "feat: admin members dashboard — overview, list, timeline"`

---

### Task 10: 종합 검증 + 배포

- [ ] **Step 1:** `npm test && npm run test:server` 전체 PASS
- [ ] **Step 2:** 로컬 e2e: `npm run api` + `npm run dev` — 브라우저에서 홈 탐색→로그인→어드민 회원 화면에서 본인 여정 확인 (verify 스킬)
- [ ] **Step 3:** `npm run build` 성공 확인 (데모 플래그 빌드 포함: 기존 Pages 빌드 스크립트가 있으면 그대로)
- [ ] **Step 4:** Vercel 환경변수 `CRON_SECRET` 추가 (`openssl rand -hex 24`로 생성)
- [ ] **Step 5:** 프로덕션 마이그레이션 (`DATABASE_URL=<neon prod> npm run db:migrate`) — `.env.beloved` 시크릿 관리 관행 준수
- [ ] **Step 6:** vercel:deploy 스킬로 프로덕션 배포, 배포 후 belovediamond.com에서 이벤트 수집(Network 탭 /v1/activity 204)과 어드민 화면 확인
