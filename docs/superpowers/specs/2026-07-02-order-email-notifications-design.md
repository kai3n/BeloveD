# 주문 이메일 알림 — 인테이크 확인 + 상태 업데이트 메일

날짜: 2026-07-02 · 상태: 승인됨 (사용자 컨펌)

## 목표

고객 인테이크 제출 시 접수 확인 메일을 보내고, 이후 주문 진행의 고객 관점 주요 이벤트마다
저장된 로케일(EN/KO/ZH/ES)로 상태 업데이트 메일을 발송한다. 이 과정에서 로드맵 슬라이스 2
(인테이크 제출 → Postgres)를 함께 완성하고, 주문 상태 이벤트를 서버가 기록하도록 하여
이후 어드민 서버화(슬라이스 4)의 기반을 만든다.

## 확정된 결정

| 결정 | 선택 |
|---|---|
| 구현 범위 | 서버 상태기록 + 메일 (인테이크→Postgres 포함, notify-only 방식 배제) |
| 발송 이벤트 | 고객 관점 주요 이벤트 10종 (아래 표) — 전체 상태/마일스톤 발송은 스팸이라 배제 |
| 메일 언어 | 제출 시점 로케일 저장 → 그 언어로 발송 (4개 언어 전부) |
| 포털 링크 v1 | 제출 브라우저 = 풀 포털 / 타 기기 = 이메일 OTP 로그인 후 서버가 아는 범위(상태 타임라인)만 |

## 전제 (이미 존재하는 것)

- `server/customerRepository.js`: `createDraftIntake`/`submitIntake`(고객 upsert, `BD-` 주문코드
  발급, 타임라인 이벤트, 감사로그, 멱등) — **라우트만 미연결**
- `server/mailer.js`: Resend `deliver()` + 브랜드 `wrap()` 레이아웃, dev sink(`drainMail`)
- `server/middleware.js`: `requireAdmin` 세션 미들웨어 · `server/rateLimit.js`
- DB: `customers.locale`, `customer_orders(stage/phase/waiting_on)`, `customer_timeline_events`
- 고객 이메일 OTP 로그인(`/v1/auth/code`) — 타 기기 포털 접근에 재사용

**스키마 변경 없음** (마이그레이션 불필요).

## 1. 인테이크 제출 → 서버 + 확인 메일

- 새 `server/customerRoutes.js` → `app.use("/v1", customerRouter())`
- `POST /v1/intakes` (공개, IP당 분당 5회 제한): draft 생성 + 제출을 한 라우트에서 처리.
  요청 body = 인테이크 폼 페이로드 + `locale`. 응답 `{ orderCode, stage }`.
- 확인 메일(`received`)은 **트랜잭션 커밋 후** 발송 — 메일 실패가 제출을 실패시키지 않는다
  (로그만 남김). `submitIntake`가 기존 주문을 반환하면(멱등) 메일은 다시 보내지 않는다 —
  이를 위해 `submitIntake` 반환에 `created: boolean` 플래그를 추가한다.
- `IntakeForm.submit`: 서버 우선 → 성공 시 서버 코드로 로컬 데모 스토어 브리지
  (`createIntake`에 `{ orderId: serverCode }` 오버라이드 추가, 로컬 주문에 `serverCode` 저장) →
  포털 이동은 기존 로컬 경로 그대로. `ApiUnavailableError` 시 현행 로컬 폴백(GH Pages 데모 유지).

## 2. 주문 상태 이벤트 + 상태 메일

- `POST /v1/admin/orders/:orderCode/events` (`requireAdmin`, 분당 30회):
  body `{ type, data? }` → ① `customer_timeline_events`에 기록(payload에 type·data 저장)
  ② 아래 표대로 `customer_orders.stage/phase/waiting_on` 전이 ③ 메일 발송 ④ `audit_log` 기록.
- 이벤트 타입과 전이·메일 (`data`는 메일 본문에 반영, 예: `shipped.tracking`):

| type | stage 전이 후 | phase | waiting_on | 메일 |
|---|---|---|---|---|
| `received` (인테이크 자동) | OPS_REVIEW | DEFINE | BELOVEDIAMOND | 접수 확인 |
| `proposal_sent` | QUOTE | DEFINE | CUSTOMER | 제안·견적 도착 |
| `deposit_confirmed` | CAD | APPROVE_DESIGN | BELOVEDIAMOND | 입금 확인 |
| `diamond_locked` | CAD | APPROVE_DESIGN | BELOVEDIAMOND | 다이아 확정 (IGI 번호 포함 가능) |
| `cad_ready` | CAD | APPROVE_DESIGN | CUSTOMER | CAD 승인 요청 |
| `production_started` | PRODUCTION | MAKING | BELOVEDIAMOND | 제작 시작 |
| `qc_ready` | FINAL_QC | MAKING | CUSTOMER | QC 영상 확인 요청 |
| `balance_requested` | BALANCE | DELIVERY | CUSTOMER | 잔금 안내 |
| `shipped` | SHIPPING | DELIVERY | EXTERNAL | 발송 + 트래킹 |
| `delivered` | DELIVERED | CLOSED | NONE | 배송 완료 |

- 같은 타입 재호출 허용(예: CAD V2) — 재발송은 어드민 의도로 간주. 뒤로 가는 전이도 막지 않는다
  (운영 실수 복구는 어드민 판단).
- 어드민 UI 훅: `src/lib/api.js`에 `notifyOrderEvent(serverCode, type, data)` (fire-and-forget,
  실패 시 콘솔 경고 + UI 토스트 1회). AdminOpsOrder의 해당 액션 지점(제안 발행, 입금 확인,
  다이아 락, CAD 발행, 제작 전환, QC 발행, 잔금 요청, 발송, 배송 완료)에서 호출.
  `serverCode` 없는 주문(구·데모 주문)은 호출 생략, 주문 헤더에 "메일 미연동" 배지.
  ⚠️ AdminOpsOrder·store.js는 병렬 세션이 CAD 플로우 수정 중 — 훅 삽입은 머지 후 조율.

## 3. 메일 템플릿 (4개 언어)

- 새 `server/orderMail.js`: `ORDER_MAIL[type][locale] = { subject, body(data) }` — 10종 × 4개 언어.
  `wrap()` 재사용, 본문 구성: 인사 + 이벤트 한 줄 + 주문코드 + 포털 CTA 버튼
  (`{PUBLIC_ORIGIN}/track/{orderCode}`) + "이 주문을 기억하지 못하시면 무시하세요" 푸터.
- 언어 선택: `customers.locale` (제출 시 저장된 값). 미지원 로케일 방어는 `en` 폴백.

## 4. 포털 링크 v1 한계 (명시적 스코프 아웃)

- 메일 링크 `/track/BD-xxxxxx`: 제출한 브라우저에선 로컬 브리지 덕에 풀 포털.
  다른 기기에선 로컬 데이터가 없으므로 이메일 OTP 로그인 유도 → 서버가 아는
  상태 타임라인만 표시(기존 `getCustomerOrder`/`listCustomerOrders` 재사용).
- 메일 링크에는 로컬 `queryCode`가 없으므로, 브리지된 주문은 **생성한 브라우저에서는
  code 없이 열리도록** 로컬 소유 판정을 추가한다(로컬 스토어에 해당 주문이 있고
  이 브라우저에서 생성된 경우). 그 외에는 기존 code 검증 유지.
- 제안서·CAD 미디어·결제 카드 등 풍부한 포털 데이터의 서버화는 **슬라이스 3에서** — 이번 범위 아님.
- 어드민 운영 전면 서버화(로컬 스토어 제거)는 **슬라이스 4에서** — 이번엔 이벤트 기록만.

## 5. 신뢰성 · 보안

- 메일 발송은 항상 커밋 후 + 실패 무해화(이벤트 기록은 유지, `[mailer]` 로그).
- 재시도 큐 없음(v1) — 실패 시 어드민 재클릭이 재발송.
- 인테이크 라우트는 공개이므로: rate limit + 페이로드 크기 제한(express json limit 기존값) +
  이메일 형식 검증. 이벤트 라우트는 admin 세션 필수.
- CSRF: 기존 origin 체크 미들웨어 경로에 포함.

## 6. 테스트

- 서버 vitest (`test:server`): ① `POST /v1/intakes` — 주문 생성 + sink에 `received` 메일 +
  로케일별 제목 검증 ② 멱등 재제출 — 메일 1회 ③ 이벤트 라우트 — stage 전이 + 메일 + 비관리자 401
  ④ 미지원 type 400 ⑤ `serverCode` 없는 로컬 폴백 경로는 프런트 vitest로 (apiFetch 모킹).
- 수동 검증: 로컬에서 `.env.beloved` + `PUBLIC_ORIGIN=http://localhost:5173`으로 실발송 1회.

## 구현 순서 (플랜 개요)

1. `submitIntake` `created` 플래그 + `orderMail.js` 템플릿 + 단위 테스트
2. `customerRoutes.js` (`POST /v1/intakes`) + 라우트 테스트
3. 어드민 이벤트 라우트 + 전이 매핑 + 테스트
4. 프런트: IntakeForm 서버 우선 제출 + 로컬 브리지(`serverCode`)
5. 프런트: `notifyOrderEvent` + AdminOpsOrder 훅 (병렬 세션 머지 후)
6. 프로덕션 검증: 실제 제출 → 메일 수신 → 어드민 이벤트 → 상태 메일 수신
