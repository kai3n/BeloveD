# 주문 이메일 알림 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인테이크 제출 확인 메일 + 주문 상태 이벤트 10종의 4개 언어 상태 메일 (스펙: `docs/superpowers/specs/2026-07-02-order-email-notifications-design.md`)

**Architecture:** 이미 구현된 `customerRepository.submitIntake`를 라우트(`POST /v1/intakes`)로 노출하고, 어드민 이벤트 라우트(`POST /v1/admin/orders/:orderCode/events`)가 `customer_timeline_events` 기록 + stage 전이 + 메일 발송을 담당. 메일은 항상 트랜잭션/응답 이후 fire-and-forget. 프런트는 서버 우선 제출 후 서버 코드로 로컬 데모 스토어에 브리지.

**Tech Stack:** Express(ESM)·pg·Resend(fetch)·vitest+supertest(서버, 실 Postgres `belovediamond_test`)·React+vitest(프런트)

## Global Constraints

- 코드 주석은 기존 컨벤션대로 한국어, "왜"만 설명
- 새 npm 의존성 금지 — 전부 기존 스택으로
- 서버 테스트는 로컬 Postgres 필요: `npm run test:server` (setup.js가 `belovediamond_test`에 마이그레이션 적용, `NODE_ENV=test` → 메일은 sink에 쌓이고 `drainMail()`로 검증)
- `src/lib/store.js`·`src/pages/admin/AdminOpsOrder.jsx`는 병렬 세션이 CAD 플로우 수정 중 — Task 6·7의 해당 파일 수정은 최소 diff로, 실행 시점 최신 코드에 그래프트
- 스키마 변경(마이그레이션) 금지 — 스펙 확정 사항
- 커밋 말미: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 이벤트 타입 문자열(전 구간 공유): `received` `proposal_sent` `deposit_confirmed` `diamond_locked` `cad_ready` `production_started` `qc_ready` `balance_requested` `shipped` `delivered`

---

### Task 1: ApiError 통합 + `submitIntake` 반환 확장

**Files:**
- Modify: `server/customerRepository.js:4-10` (자체 ApiError 정의 제거), `:273-341` (submitIntake)
- Test: `server/__tests__/customerRepository.test.js` (신규)
- Modify: `server/__tests__/helpers.js`

**Interfaces:**
- Produces: `submitIntake(intakeCode)` → `{ orderCode, stage, …orderSummaryView, created: boolean, notify: { email, locale } }`
- Produces: `truncateCustomerCore()` 테스트 헬퍼
- 주의: `server/adminRepository.js:1`이 `customerRepository`에서 ApiError를 import — re-export로 호환 유지

- [ ] **Step 1: 실패하는 테스트 작성**

`server/__tests__/customerRepository.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { ApiError as RepoApiError, createDraftIntake, submitIntake } from "../customerRepository.js";
import { ApiError } from "../errors.js";
import { truncateCustomerCore } from "./helpers.js";

beforeEach(async () => { await truncateCustomerCore(); });

describe("customerRepository", () => {
  it("ApiError는 errors.js와 동일 클래스다 (라우트 에러 핸들러 instanceof 계약)", () => {
    expect(RepoApiError).toBe(ApiError);
  });

  it("submitIntake는 created 플래그와 notify(email/locale)를 반환한다", async () => {
    const draft = await createDraftIntake({ email: "ko@test.com", name: "지원", locale: "ko", category: "ring" });
    const first = await submitIntake(draft.intakeId);
    expect(first.created).toBe(true);
    expect(first.notify).toEqual({ email: "ko@test.com", locale: "ko" });
    expect(first.orderCode).toMatch(/^BD-\d{6}$/);
    const again = await submitIntake(draft.intakeId); // 멱등 — 기존 주문 반환
    expect(again.created).toBe(false);
    expect(again.orderCode).toBe(first.orderCode);
  });
});
```

`server/__tests__/helpers.js`에 추가:

```js
export async function truncateCustomerCore() {
  await query(`truncate table customer_timeline_events, customer_actions, published_artifacts,
    customer_orders, customer_intakes, customers, idempotency_keys, audit_log
    restart identity cascade`);
}
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- customerRepository` → FAIL (`RepoApiError`가 별도 클래스, `created` undefined)

- [ ] **Step 3: 구현**

`server/customerRepository.js` 상단의 자체 `export class ApiError { … }` 블록(4-10행)을 삭제하고 교체:

```js
import { ApiError } from "./errors.js";
export { ApiError }; // adminRepository 등 기존 import 경로 호환
```

`submitIntake` 수정 — 두 반환 지점 모두 확장:

```js
    if (existing.rows[0]) {
      const c = (await client.query("select email, locale from customers where id = $1", [existing.rows[0].customer_id])).rows[0];
      return { ...orderSummaryView(existing.rows[0]), created: false, notify: { email: c.email, locale: c.locale } };
    }
```

말미 `return orderSummaryView(order);` →

```js
    return { ...orderSummaryView(order), created: true, notify: { email: customer.email, locale: customer.locale } };
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server` → 전부 PASS (기존 42 + 신규 2)

- [ ] **Step 5: Commit** — `git add server/customerRepository.js server/__tests__/customerRepository.test.js server/__tests__/helpers.js && git commit -m "refactor: unify ApiError; submitIntake returns created+notify"`

---

### Task 2: 주문 메일 템플릿 (10종 × 4개 언어)

**Files:**
- Modify: `server/mailer.js` (범용 발송 함수 추가)
- Create: `server/orderMail.js`
- Test: `server/__tests__/orderMail.test.js` (신규)

**Interfaces:**
- Produces: `sendOrderMail(to, subject, innerHtml, meta)` (mailer.js — wrap() 적용 후 deliver)
- Produces: `sendOrderEventMail({ email, locale, orderCode, type, data })` (orderMail.js) — 미지원 locale은 `en` 폴백, 미지원 type은 throw
- Consumes: mailer의 `drainMail()` (테스트 sink)

- [ ] **Step 1: 실패하는 테스트 작성**

`server/__tests__/orderMail.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { sendOrderEventMail, ORDER_MAIL } from "../orderMail.js";
import { drainMail } from "../mailer.js";

beforeEach(() => { drainMail(); });

describe("orderMail", () => {
  it("10종 이벤트 × 4개 언어 템플릿이 전부 존재한다", () => {
    const types = ["received", "proposal_sent", "deposit_confirmed", "diamond_locked", "cad_ready",
      "production_started", "qc_ready", "balance_requested", "shipped", "delivered"];
    for (const type of types) for (const loc of ["en", "ko", "zh", "es"]) {
      expect(ORDER_MAIL[type][loc].subject("BD-000001", {}), `${type}/${loc}`).toContain("BD-000001");
      expect(typeof ORDER_MAIL[type][loc].line("BD-000001", {})).toBe("string");
    }
  });

  it("저장된 로케일로 발송하고 포털 링크를 담는다", async () => {
    process.env.PUBLIC_ORIGIN = "https://belovediamond.com";
    await sendOrderEventMail({ email: "a@b.com", locale: "ko", orderCode: "BD-000007", type: "shipped", data: { tracking: "1Z999" } });
    const [msg] = drainMail();
    expect(msg.to).toBe("a@b.com");
    expect(msg.type).toBe("order_shipped");
    expect(msg.subject).toContain("발송");
    expect(msg.subject).toContain("BD-000007");
    delete process.env.PUBLIC_ORIGIN;
  });

  it("미지원 로케일은 en으로 폴백한다", async () => {
    await sendOrderEventMail({ email: "a@b.com", locale: "fr", orderCode: "BD-000008", type: "received", data: {} });
    expect(drainMail()[0].subject).toContain("We received");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- orderMail` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`server/mailer.js`에 추가 (sink 검증을 위해 dev 경로 meta에 subject 포함):

```js
// 주문 알림 등 임의 메일 — wrap 레이아웃 적용 후 발송. meta는 dev sink 검증용.
export async function sendOrderMail(to, subject, innerHtml, meta = {}) {
  return deliver(to, subject, wrap(innerHtml), { ...meta, subject });
}
```

`server/orderMail.js` 전체:

```js
// 주문 상태 메일 — 이벤트 10종 × 4개 언어. 언어는 제출 시 저장된 customers.locale.
// 발송은 항상 커밋/응답 후 fire-and-forget — 실패는 로그만 남긴다 (스펙 §5).
import { sendOrderMail } from "./mailer.js";

const CHROME = {
  en: { cta: "VIEW YOUR ORDER", tail: "Questions? Just reply to this email." },
  ko: { cta: "주문 확인하기", tail: "궁금한 점은 이 메일에 회신해 주세요." },
  zh: { cta: "查看订单", tail: "如有疑问，直接回复本邮件即可。" },
  es: { cta: "VER TU PEDIDO", tail: "¿Preguntas? Responde a este correo." },
};

export const ORDER_MAIL = {
  received: {
    en: { subject: (o) => `We received your request — ${o}`, line: () => "Your custom request is in. Our team is reviewing it and will follow up with a proposal shortly." },
    ko: { subject: (o) => `요청이 접수되었습니다 — ${o}`, line: () => "커스텀 요청이 접수되었습니다. 팀이 검토 후 곧 제안을 보내드릴게요." },
    zh: { subject: (o) => `我们已收到您的请求 — ${o}`, line: () => "您的定制请求已收到，团队审核后会尽快发送方案。" },
    es: { subject: (o) => `Recibimos tu solicitud — ${o}`, line: () => "Tu solicitud está registrada. Nuestro equipo la revisará y te enviará una propuesta pronto." },
  },
  proposal_sent: {
    en: { subject: (o) => `Your proposal is ready — ${o}`, line: () => "Your proposal and quote are ready in your portal. Review and confirm to move ahead." },
    ko: { subject: (o) => `제안서가 도착했습니다 — ${o}`, line: () => "제안과 견적이 포털에 준비되었습니다. 확인 후 진행을 승인해 주세요." },
    zh: { subject: (o) => `您的方案已就绪 — ${o}`, line: () => "方案与报价已在您的订单页面就绪，请查看并确认。" },
    es: { subject: (o) => `Tu propuesta está lista — ${o}`, line: () => "Tu propuesta y cotización están en tu portal. Revísalas y confirma para avanzar." },
  },
  deposit_confirmed: {
    en: { subject: (o) => `Deposit received — ${o}`, line: () => "We confirmed your deposit. Your stone is being secured and design work begins now." },
    ko: { subject: (o) => `입금이 확인되었습니다 — ${o}`, line: () => "디파짓 입금이 확인되었습니다. 스톤 확보와 디자인 작업이 시작됩니다." },
    zh: { subject: (o) => `已确认收到定金 — ${o}`, line: () => "定金已确认，我们将锁定钻石并开始设计。" },
    es: { subject: (o) => `Depósito recibido — ${o}`, line: () => "Confirmamos tu depósito. Aseguramos tu piedra y comienza el diseño." },
  },
  diamond_locked: {
    en: { subject: (o) => `Your diamond is secured — ${o}`, line: (o, d) => `Your certified stone${d.igi ? ` (IGI ${d.igi})` : ""} is secured for your order.` },
    ko: { subject: (o) => `다이아몬드가 확보되었습니다 — ${o}`, line: (o, d) => `주문하신 인증 다이아몬드${d.igi ? ` (IGI ${d.igi})` : ""}가 확보되었습니다.` },
    zh: { subject: (o) => `您的钻石已锁定 — ${o}`, line: (o, d) => `您的认证钻石${d.igi ? `（IGI ${d.igi}）` : ""}已为订单锁定。` },
    es: { subject: (o) => `Tu diamante está asegurado — ${o}`, line: (o, d) => `Tu piedra certificada${d.igi ? ` (IGI ${d.igi})` : ""} está asegurada para tu pedido.` },
  },
  cad_ready: {
    en: { subject: (o) => `Your design is ready for review — ${o}`, line: () => "The 3D design (CAD) of your piece is ready. Review it in your portal and approve or request changes." },
    ko: { subject: (o) => `디자인 승인을 기다립니다 — ${o}`, line: () => "3D 디자인(CAD)이 준비되었습니다. 포털에서 확인하고 승인하거나 수정을 요청해 주세요." },
    zh: { subject: (o) => `您的设计已就绪，待您确认 — ${o}`, line: () => "作品的 3D 设计（CAD）已完成，请在订单页面查看并确认或提出修改。" },
    es: { subject: (o) => `Tu diseño está listo para revisar — ${o}`, line: () => "El diseño 3D (CAD) de tu pieza está listo. Revísalo en tu portal y apruébalo o pide cambios." },
  },
  production_started: {
    en: { subject: (o) => `Crafting has begun — ${o}`, line: () => "Your piece is now in production. We'll share quality-check media when it's finished." },
    ko: { subject: (o) => `제작이 시작되었습니다 — ${o}`, line: () => "제작이 시작되었습니다. 완성되면 품질 확인 사진·영상을 보내드릴게요." },
    zh: { subject: (o) => `已开始制作 — ${o}`, line: () => "您的作品已进入制作阶段，完成后我们会发送质检照片与视频。" },
    es: { subject: (o) => `La fabricación ha comenzado — ${o}`, line: () => "Tu pieza está en producción. Compartiremos el material de control de calidad al terminar." },
  },
  qc_ready: {
    en: { subject: (o) => `Your finished piece is ready to view — ${o}`, line: () => "Your finished piece passed our checks. Review the final photos and video in your portal and confirm." },
    ko: { subject: (o) => `완성품이 준비되었습니다 — ${o}`, line: () => "완성품이 준비되었습니다. 포털에서 최종 사진·영상을 확인하고 컨펌해 주세요." },
    zh: { subject: (o) => `成品已就绪，请查看 — ${o}`, line: () => "您的成品已完成质检，请在订单页面查看最终照片与视频并确认。" },
    es: { subject: (o) => `Tu pieza terminada está lista — ${o}`, line: () => "Tu pieza terminada pasó nuestras revisiones. Mira las fotos y el video final en tu portal y confirma." },
  },
  balance_requested: {
    en: { subject: (o) => `Balance due — ${o}`, line: () => "Your piece passed final QC. Settle the remaining balance in your portal to start shipping." },
    ko: { subject: (o) => `잔금 안내 — ${o}`, line: () => "최종 확인이 끝났습니다. 포털에서 잔금을 결제해 주시면 배송을 시작합니다." },
    zh: { subject: (o) => `请支付尾款 — ${o}`, line: () => "成品已通过最终质检，请在订单页面支付尾款后我们将安排发货。" },
    es: { subject: (o) => `Saldo pendiente — ${o}`, line: () => "Tu pieza pasó el control final. Paga el saldo restante en tu portal para iniciar el envío." },
  },
  shipped: {
    en: { subject: (o) => `Your order is on its way — ${o}`, line: (o, d) => `Your piece has shipped${d.tracking ? ` — tracking ${d.tracking}` : ""}. Delivery is fully insured.` },
    ko: { subject: (o) => `발송되었습니다 — ${o}`, line: (o, d) => `주문하신 제품이 발송되었습니다${d.tracking ? ` — 운송장 ${d.tracking}` : ""}. 전 구간 보험이 적용됩니다.` },
    zh: { subject: (o) => `您的订单已发货 — ${o}`, line: (o, d) => `您的作品已发出${d.tracking ? `——运单号 ${d.tracking}` : ""}，全程保险。` },
    es: { subject: (o) => `Tu pedido está en camino — ${o}`, line: (o, d) => `Tu pieza fue enviada${d.tracking ? ` — guía ${d.tracking}` : ""}. El envío está totalmente asegurado.` },
  },
  delivered: {
    en: { subject: (o) => `Delivered — enjoy your piece — ${o}`, line: () => "Your order shows as delivered. We'd love to see it on you — leave a review anytime." },
    ko: { subject: (o) => `배송이 완료되었습니다 — ${o}`, line: () => "배송이 완료되었습니다. 착용샷과 함께 리뷰를 남겨주시면 큰 힘이 됩니다." },
    zh: { subject: (o) => `已送达，愿您喜欢 — ${o}`, line: () => "您的订单已送达。欢迎随时留下评价与佩戴照片。" },
    es: { subject: (o) => `Entregado — disfruta tu pieza — ${o}`, line: () => "Tu pedido figura como entregado. Nos encantaría verlo puesto: deja una reseña cuando quieras." },
  },
};

export async function sendOrderEventMail({ email, locale, orderCode, type, data = {} }) {
  const pack = ORDER_MAIL[type];
  if (!pack) throw new Error(`unknown order mail type: ${type}`);
  const loc = pack[locale] ? locale : "en";
  const t = pack[loc];
  const chrome = CHROME[loc];
  const origin = process.env.PUBLIC_ORIGIN || "http://127.0.0.1:8787";
  const link = `${origin}/track/${orderCode}`;
  const inner = `
    <p style="font-size:15px;line-height:1.6">${t.line(orderCode, data)}</p>
    <p style="font-size:13px;color:#8e897e;margin:6px 0 0">Order ${orderCode}</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#16130f;color:#f8f7f5;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">${chrome.cta}</a></p>
    <p style="font-size:13px;color:#8e897e">${chrome.tail}</p>`;
  return sendOrderMail(email, t.subject(orderCode, data), inner, { type: `order_${type}`, orderCode });
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server -- orderMail` → PASS (3 tests)

- [ ] **Step 5: Commit** — `git add server/mailer.js server/orderMail.js server/__tests__/orderMail.test.js && git commit -m "feat: order status mail templates — 10 events x 4 locales"`

---

### Task 3: `recordOrderEvent` — 타임라인 기록 + stage 전이

**Files:**
- Modify: `server/customerRepository.js` (말미에 추가)
- Test: `server/__tests__/customerRepository.test.js` (추가)

**Interfaces:**
- Produces: `EVENT_TRANSITIONS` — `{ [type]: { stage, phase, waitingOn } }` (received 포함, 라우트에서 received는 거부)
- Produces: `recordOrderEvent(orderCode, type, data)` → `{ orderCode, stage, eventId, notify: { email, locale } }`; 미존재 주문 `ApiError("NOT_FOUND", 404)`, 미지원 type `ApiError("VALIDATION_ERROR", 400)`

- [ ] **Step 1: 실패하는 테스트 추가** (`customerRepository.test.js`에)

```js
import { recordOrderEvent, EVENT_TRANSITIONS } from "../customerRepository.js";
import { query } from "../db.js";

describe("recordOrderEvent", () => {
  async function makeOrder() {
    const draft = await createDraftIntake({ email: "ev@test.com", locale: "zh", category: "ring" });
    return submitIntake(draft.intakeId);
  }

  it("타임라인 기록 + stage/phase/waiting_on 전이 + notify 반환", async () => {
    const order = await makeOrder();
    const r = await recordOrderEvent(order.orderCode, "shipped", { tracking: "1Z999" });
    expect(r.stage).toBe("SHIPPING");
    expect(r.notify).toEqual({ email: "ev@test.com", locale: "zh" });
    expect(r.eventId).toMatch(/^TL-\d{6}$/);
    const row = (await query("select stage, phase, waiting_on from customer_orders where order_code = $1", [order.orderCode])).rows[0];
    expect(row).toEqual({ stage: "SHIPPING", phase: "DELIVERY", waiting_on: "EXTERNAL" });
    const tl = (await query("select payload from customer_timeline_events order by id desc limit 1")).rows[0];
    expect(tl.payload).toEqual({ type: "shipped", data: { tracking: "1Z999" } });
  });

  it("없는 주문은 404, 미지원 type은 400", async () => {
    await expect(recordOrderEvent("BD-999999", "shipped", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    const order = await makeOrder();
    await expect(recordOrderEvent(order.orderCode, "nope", {})).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- customerRepository` → FAIL (export 없음)

- [ ] **Step 3: 구현** (`customerRepository.js` 말미)

```js
// 주문 상태 이벤트 — 스펙 §2 전이 표. received는 인테이크 제출이 자동 기록(라우트는 거부).
export const EVENT_TRANSITIONS = {
  received: { stage: "OPS_REVIEW", phase: "DEFINE", waitingOn: "BELOVEDIAMOND" },
  proposal_sent: { stage: "QUOTE", phase: "DEFINE", waitingOn: "CUSTOMER" },
  deposit_confirmed: { stage: "CAD", phase: "APPROVE_DESIGN", waitingOn: "BELOVEDIAMOND" },
  diamond_locked: { stage: "CAD", phase: "APPROVE_DESIGN", waitingOn: "BELOVEDIAMOND" },
  cad_ready: { stage: "CAD", phase: "APPROVE_DESIGN", waitingOn: "CUSTOMER" },
  production_started: { stage: "PRODUCTION", phase: "MAKING", waitingOn: "BELOVEDIAMOND" },
  qc_ready: { stage: "FINAL_QC", phase: "MAKING", waitingOn: "CUSTOMER" },
  balance_requested: { stage: "BALANCE", phase: "DELIVERY", waitingOn: "CUSTOMER" },
  shipped: { stage: "SHIPPING", phase: "DELIVERY", waitingOn: "EXTERNAL" },
  delivered: { stage: "DELIVERED", phase: "CLOSED", waitingOn: "NONE" },
};

export async function recordOrderEvent(orderCode, type, data = {}) {
  const transition = EVENT_TRANSITIONS[type];
  if (!transition) throw new ApiError("VALIDATION_ERROR", 400, `unknown event type: ${type}`);
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `select o.*, c.email, c.locale from customer_orders o
       join customers c on c.id = o.customer_id
       where o.order_code = $1 for update of o`,
      [orderCode],
    );
    const order = rows[0];
    if (!order) throw new ApiError("NOT_FOUND", 404);
    const eventCode = await nextCode(client, "TL");
    await client.query(
      `insert into customer_timeline_events (event_code, order_id, title, body, payload)
       values ($1, $2, $3, $4, $5)`,
      [eventCode, order.id, type, null, { type, data }],
    );
    await client.query(
      `update customer_orders set stage = $2, phase = $3, waiting_on = $4, updated_at = now()
       where id = $1`,
      [order.id, transition.stage, transition.phase, transition.waitingOn],
    );
    await client.query(
      `insert into audit_log (actor_type, actor_ref, entity_type, entity_ref, action, before_json, after_json)
       values ('admin', null, 'order', $1, $2, $3, $4)`,
      [orderCode, `event:${type}`, { stage: order.stage }, { stage: transition.stage, data }],
    );
    return { orderCode, stage: transition.stage, eventId: eventCode, notify: { email: order.email, locale: order.locale } };
  });
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server` → 전부 PASS

- [ ] **Step 5: Commit** — `git add server/customerRepository.js server/__tests__/customerRepository.test.js && git commit -m "feat: recordOrderEvent — timeline log + stage transition"`

---

### Task 4: `POST /v1/intakes` 라우트 (멱등 + 커밋 후 확인 메일)

**Files:**
- Create: `server/customerRoutes.js`
- Modify: `server/app.js:33-34` (마운트)
- Test: `server/__tests__/customerRoutes.test.js` (신규)

**Interfaces:**
- Produces: `POST /v1/intakes` — body는 인테이크 페이로드(`email`/`contactEmail`, `locale` 포함), 선택 `Idempotency-Key` 헤더. 응답 `201 { ok, orderCode, stage }`. IP당 분당 5회.
- Consumes: Task 1 `submitIntake`, Task 2 `sendOrderEventMail`, 기존 `requestHash`

- [ ] **Step 1: 실패하는 테스트 작성**

`server/__tests__/customerRoutes.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { truncateCustomerCore } from "./helpers.js";
import { drainMail } from "../mailer.js";
import { __resetRateLimit } from "../rateLimit.js";

const app = createApp();
const intakeBody = { email: "new@test.com", name: "Jiwon", locale: "ko", category: "ring", termsAccepted: true };

beforeEach(async () => { await truncateCustomerCore(); __resetRateLimit(); drainMail(); });

describe("POST /v1/intakes", () => {
  it("주문 생성 + 로케일 확인 메일 1통", async () => {
    const res = await request(app).post("/v1/intakes").send(intakeBody);
    expect(res.status).toBe(201);
    expect(res.body.orderCode).toMatch(/^BD-\d{6}$/);
    expect(res.body.stage).toBe("OPS_REVIEW");
    const mails = drainMail();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("new@test.com");
    expect(mails[0].type).toBe("order_received");
    expect(mails[0].subject).toContain("접수");
  });

  it("같은 Idempotency-Key 재요청은 같은 주문·메일 1통", async () => {
    const key = "test-key-1";
    const a = await request(app).post("/v1/intakes").set("Idempotency-Key", key).send(intakeBody);
    const b = await request(app).post("/v1/intakes").set("Idempotency-Key", key).send(intakeBody);
    expect(b.status).toBe(201);
    expect(b.body.orderCode).toBe(a.body.orderCode);
    expect(drainMail()).toHaveLength(1);
    const c = await request(app).post("/v1/intakes").set("Idempotency-Key", key).send({ ...intakeBody, name: "다른값" });
    expect(c.status).toBe(409);
    expect(c.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("이메일 없으면 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/v1/intakes").send({ name: "NoMail" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- customerRoutes` → FAIL (404 NOT_FOUND — 라우트 없음)

- [ ] **Step 3: 구현**

`server/customerRoutes.js`:

```js
import { Router } from "express";
import { ApiError } from "./errors.js";
import { rateLimit } from "./rateLimit.js";
import { query } from "./db.js";
import { createDraftIntake, submitIntake, requestHash } from "./customerRepository.js";
import { sendOrderEventMail } from "./orderMail.js";

const MINUTE = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 메일은 응답 이후 fire-and-forget — 발송 실패가 제출/이벤트를 실패시키지 않는다 (스펙 §5)
function fireMail(promise, label) {
  promise.catch((e) => console.error(`[orderMail] ${label}: ${e.message}`));
}

export function customerRouter() {
  const r = Router();

  // 인테이크 제출 — draft 생성+제출 원샷. 더블클릭/재시도는 Idempotency-Key로 흡수.
  r.post("/intakes",
    rateLimit({ limit: 5, windowMs: MINUTE }),
    async (req, res, next) => {
      try {
        const payload = req.body || {};
        const email = String(payload.contactEmail || payload.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) throw new ApiError("VALIDATION_ERROR", 400, "contact email required");
        const idemKey = req.get("Idempotency-Key") || null;
        if (idemKey) {
          const { rows } = await query(
            "select request_hash, status_code, response_json from idempotency_keys where route = $1 and idempotency_key = $2",
            ["/v1/intakes", idemKey],
          );
          if (rows[0]) {
            if (rows[0].request_hash !== requestHash(payload)) throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
            return res.status(rows[0].status_code).json(rows[0].response_json); // 재생 — 메일 재발송 없음
          }
        }
        const draft = await createDraftIntake(payload);
        const result = await submitIntake(draft.intakeId);
        const body = { ok: true, orderCode: result.orderCode, stage: result.stage };
        if (idemKey) {
          await query(
            `insert into idempotency_keys (route, idempotency_key, request_hash, status_code, response_json)
             values ($1, $2, $3, 201, $4) on conflict do nothing`,
            ["/v1/intakes", idemKey, requestHash(payload), body],
          );
        }
        res.status(201).json(body);
        if (result.created && result.notify?.email) {
          fireMail(sendOrderEventMail({ ...result.notify, orderCode: result.orderCode, type: "received" }), "received");
        }
      } catch (e) { next(e); }
    });

  return r;
}
```

`server/app.js` — import 추가 후 34행 아래에 마운트:

```js
import { customerRouter } from "./customerRoutes.js";
// …
app.use("/v1", customerRouter());
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server` → 전부 PASS

- [ ] **Step 5: Commit** — `git add server/customerRoutes.js server/app.js server/__tests__/customerRoutes.test.js && git commit -m "feat: POST /v1/intakes — server intake + confirmation email"`

---

### Task 5: 어드민 이벤트 라우트

**Files:**
- Modify: `server/customerRoutes.js` (라우트 추가)
- Test: `server/__tests__/customerRoutes.test.js` (추가)

**Interfaces:**
- Produces: `POST /v1/admin/orders/:orderCode/events` — `requireAdmin`, body `{ type, data? }`, 응답 `201 { ok, orderCode, stage, eventId }`. 분당 30회.
- Consumes: Task 3 `recordOrderEvent`·`EVENT_TRANSITIONS`, Task 2 `sendOrderEventMail`

- [ ] **Step 1: 실패하는 테스트 추가** (`customerRoutes.test.js`에 — 어드민 로그인은 authRoutes.test.js 패턴)

```js
import { query } from "../db.js";
import { hashPassword } from "../passwords.js";

async function adminAgent() {
  await query("insert into admin_users (email, name, password_hash) values ($1,$2,$3) on conflict (email) do nothing",
    ["ops@test.com", "Ops", hashPassword("admin12345")]);
  const agent = request.agent(app);
  const login = await agent.post("/v1/auth/password").send({ email: "ops@test.com", password: "admin12345" });
  expect(login.status).toBe(200);
  return agent;
}

describe("POST /v1/admin/orders/:orderCode/events", () => {
  it("어드민 세션 없으면 401", async () => {
    const res = await request(app).post("/v1/admin/orders/BD-000001/events").send({ type: "shipped" });
    expect(res.status).toBe(401);
  });

  it("이벤트 기록 + stage 전이 + 상태 메일", async () => {
    const intake = await request(app).post("/v1/intakes").send(intakeBody);
    drainMail(); // 접수 메일 비우기
    const agent = await adminAgent();
    const res = await agent.post(`/v1/admin/orders/${intake.body.orderCode}/events`)
      .send({ type: "shipped", data: { tracking: "1Z999" } });
    expect(res.status).toBe(201);
    expect(res.body.stage).toBe("SHIPPING");
    const mails = drainMail();
    expect(mails).toHaveLength(1);
    expect(mails[0].type).toBe("order_shipped");
    expect(mails[0].subject).toContain("발송"); // intakeBody locale=ko
  });

  it("received·미지원 type은 400", async () => {
    const agent = await adminAgent();
    for (const type of ["received", "bogus"]) {
      const res = await agent.post("/v1/admin/orders/BD-000001/events").send({ type });
      expect(res.status).toBe(400);
    }
  });
});
```

주의: `truncateCustomerCore`는 `admin_users`를 지우지 않지만 `truncateAuth`류가 sessions를 지울 수 있음 — 이 테스트 파일은 `truncateCustomerCore`만 쓰므로 세션 유지됨. `adminAgent()`를 각 it 안에서 호출해 순서 독립 보장.

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- customerRoutes` → FAIL (404)

- [ ] **Step 3: 구현** (`customerRoutes.js`에 추가 — import에 `requireAdmin`, `recordOrderEvent`, `EVENT_TRANSITIONS` 보강)

```js
import { requireAdmin } from "./middleware.js";
import { recordOrderEvent, EVENT_TRANSITIONS } from "./customerRepository.js";

  // 주문 상태 이벤트 — 어드민 전용. 같은 타입 재호출 허용(재발송 = 어드민 의도, 스펙 §2).
  r.post("/admin/orders/:orderCode/events",
    rateLimit({ limit: 30, windowMs: MINUTE }),
    requireAdmin,
    async (req, res, next) => {
      try {
        const { type, data } = req.body || {};
        if (!EVENT_TRANSITIONS[type] || type === "received") {
          throw new ApiError("VALIDATION_ERROR", 400, "unknown event type");
        }
        const result = await recordOrderEvent(req.params.orderCode, type, data || {});
        res.status(201).json({ ok: true, orderCode: result.orderCode, stage: result.stage, eventId: result.eventId });
        if (result.notify?.email) {
          fireMail(sendOrderEventMail({ ...result.notify, orderCode: result.orderCode, type, data: data || {} }), type);
        }
      } catch (e) { next(e); }
    });
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server` → 전부 PASS

- [ ] **Step 5: Commit** — `git add server/customerRoutes.js server/__tests__/customerRoutes.test.js && git commit -m "feat: admin order event route — stage transition + status email"`

---

### Task 6: 프런트 — 서버 우선 제출 + 로컬 브리지

**Files:**
- Modify: `src/lib/api.js` (말미에 추가)
- Create: `src/lib/ownedOrders.js`
- Modify: `src/lib/store.js:706` (createIntake — opts 파라미터, 최소 diff ⚠️병렬 세션)
- Modify: `src/pages/IntakeForm.jsx:239-260` (submit)
- Modify: `src/pages/ClientPortal.jsx:793` 근처 (code 폴백)
- Modify: `src/platformStrings.js` (4개 언어 intake 섹션에 `submitError` 추가)
- Test: `src/lib/__tests__/intakeServer.test.js` (신규)

**Interfaces:**
- Produces: `submitIntakeToServer(payload)` → `{ orderCode, stage }` (서버 부재 시 `ApiUnavailableError` 전파); `notifyOrderEvent(orderCode, type, data)` → 실패 무해화(null)
- Produces: `rememberOwnedOrder(orderCode, queryCode)` / `ownedOrderCode(orderCode)` (localStorage `beloved-owned-orders`)
- Produces: `createIntake(form, customerId, opts)` — `opts.orderId`로 주문 id 오버라이드, `opts.serverCode` 저장

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/intakeServer.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitIntakeToServer, notifyOrderEvent } from "../api.js";

const okJson = (body) => ({ ok: true, status: 201, json: async () => body });

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("submitIntakeToServer", () => {
  it("Idempotency-Key를 붙여 POST /v1/intakes 호출", async () => {
    fetch.mockResolvedValueOnce(okJson({ ok: true, orderCode: "BD-100001", stage: "OPS_REVIEW" }));
    const r = await submitIntakeToServer({ email: "a@b.com", locale: "ko" });
    expect(r.orderCode).toBe("BD-100001");
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/v1/intakes");
    expect(opts.headers["Idempotency-Key"]).toMatch(/[0-9a-f-]{36}/);
  });
});

describe("notifyOrderEvent", () => {
  it("실패해도 throw하지 않는다 (fire-and-forget)", async () => {
    fetch.mockRejectedValueOnce(new TypeError("network down"));
    await expect(notifyOrderEvent("BD-1", "shipped")).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test -- intakeServer` → FAIL (export 없음)

- [ ] **Step 3: 구현**

`src/lib/api.js` 말미에 추가 (apiFetch가 커스텀 헤더를 못 받으므로 headers 옵션 확장):

```js
// 인테이크 서버 제출 — 시도당 1회 생성한 Idempotency-Key로 더블클릭/재시도 흡수
export async function submitIntakeToServer(payload, idemKey = crypto.randomUUID()) {
  return apiFetch("/intakes", { method: "POST", body: payload, headers: { "Idempotency-Key": idemKey } });
}

// 주문 상태 이벤트 알림 — 어드민 UI에서 fire-and-forget (실패는 경고만)
export function notifyOrderEvent(orderCode, type, data = {}) {
  return apiFetch(`/admin/orders/${orderCode}/events`, { method: "POST", body: { type, data } })
    .catch((e) => { console.warn(`[notify] ${type} ${orderCode}: ${e.message}`); return null; });
}
```

`apiFetch` 시그니처 확장 (`api.js:11`) — `{ method = "GET", body, headers }`로 받고:

```js
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
```

`src/lib/ownedOrders.js` 전체:

```js
// 이 브라우저에서 제출한 주문 — 메일 링크(/track/BD-xxxxxx, code 없음)를 제출 기기에서 열 수 있게 한다 (스펙 §4)
const KEY = "beloved-owned-orders";

export function rememberOwnedOrder(orderCode, queryCode) {
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || "{}");
    map[orderCode] = queryCode;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* storage 불가 환경 무시 */ }
}

export function ownedOrderCode(orderCode) {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}")[orderCode] || null; } catch { return null; }
}
```

`src/lib/store.js:706` — 최소 diff:

```js
export function createIntake(form, customerId = null, opts = {}) {
  const intakeId = nextSeqId("IN");
  const orderId = opts.orderId || nextOrderId();
```

주문 객체(725행 근처)에 한 줄:

```js
    ...(opts.serverCode ? { serverCode: opts.serverCode } : {}),
```

`src/pages/IntakeForm.jsx` submit 교체 (import: `submitIntakeToServer`·`ApiUnavailableError`는 `../lib/api.js`, `rememberOwnedOrder`는 `../lib/ownedOrders.js`; `useLocale()`에서 `locale` 구조분해 추가):

```js
  async function submit() {
    const contactDetails = submissionContact(form, user);
    if (!conditionalComplete(form.category, form.conditional)) {
      setStepError(`${t.requiredError} — ${g.sizeFit}`);
      document.getElementById("gflow-size-fit")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!hasContactDetails(contactDetails)) {
      setStepError(t.requiredError);
      setScreen("contact");
      return;
    }
    if (!form.termsAccepted) {
      setStepError(t.requiredError);
      return;
    }
    const payload = buildIntakePayload(form, refs, user);
    // 서버 우선 — 성공 시 서버 주문코드로 로컬 브리지, 서버 부재(정적 데모)만 로컬 폴백
    let serverOrder = null;
    try {
      serverOrder = await submitIntakeToServer({ ...payload, locale });
    } catch (e) {
      if (!(e instanceof ApiUnavailableError)) { setStepError(t.submitError); return; }
    }
    const { order } = createIntake(payload, user?.id || null,
      serverOrder ? { orderId: serverOrder.orderCode, serverCode: serverOrder.orderCode } : {});
    if (serverOrder) rememberOwnedOrder(order.id, order.queryCode);
    window.localStorage.removeItem(DRAFT_KEY);
    setDone(order);
  }
```

`src/platformStrings.js` — 4개 언어 intake 문자열 블록(`requiredError`가 있는 곳 옆)에 추가:

- en: `submitError: "We couldn't submit your request. Please try again in a moment.",`
- ko: `submitError: "요청 제출에 실패했습니다. 잠시 후 다시 시도해주세요.",`
- zh: `submitError: "提交失败，请稍后重试。",`
- es: `submitError: "No pudimos enviar tu solicitud. Inténtalo de nuevo en un momento.",`

`src/pages/ClientPortal.jsx:793` — code 폴백 (import `ownedOrderCode`):

```js
  const view = portalView(orderId, { customerId: user?.id, userRole: user?.role, queryCode: code || ownedOrderCode(orderId) });
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test` → 전부 PASS (병렬 세션 WIP로 이미 깨져 있는 autoFlow/opsStore 5건 제외 — 그 5건이 그대로인지만 확인, 늘면 안 됨)

- [ ] **Step 5: 수동 확인** — `npm run api` + `npm run dev` 띄우고 인테이크 제출 → 터미널에 `[mailer] order_received → …` 로그, 주문번호가 `BD-`로 시작, `/track/BD-xxxxxx` (code 없이) 접속되는지 확인

- [ ] **Step 6: Commit** — `git add src/lib/api.js src/lib/ownedOrders.js src/lib/store.js src/pages/IntakeForm.jsx src/pages/ClientPortal.jsx src/platformStrings.js src/lib/__tests__/intakeServer.test.js && git commit -m "feat: server-first intake submit with local bridge + owned-order portal access"`

---

### Task 7: 타 기기 포털 폴백 — OTP 로그인 후 서버 타임라인 (스펙 §4)

**Files:**
- Modify: `server/customerRoutes.js` (GET 라우트 추가)
- Modify: `src/pages/ClientPortal.jsx:794` `!view` 분기 (서버 폴백 컴포넌트)
- Test: `server/__tests__/customerRoutes.test.js` (추가)

**Interfaces:**
- Produces: `GET /v1/orders/:orderCode` — `requireCustomer` 세션, 본인 주문만 (`getCustomerOrder` 재사용 → `{ orderCode, stage, phases, timeline, … }`), 타인 주문 403
- Consumes: 기존 OTP 로그인(`/v1/auth/code` + `/verify`), Task 3의 타임라인 payload(`{ type, data }`)

- [ ] **Step 1: 실패하는 테스트 추가** (`customerRoutes.test.js`)

```js
describe("GET /v1/orders/:orderCode", () => {
  it("OTP 세션 고객 본인 주문의 타임라인 반환, 타인 주문은 403", async () => {
    const created = await request(app).post("/v1/intakes").send(intakeBody); // new@test.com
    const agent = request.agent(app);
    const codeRes = await agent.post("/v1/auth/code").send({ email: "new@test.com" });
    await agent.post("/v1/auth/code/verify").send({ email: "new@test.com", code: codeRes.body.devCode });
    const res = await agent.get(`/v1/orders/${created.body.orderCode}`);
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe("OPS_REVIEW");
    expect(res.body.timeline.length).toBeGreaterThan(0);
    const other = await request(app).post("/v1/intakes").send({ ...intakeBody, email: "other@test.com" });
    const denied = await agent.get(`/v1/orders/${other.body.orderCode}`);
    expect(denied.status).toBe(403);
  });

  it("비로그인은 401", async () => {
    const res = await request(app).get("/v1/orders/BD-000001");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:server -- customerRoutes` → FAIL (404)

- [ ] **Step 3: 서버 구현** (`customerRoutes.js` — import에 `requireCustomer`·`getCustomerOrder` 보강)

```js
  // 타 기기 포털 폴백 — OTP 로그인한 고객 본인 주문의 상태 타임라인 (스펙 §4)
  r.get("/orders/:orderCode",
    rateLimit({ limit: 30, windowMs: MINUTE }),
    requireCustomer,
    async (req, res, next) => {
      try {
        const { rows } = await query("select email from customers where id = $1", [req.principal.id]);
        if (!rows[0]) throw new ApiError("CUSTOMER_AUTH_REQUIRED", 401);
        res.json(await getCustomerOrder(req.params.orderCode, rows[0].email));
      } catch (e) { next(e); }
    });
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:server` → 전부 PASS

- [ ] **Step 5: 프런트 폴백 컴포넌트** — `ClientPortal.jsx`의 `!view` 분기 최상단에 (imports: `apiFetch`는 이미 있음 확인, `useEffect`):

```jsx
  if (!view && /^BD-/.test(orderId)) return <ServerOrderStatus orderCode={orderId} />;
```

같은 파일에 컴포넌트 추가 (문자열은 컴포넌트-로컬 — 기존 포털 로컬 문자열 구조를 건드리지 않는다):

```jsx
// 서버 폴백 — 이 브라우저에 로컬 데이터가 없는 BD- 주문 (메일 링크를 타 기기에서 연 경우, 스펙 §4)
const SERVER_STATUS_STRINGS = {
  en: { title: "Order status", signIn: "Sign in with your email code to view this order.", signInBtn: "Sign in", loading: "Loading…", updated: "Updated" },
  ko: { title: "주문 현황", signIn: "이메일 인증번호로 로그인하면 주문을 확인할 수 있어요.", signInBtn: "로그인", loading: "불러오는 중…", updated: "업데이트" },
  zh: { title: "订单状态", signIn: "使用邮箱验证码登录即可查看此订单。", signInBtn: "登录", loading: "加载中…", updated: "更新" },
  es: { title: "Estado del pedido", signIn: "Inicia sesión con tu código de correo para ver este pedido.", signInBtn: "Iniciar sesión", loading: "Cargando…", updated: "Actualizado" },
};
const SERVER_EVENT_LABELS = {
  en: { received: "Request received", proposal_sent: "Proposal sent", deposit_confirmed: "Deposit confirmed", diamond_locked: "Diamond secured", cad_ready: "Design ready for review", production_started: "Crafting started", qc_ready: "Finished piece ready", balance_requested: "Balance requested", shipped: "Shipped", delivered: "Delivered" },
  ko: { received: "요청 접수", proposal_sent: "제안 발송", deposit_confirmed: "입금 확인", diamond_locked: "다이아 확보", cad_ready: "디자인 확인 요청", production_started: "제작 시작", qc_ready: "완성품 확인 요청", balance_requested: "잔금 안내", shipped: "발송", delivered: "배송 완료" },
  zh: { received: "已收到请求", proposal_sent: "方案已发送", deposit_confirmed: "定金已确认", diamond_locked: "钻石已锁定", cad_ready: "设计待确认", production_started: "开始制作", qc_ready: "成品待确认", balance_requested: "请支付尾款", shipped: "已发货", delivered: "已送达" },
  es: { received: "Solicitud recibida", proposal_sent: "Propuesta enviada", deposit_confirmed: "Depósito confirmado", diamond_locked: "Diamante asegurado", cad_ready: "Diseño listo para revisar", production_started: "Fabricación iniciada", qc_ready: "Pieza terminada lista", balance_requested: "Saldo pendiente", shipped: "Enviado", delivered: "Entregado" },
};

function ServerOrderStatus({ orderCode }) {
  const { locale } = useLocale();
  const s = SERVER_STATUS_STRINGS[locale] || SERVER_STATUS_STRINGS.en;
  const labels = SERVER_EVENT_LABELS[locale] || SERVER_EVENT_LABELS.en;
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, order: null, needAuth: false });
  const location = useLocation();
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/orders/${orderCode}`)
      .then((order) => { if (!cancelled) setState({ loading: false, order, needAuth: false }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, order: null, needAuth: true }); });
    return () => { cancelled = true; };
  }, [orderCode, user?.id]);

  if (state.loading) return <div className="page page-narrow"><p className="page-sub">{s.loading}</p></div>;
  if (!state.order) {
    return (
      <div className="page page-narrow">
        <h1 className="page-title">{s.title}</h1>
        <div className="panel form-stack">
          <p className="page-sub">{s.signIn}</p>
          <Link className="button primary" to="/sign-in" state={{ from: location.pathname }}>{s.signInBtn}</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="page page-narrow">
      <h1 className="page-title">{s.title}</h1>
      <p className="page-sub">{state.order.orderCode}</p>
      <div className="panel form-stack">
        {state.order.timeline.map((ev) => (
          <div key={ev.id} className="form-stack" style={{ gap: 2 }}>
            <strong>{labels[ev.payload?.type] || ev.title}</strong>
            <small style={{ color: "var(--quiet)" }}>{new Date(ev.createdAt).toLocaleDateString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

주의: `useLocation`·`Link`·`useEffect` import가 ClientPortal.jsx에 이미 있는지 확인하고 없으면 추가.

- [ ] **Step 6: 수동 확인** — 시크릿 창(로컬 데이터 없음)에서 `http://localhost:5173/track/BD-xxxxxx` → 로그인 안내 → OTP 로그인 → 타임라인 표시

- [ ] **Step 7: Commit** — `git add server/customerRoutes.js src/pages/ClientPortal.jsx server/__tests__/customerRoutes.test.js && git commit -m "feat: cross-device order status via OTP + server timeline"`

---

### Task 8: 어드민 UI 이벤트 훅 (⚠️ 병렬 세션 머지 후 실행)

**Files:**
- Modify: `src/pages/admin/AdminOpsOrder.jsx` (액션 핸들러 9곳 + 헤더 배지)

**Interfaces:**
- Consumes: Task 6 `notifyOrderEvent(orderCode, type, data)`
- 전제: 이 태스크는 병렬 세션의 CAD 플로우 작업이 머지된 **최신** AdminOpsOrder.jsx 위에서 실행한다. 핸들러 이름이 아래와 다르면 같은 의미의 액션에 그래프트.

- [ ] **Step 1: 훅 매핑 확정** — 실행 시점의 AdminOpsOrder.jsx에서 다음 액션을 grep으로 찾는다 (`markDepositReceived`, `sendQuote`/`publishProposal`, `lockDiamond`/`markStockConfirmed`, `publishCad`/CAD 발행, `PRODUCTION` 전환, QC/최종 컨펌 발행, `requestBalance`/`markBalanceReceived`, `markShipped`, `markDelivered`):

| UI 액션 (로컬 스토어 호출) | 이벤트 type | data |
|---|---|---|
| 제안/견적 발송 | `proposal_sent` | `{}` |
| 디파짓 입금 확인 | `deposit_confirmed` | `{}` |
| 다이아 락 확정 | `diamond_locked` | `{ igi }` (있으면) |
| CAD 고객 공개 | `cad_ready` | `{}` |
| 제작 시작 전환 | `production_started` | `{}` |
| 완성품 컨펌 발행 | `qc_ready` | `{}` |
| 잔금 요청 | `balance_requested` | `{}` |
| 발송 처리 | `shipped` | `{ tracking }` (있으면) |
| 배송 완료 | `delivered` | `{}` |

- [ ] **Step 2: 훅 삽입** — 각 핸들러의 로컬 스토어 호출 직후 한 줄 (exemplar — 디파짓):

```js
import { notifyOrderEvent } from "../../lib/api.js";
// …기존 핸들러 안, 로컬 스토어 호출 직후:
if (order.serverCode) notifyOrderEvent(order.serverCode, "deposit_confirmed");
```

- [ ] **Step 3: 미연동 배지** — 주문 헤더(주문번호 옆)에:

```jsx
{!order.serverCode && <span className="status-badge mst-pending" title="Server-linked email updates unavailable for this order">no-email</span>}
```

- [ ] **Step 4: 수동 확인** — `npm run api`+`npm run dev`, Task 6에서 만든 `BD-` 주문을 어드민에서 열어 디파짓 확인 클릭 → 터미널 `[mailer] order_deposit_confirmed → …` 로그. 구주문(DM-)은 배지 표시 + 네트워크 호출 없음(DevTools 확인).

- [ ] **Step 5: Commit** — `git add src/pages/admin/AdminOpsOrder.jsx && git commit -m "feat: admin action hooks fire order status emails"`

---

### Task 9: 실발송·프로덕션 검증

- [ ] **Step 1: 로컬 실발송 1회** — `set -a; source .env.beloved; set +a; PUBLIC_ORIGIN=http://localhost:5173 npm run api` + `npm run dev` → 본인 이메일로 인테이크 제출 → 접수 메일 실수신 확인 (제목 로케일, 포털 버튼 링크)
- [ ] **Step 2: 배포** — `vercel deploy --prod` (사용자 확인 후)
- [ ] **Step 3: 프로덕션 E2E** — belovediamond.com에서 실제 제출 → 접수 메일 수신 → `/gate-7f3k9x` 로그인 → 해당 주문에 이벤트 1건(예: proposal_sent) → 상태 메일 수신 → 메일의 포털 링크가 제출 브라우저에서 열리는지 확인
- [ ] **Step 4: 메모리 갱신** — `backend-migration-status.md`에 슬라이스 2 완료 기록
