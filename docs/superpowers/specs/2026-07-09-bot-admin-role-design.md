# 2단계 어드민 — bot_admin 역할 (돈 관련 작업 차단)

**날짜**: 2026-07-09
**상태**: 설계 승인됨 (사용자 확정 — 접근 A)

## 배경 / 목적

운영 자동화 봇에게 어드민 콘솔/API 접근을 주되, 금전적 리스크가 있는 작업은 사람(full admin)만
할 수 있게 한다. 봇은 다이아 정보(IGI 등) 입력, 비중요 주문 단계 진행, 고객 문의(라이브챗) 응대를
맡는다.

## 확정된 결정 사항 (Q&A)

| 질문 | 결정 |
|---|---|
| 권한 경계 | **돈 관련만 금지** — 결제 확인·주문 취소·설정(쿠폰/가격/배너)·제안 발송 금지, 나머지 허용 |
| 계정 관리 | 시드 스크립트 + env (`BOT_ADMIN_EMAIL`/`BOT_ADMIN_PASSWORD`) — 관리 UI 없음 |
| 아키텍처 | **접근 A** — 세션 principal 타입 분리(`admin` vs `bot_admin`) + `requireFullAdmin` 미들웨어 |

## 권한 매트릭스

**full admin 전용 (bot_admin 403)**

| 작업 | 엔드포인트 |
|---|---|
| 운영 설정 저장 (쿠폰·벤치마크·멜리·메탈·결제채널·세일배너) | `PUT /admin/settings` (adminOrderRoutes) |
| 주문 이벤트: `proposal_sent`(가격 커밋), `deposit_confirmed`, `balance_requested`, `balance_confirmed`, `order_cancelled`(환불 판단) | `POST /admin/orders/:code/events` (이벤트 타입별 검사) |

**bot_admin 허용 (full admin과 동일)**

- 조회 전부 (주문 목록/상세, 고객 CRM, 활동 대시보드, 채팅 인박스)
- 주문 이벤트: `diamond_locked`(IGI 입력), `production_started`, `qc_ready`, `shipped`, `delivered`
- 라이브챗 응대·스태프 도구, 리뷰 큐레이션, 카탈로그(디자인) 편집, 미디어 업로드
- (돈이 걸리지 않은 모든 작업 — 새 엔드포인트 추가 시 돈 관련이면 `requireFullAdmin`을 명시)

## 아키텍처

### DB — `db/migrations/0015_admin_roles.sql`

```sql
alter table admin_users add column if not exists role text not null default 'full'
  check (role in ('full', 'bot'));
```

(기존 계정은 자동으로 `full`.)

### 로그인 — `server/auth.js` `loginWithPassword`

admin 행 매칭 시 `row.role === 'bot'`이면 세션을 `issueSession("bot_admin", id, ADMIN_TTL_MS)`로
발급, 아니면 기존대로 `"admin"`. 응답 `principal: "bot_admin"`. 쿠키는 기존 `COOKIE_ADMIN` 공유
(권한은 세션 행의 principal_type이 결정).

### 미들웨어 — `server/middleware.js`

- `requireAdmin`: `admin` **또는** `bot_admin` 통과 (기존 라우트 전부 이 상태로 유지 = 봇 허용)
- `requireFullAdmin`(신설): `admin`만 통과, 아니면 403 `FULL_ADMIN_REQUIRED`

### 라우트 강제

- `PUT /admin/settings` → `requireFullAdmin`
- `POST /admin/orders/:code/events` → 핸들러 안에서
  `FULL_ADMIN_EVENTS = ["proposal_sent", "deposit_confirmed", "balance_requested", "balance_confirmed", "order_cancelled"]`
  에 해당하고 `principal.type !== "admin"`이면 403 (주문 취소는 이 이벤트로만 일어난다)
- `/auth/session`·로그인 응답은 `bot_admin` 타입을 그대로 노출

### 시드 — `server/seedAdmin.js`

`BOT_ADMIN_EMAIL` + `BOT_ADMIN_PASSWORD`(9자 이상)가 설정돼 있으면 role='bot' 계정을 upsert
(기존 full 시드와 같은 파일에서 함께 실행, env 없으면 스킵). 실계정:
`bot_admin@belovediamond.com` — 비밀번호는 `.env.beloved`에 보관, 로그에 남기지 않음.

### 클라이언트 — `src/lib/auth.jsx` + 콘솔 UI

- `commitServerPrincipal("bot_admin")` → 데모 스토어 admin 유저로 브리지하되
  `adminLevel: "bot"`을 세션 컨텍스트에 노출 (`useAuth().adminLevel`)
- 콘솔 메뉴(`Admin.jsx`): bot이면 벤치마크·메탈·결제·쿠폰 메뉴 숨김
- 실주문 콘솔(`AdminLiveOrders.jsx`): 금지 이벤트 스텝 버튼·주문취소 버튼 비활성 +
  "Full admin only" 힌트 (4개 언어)
- UI는 편의일 뿐 — 서버 403이 최종 방어선

### 테스트

- `server/__tests__`: bot_admin 세션으로 ① 금지 이벤트 403 ② 허용 이벤트 201 ③ settings PUT 403
  ④ 채팅/조회 200 ⑤ 로그인 principal `bot_admin` (기존 auth 테스트 패턴 재사용)
- seedAdmin: env 없으면 봇 시드 스킵, 짧은 비밀번호 거부

## 에러 처리 / 엣지

- 봇 강등/차단: `active=false` 또는 비밀번호 교체(세션 12h TTL 내 소멸). 즉시 차단이 필요하면
  sessions 테이블에서 해당 principal 세션 삭제 (운영 절차, 코드 변경 없음).
- 구버전 세션(마이그레이션 전 발급)은 전부 `admin` 타입 — full 권한 유지, 봇 계정은 마이그레이션
  후에만 생기므로 안전.
- 데모(GitHub Pages) 빌드: 서버 부재 — bot_admin은 실서버 전용 개념, 데모 스토어에는 미도입.

## 비범위 (YAGNI)

- 어드민 콘솔에서 봇 계정 관리 UI
- 세분화된 권한 매트릭스(작업별 토글) — 2단계면 충분
- 봇 전용 API 키/감사 로그 강화 (기존 audit 로그로 충분)
