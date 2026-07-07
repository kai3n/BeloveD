# 인테이크 쿠폰 코드 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위저드 review에 쿠폰 입력 박스를 만들어 예상 견적에 즉시 할인 반영하고, 코드 3종(BD-ATCOST 마진0 / BD-PRIVATE 15% / WELCOME5 5%)을 페이로드→어드민→포털→로컬 견적까지 흘려보낸다.

**Architecture:** 신규 순수 모듈 `src/lib/coupons.js`(카탈로그+정규화+적용 수식)를 단일 진실로 두고, `quoteEstimate`(추정)·`store.createQuote`(로컬 견적)·`buildIntakePayload`(캡처)가 이를 소비한다. UI는 review의 QuoteCompare 위 쿠폰 섹션 + QuoteCompare 적용 라인.

**Tech Stack:** React(Vite), vitest, opsStrings 4개 언어.

**Spec:** `docs/superpowers/specs/2026-07-06-intake-coupon-design.md`

## Global Constraints

- 스트링은 4개 언어(en/ko/zh/es) 동시 추가 — `intake.gflow`(쿠폰 키), `intake.estimate`(couponLine). 누락 금지.
- 서버(`server/`, `api/`) 무변경 — couponCode는 formPayload(jsonb)로 자동 전파.
- 미등록 코드도 페이로드에 캡처(정규화만) — UI에서만 "유효하지 않음" 힌트.
- 커밋 메시지: 한국어 요약 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `src/lib/coupons.js` — 카탈로그·정규화·적용 (TDD)

**Files:**
- Create: `src/lib/coupons.js`
- Test: `src/lib/__tests__/coupons.test.js`

**Interfaces (Produces):**
- `COUPONS: [{ code, kind: "margin0"|"percent", value?, labelKey }]`
- `normalizeCouponCode(raw) → string` (trim·대문자·내부 공백 제거)
- `findCoupon(raw) → coupon|null`
- `applyCoupon({ totalUsd, diamondAmountUsd, multiplier }, coupon) → { totalUsd, discountUsd }`

- [ ] **Step 1: 실패 테스트** — `src/lib/__tests__/coupons.test.js`:

```js
import { describe, expect, it } from "vitest";
import { applyCoupon, findCoupon, normalizeCouponCode } from "../coupons.js";

describe("normalizeCouponCode / findCoupon", () => {
  it("trim·대문자·내부 공백 제거 후 카탈로그 조회 (대소문자 무시)", () => {
    expect(normalizeCouponCode("  bd-atcost ")).toBe("BD-ATCOST");
    expect(findCoupon("welcome5")?.code).toBe("WELCOME5");
    expect(findCoupon(" bd - private ")?.code).toBe("BD-PRIVATE");
    expect(findCoupon("NOPE")).toBeNull();
    expect(findCoupon("")).toBeNull();
  });
});

describe("applyCoupon", () => {
  const totals = { totalUsd: 1900, diamondAmountUsd: 900, multiplier: 1.8 };
  it("margin0: 다이아를 원가(멀티플라이어 1.0)로 환원", () => {
    const r = applyCoupon(totals, findCoupon("BD-ATCOST"));
    expect(r.totalUsd).toBe(1500); // 1900 − 900 + round(900/1.8)
    expect(r.discountUsd).toBe(400);
  });
  it("percent: 총액 % 할인", () => {
    expect(applyCoupon(totals, findCoupon("WELCOME5")).totalUsd).toBe(1805);
    expect(applyCoupon(totals, findCoupon("BD-PRIVATE")).totalUsd).toBe(1615);
  });
  it("쿠폰 없음: 무변화", () => {
    expect(applyCoupon(totals, null)).toEqual({ totalUsd: 1900, discountUsd: 0 });
  });
});
```

- [ ] **Step 2: FAIL 확인** — `npx vitest run src/lib/__tests__/coupons.test.js` → "Failed to resolve import ../coupons.js"

- [ ] **Step 3: 구현** — `src/lib/coupons.js`:

```js
// 쿠폰 카탈로그 — 클라이언트 번들에 노출되므로 '비밀'이 아니라 '약속'이다:
// 최종 적용은 오퍼레이터가 확정 제안(견적)에서 검증한다 (RFQ 흐름, 남용 시 거절).
// margin0 = 다이아 멀티플라이어를 1.0으로 환원(마진 0%, 원가). percent = 총액 % 할인.
export const COUPONS = [
  { code: "BD-ATCOST", kind: "margin0", labelKey: "staff" },
  { code: "BD-PRIVATE", kind: "percent", value: 15, labelKey: "private" },
  { code: "WELCOME5", kind: "percent", value: 5, labelKey: "welcome" },
];

export function normalizeCouponCode(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function findCoupon(raw) {
  const code = normalizeCouponCode(raw);
  return code ? COUPONS.find((c) => c.code === code) || null : null;
}

export function applyCoupon({ totalUsd, diamondAmountUsd, multiplier }, coupon) {
  let discounted = totalUsd;
  if (coupon?.kind === "margin0" && multiplier > 0) {
    discounted = totalUsd - diamondAmountUsd + Math.round(diamondAmountUsd / multiplier);
  } else if (coupon?.kind === "percent") {
    discounted = Math.round(totalUsd * (1 - coupon.value / 100));
  }
  return { totalUsd: discounted, discountUsd: totalUsd - discounted };
}
```

- [ ] **Step 4: PASS 확인** — 같은 명령 → 전부 PASS
- [ ] **Step 5: 커밋** — `feat: 쿠폰 카탈로그·적용 수식 (BD-ATCOST/BD-PRIVATE/WELCOME5)`

---

### Task 2: 페이로드 캡처 + 견적 반영 (TDD)

**Files:**
- Modify: `src/lib/intakePayload.js` (`buildIntakePayload` return)
- Modify: `src/lib/quoteEstimate.js` (`estimateQuoteRange`)
- Modify: `src/lib/store.js` (`createQuote`)
- Test: `src/lib/__tests__/intakePayload.test.js`, `src/lib/__tests__/coupons.test.js`

**Interfaces:**
- Consumes: Task 1의 findCoupon/applyCoupon.
- Produces: `payload.couponCode`(정규화, 항상 존재), `estimateQuoteRange(form).coupon: { code, labelKey, savedUsd }|null`, `quote.coupon: { code, discountUsd }`(쿠폰 있을 때만) — Task 4 UI·Task 5 표시면이 의존.

- [ ] **Step 1: 실패 테스트 3건**

`intakePayload.test.js`의 buildIntakePayload describe에:
```js
  it("쿠폰 코드는 정규화되어 실린다 (미등록 코드도 캡처)", () => {
    expect(buildIntakePayload(ringForm({ name: "G", contact: "g@x.com", couponCode: " welcome5 " }), [], null).couponCode).toBe("WELCOME5");
    expect(buildIntakePayload(ringForm({ name: "G", contact: "g@x.com", couponCode: "unknown-x" }), [], null).couponCode).toBe("UNKNOWN-X");
    expect(buildIntakePayload(ringForm({ name: "G", contact: "g@x.com" }), [], null).couponCode).toBe("");
  });
```

`coupons.test.js`에 (import에 beforeEach/resetDB/createIntake/createQuote/estimateQuoteRange/buildIntakePayload 추가):
```js
import { beforeEach } from "vitest";
import { createIntake, createQuote, resetDB } from "../store.js";
import { buildIntakePayload } from "../intakePayload.js";
import { estimateQuoteRange } from "../quoteEstimate.js";

function ringForm(overrides = {}) {
  return {
    name: "", contact: "", productLine: "solitaire", category: "ring", subcategory: "engagementRing",
    styleId: "", metal: "18kw", conditional: { ringSize: "6" },
    stonePrefs: { shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" },
    multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
    requiredDate: "", termsAccepted: true,
    ...overrides,
  };
}

describe("쿠폰 → 예상 견적/로컬 견적 반영", () => {
  beforeEach(() => resetDB());

  it("쿠폰이 예상 견적을 낮춘다 — BD-ATCOST(마진0)가 WELCOME5보다 크게", () => {
    const base = estimateQuoteRange(ringForm());
    const welcome = estimateQuoteRange(ringForm({ couponCode: "welcome5" }));
    const atcost = estimateQuoteRange(ringForm({ couponCode: "BD-ATCOST" }));
    expect(base.coupon).toBeNull();
    expect(welcome.beloved.low).toBeLessThan(base.beloved.low);
    expect(atcost.beloved.low).toBeLessThan(welcome.beloved.low);
    expect(welcome.coupon).toMatchObject({ code: "WELCOME5", labelKey: "welcome" });
    expect(welcome.coupon.savedUsd).toBeGreaterThan(0);
  });

  it("인테이크 쿠폰은 로컬 견적(createQuote)에 자동 반영된다", () => {
    const payload = buildIntakePayload(ringForm({ name: "C", contact: "c@x.com", couponCode: "welcome5" }), [], null);
    const { order } = createIntake(payload, null);
    // 다이아 후보 없음 → 다이아 0, 베이스 = 메탈 400 + 공임 600 = 1000 → 5% 할인
    const q = createQuote(order.id, { estWeightG: 4, metalRefUsdPerG: 100, lossRatePct: 0, nonMetalUsd: 600 });
    expect(q.totalUsd).toBe(950);
    expect(q.coupon).toEqual({ code: "WELCOME5", discountUsd: 50 });
    expect(q.depositUsd).toBe(475); // opsDepositRate 0.5
    expect(q.balanceUsd).toBe(475);
  });
});
```

- [ ] **Step 2: FAIL 확인** — `npx vitest run src/lib/__tests__/coupons.test.js src/lib/__tests__/intakePayload.test.js`

- [ ] **Step 3: 구현**

`intakePayload.js`: `import { normalizeCouponCode } from "./coupons.js";` + return에 `couponCode: normalizeCouponCode(form.couponCode),` (engraving 줄 다음).

`quoteEstimate.js`: `import { applyCoupon, findCoupon } from "./coupons.js";` + quoteCompute 구조분해에 `diamondAmountUsd` 추가, 이후:
```js
  const { totalUsd, diamondAmountUsd } = quoteCompute({ ... });
  // 쿠폰 — 스프레드 전 총액에 적용해 절감액을 단일 수치로 보여준다
  const coupon = findCoupon(form.couponCode);
  const applied = applyCoupon({ totalUsd, diamondAmountUsd, multiplier }, coupon);
  const low = round10(applied.totalUsd * 0.92);
  const high = round10(applied.totalUsd * 1.1);
```
반환 객체에 `coupon: coupon ? { code: coupon.code, labelKey: coupon.labelKey, savedUsd: round10(applied.discountUsd) } : null,` 추가. 경쟁사 계산은 `low/high` 그대로(할인 후) — 스펙 §2 의도는 "경쟁사엔 쿠폰 없음"이지만 경쟁사 배수가 할인 후 총액을 기준으로 하면 경쟁사도 같이 내려간다 → 경쟁사는 **미할인** low/high로 계산해야 함:
```js
  const baseLow = round10(totalUsd * 0.92);
  const baseHigh = round10(totalUsd * 1.1);
  const competitors = COMPETITORS.map((c) => ({ name: c.name, low: round10(baseLow * c.lo), high: round10(baseHigh * c.hi) }));
```

`store.js`: `import { applyCoupon, findCoupon } from "./coupons.js";` + `createQuote`에서 multiplier를 const로 추출하고 computed 다음에:
```js
  // 인테이크 쿠폰은 '견적 약속' — 이 주문의 모든 견적 버전이 자동 존중한다 (원가 breakdown 미노출 유지)
  const coupon = findCoupon(getIntake(order?.intakeId)?.couponCode);
  if (coupon) {
    const applied = applyCoupon({ totalUsd: computed.totalUsd, diamondAmountUsd: computed.diamondAmountUsd, multiplier }, coupon);
    computed.totalUsd = applied.totalUsd;
    computed.depositUsd = Math.round(applied.totalUsd * db().settings.opsDepositRate);
    computed.balanceUsd = applied.totalUsd - computed.depositUsd;
    computed.coupon = { code: coupon.code, discountUsd: applied.discountUsd }; // ...computed 스프레드로 quote에 실림
  }
```

- [ ] **Step 4: PASS + 전체 회귀** — `npm test` 전부 PASS
- [ ] **Step 5: 커밋** — `feat: 쿠폰을 페이로드·예상 견적·로컬 견적에 반영`

---

### Task 3: i18n — 4개 언어 쿠폰 스트링

**Files:** `src/opsStrings.js` — 각 로케일 `gflow`(engravingHints 블록 다음)와 `estimate`(객체 끝).

- [ ] **Step 1: gflow에 추가** (en 예시 — ko/zh/es 동일 구조):

en: `couponTitle: "Coupon code"`, `couponPh: "e.g. WELCOME5"`, `couponHint: "Have a code? Enter it here — we honor it in your final proposal."`, `couponInvalid: "We don't recognize this code — we'll double-check it at the proposal stage."`, `couponAppliedNote: "reflected in the estimate below"`, `couponNames: { staff: "Team at-cost (0% margin)", private: "Private party discount (15%)", welcome: "Welcome discount (5%)" }`

ko: `쿠폰 코드` / `예: WELCOME5` / `쿠폰이 있다면 입력하세요 — 확정 제안에 그대로 반영해 드려요.` / `등록되지 않은 코드예요 — 제안 단계에서 다시 확인해 드릴게요.` / `아래 예상 견적에 반영됐어요` / `{ staff: "운영자 원가 (마진 0%)", private: "프라이빗 파티 할인 (15%)", welcome: "웰컴 할인 (5%)" }`

zh: `优惠码` / `例：WELCOME5` / `如有优惠码请输入 — 将在正式方案中兑现。` / `未识别的优惠码 — 我们会在方案阶段再次确认。` / `已反映在下方预估中` / `{ staff: "团队成本价（0% 毛利）", private: "私人派对优惠（15%）", welcome: "新客优惠（5%）" }`

es: `Código de cupón` / `p. ej. WELCOME5` / `¿Tienes un código? Introdúcelo — lo aplicamos en tu propuesta final.` / `No reconocemos este código — lo verificaremos en la etapa de propuesta.` / `reflejado en la estimación de abajo` / `{ staff: "Precio de coste del equipo (0% margen)", private: "Descuento private party (15%)", welcome: "Descuento de bienvenida (5%)" }`

- [ ] **Step 2: estimate에 couponLine 추가** — 각 로케일 estimate 객체 끝:
  - en `couponLine: (c, a) => \`Coupon ${c} applied · −${a}\``
  - ko `couponLine: (c, a) => \`쿠폰 ${c} 적용 · −${a}\``
  - zh `couponLine: (c, a) => \`优惠码 ${c} 已应用 · −${a}\``
  - es `couponLine: (c, a) => \`Cupón ${c} aplicado · −${a}\``

- [ ] **Step 3: 검증** — node import 스크립트로 4로케일 × (couponTitle/Ph/Hint/Invalid/AppliedNote/Names 3키/estimate.couponLine) 존재 확인
- [ ] **Step 4: 커밋** — `feat: 쿠폰 4개 언어 스트링`

---

### Task 4: UI — IntakeForm 쿠폰 섹션 + QuoteCompare 적용 라인

**Files:**
- Modify: `src/pages/IntakeForm.jsx` — baseForm에 `couponCode: ""`, 파생값 `activeCoupon`, review의 `<QuoteCompare form={form} />` 직전 섹션
- Modify: `src/components/QuoteCompare.jsx` — qc-head에 쿠폰 라인

- [ ] **Step 1: IntakeForm** — `import { findCoupon, normalizeCouponCode } from "../lib/coupons.js";`, baseForm `engraving: ""` 다음에 `couponCode: "",`. 파생값(selectedStyle 근처): `const activeCoupon = findCoupon(form.couponCode);`. review에서 `<QuoteCompare form={form} />` 직전:

```jsx
          {/* 쿠폰 — 견적 바로 위: 코드를 넣으면 아래 예상 견적이 즉시 할인 반영된다 */}
          <section className="gflow-review-section">
            <h4>{g.couponTitle}</h4>
            <label className="field" style={{ maxWidth: 320 }}>
              <input
                value={form.couponCode}
                maxLength={20}
                placeholder={g.couponPh}
                onChange={(e) => setF({ couponCode: e.target.value.toUpperCase() })}
              />
            </label>
            <p className="form-hint" style={{ margin: 0 }}>
              {activeCoupon
                ? `✓ ${g.couponNames[activeCoupon.labelKey]} — ${g.couponAppliedNote}`
                : normalizeCouponCode(form.couponCode) ? g.couponInvalid : g.couponHint}
            </p>
          </section>
```

- [ ] **Step 2: QuoteCompare** — qc-head 좌측 div의 qc-total 다음:

```jsx
          {est.coupon && (
            <div className="qc-kicker" style={{ marginTop: 4 }}>{t.couponLine(est.coupon.code, usd(est.coupon.savedUsd))}</div>
          )}
```

- [ ] **Step 3: 빌드** — `npm run build` 성공
- [ ] **Step 4: 커밋** — `feat: 위저드 review 쿠폰 입력 + 예상 견적 할인 라인`

---

### Task 5: 표시면 — 어드민·포털 Coupon 행

**Files:**
- Modify: `src/pages/admin/AdminLiveOrders.jsx` — intakeRows의 Engraving 행 다음 `["Coupon", (fp.couponCode || "").trim()]`
- Modify: `src/pages/ClientPortal.jsx` — buildOrderBriefRows의 engraving 행 다음 `{ label: intakeText.gflow?.couponTitle || "Coupon", value: (intake?.couponCode || "").trim() },`

- [ ] **Step 1: 두 행 추가** (빈 값은 기존 필터가 제거)
- [ ] **Step 2: 빌드 + 커밋** — `feat: 쿠폰 표시 — 어드민 인테이크 행 · 포털 브리프`

---

### Task 6: E2E 브라우저 검증

- [ ] `npm test && npm run build` 전부 PASS
- [ ] 위저드 완주(링): review에서 기본 견적 확인 → `WELCOME5` 입력 → 견적 범위 하락 + "쿠폰 WELCOME5 적용 · −$X" 라인 + ✓ 힌트 → `BD-ATCOST`로 바꾸면 더 큰 하락 → `NOPE` 입력 시 무효 힌트·견적 원복 → `WELCOME5`로 제출
- [ ] 포털 브리프에 "쿠폰 코드 · WELCOME5" 행 + (데모 견적 생성 시) 할인 반영 확인
- [ ] 쿠폰 없이 제출한 기존 주문 브리프에 Coupon 행 없음, 콘솔 신규 에러 0
