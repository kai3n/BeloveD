# bot_admin 역할 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 봇용 제한 어드민(bot_admin) — 돈 관련 작업(설정 저장·제안 발송·결제 확인·잔금 요청·주문 취소)은 403, 나머지(다이아/IGI 입력·비중요 단계·챗 응대·조회)는 허용.

**Architecture:** admin_users.role('full'|'bot') → 로그인 시 세션 principal_type을 admin/bot_admin으로 분기. requireAdmin은 둘 다 통과(현행 라우트 = 봇 허용), 신설 requireFullAdmin과 이벤트 타입 검사로 돈 경계만 강제. 콘솔 UI는 adminLevel로 금지 메뉴/버튼 숨김·비활성.

**Tech Stack:** Express + Postgres(Neon), 세션 테이블 principal_type, vitest(server: 로컬 PG 필요).

**Spec:** `docs/superpowers/specs/2026-07-09-bot-admin-role-design.md`

## Global Constraints

- 금지 이벤트: `proposal_sent`, `deposit_confirmed`, `balance_requested`, `balance_confirmed`, `order_cancelled` (정확히 이 5개)
- 금지 라우트: `PUT /admin/settings`
- 봇 계정: `bot_admin@belovediamond.com`, env `BOT_ADMIN_EMAIL`/`BOT_ADMIN_PASSWORD`(9자 미만 거부), 비밀번호 로그 금지
- 콘솔 숨김 메뉴: benchmark·metals·payments·coupons (4개 언어 힌트: "Full admin only"/"풀 어드민 전용"/"仅限完整管理员"/"Solo administrador completo")

### Task 1: 마이그레이션 + 로그인 분기 + 미들웨어
- Create `db/migrations/0015_admin_roles.sql`: `alter table admin_users add column if not exists role text not null default 'full' check (role in ('full','bot'));`
- `server/auth.js` loginWithPassword: admin 매치 시 `const type = admin.rows[0].role === "bot" ? "bot_admin" : "admin"; return { principalType: type, session: await issueSession(type, ...) }`
- `server/middleware.js`: requireAdmin에 `|| req.principal?.type === "bot_admin"` 추가, `requireFullAdmin` 신설(403 `FULL_ADMIN_REQUIRED`)
- `server/authRoutes.js` 로그인 쿠키 분기: `principalType === "customer" ? COOKIE_CUSTOMER : COOKIE_ADMIN` (bot_admin도 어드민 쿠키)

### Task 2: 라우트 강제
- `server/adminOrderRoutes.js` PUT /admin/settings: requireAdmin → requireFullAdmin
- `server/customerRoutes.js` events 핸들러: `FULL_ADMIN_EVENTS.includes(type) && req.principal.type !== "admin"` → `throw new ApiError("FULL_ADMIN_REQUIRED", 403)`

### Task 3: 시드
- `server/seedAdmin.js`: run()에서 `BOT_ADMIN_EMAIL && BOT_ADMIN_PASSWORD`(길이 검증) 있으면 role='bot' upsert (`on conflict (email) do update set password_hash, role='bot', active=true`), 비밀번호 비로깅

### Task 4: 서버 테스트 (로컬 PG 가능 시)
- `server/__tests__/botAdmin.test.js`: bot 로그인 → principal "bot_admin"; 금지 이벤트 403 / 허용 이벤트(production_started) 201; settings PUT 403 / GET 200; full admin은 전부 허용

### Task 5: 클라이언트
- `src/lib/auth.jsx`: bot_admin principal 브리지(u-admin) + `adminLevel` 컨텍스트 노출 ("full"|"bot"|null, localStorage `lumina-admin-level`)
- `src/pages/admin/Admin.jsx`: adminLevel==="bot"이면 benchmark/metals/payments/coupons 메뉴 필터
- `src/pages/admin/AdminLiveOrders.jsx`: 금지 스텝(proposal_sent 등 FULL_ADMIN_EVENTS) 버튼 disabled + 힌트, 주문취소 버튼 숨김 — 프론트 상수는 `src/lib/orderFlow.js` 또는 로컬 상수

### Task 6: 검증·배포·프로비저닝
- `npm test` + `npm run test:server`(가능 시) + build
- 커밋 → 클린 워크트리 `vercel --prod`
- `.env.beloved`에 BOT_ADMIN_* 추가(강한 랜덤 비번 생성) → prod DB에 `db:migrate` + `seed:admin` 실행
- 프로덕션 검증: bot 계정 로그인 → 콘솔 메뉴 축소 확인 + 금지 API 403 확인
