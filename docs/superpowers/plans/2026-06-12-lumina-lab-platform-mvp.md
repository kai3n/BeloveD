# LUMINA LAB 플랫폼 MVP (프론트엔드 프로토타입) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스펙(`docs/superpowers/specs/2026-06-12-lumina-lab-platform-design.md`)의 전 화면 — 스토어프론트(다이아 검색/템플릿/커스텀 주문 위저드/마이페이지) + 벤더 포털 + 운영자 어드민 — 을 localStorage 기반 mock 데이터 스토어 위에 클릭 가능한 프로토타입으로 구현한다.

**Architecture:** 기존 Vite + React 19 SPA에 react-router를 추가하고, `src/lib/`에 순수 로직(상태머신·마스킹·스토어·인증)을 분리해 Vitest로 단위 테스트한다. UI는 기존 NOIR 디자인 토큰을 재사용하고 신규 화면 스타일은 `src/platform.css`에 둔다. 데이터는 `lumina-db-v1` localStorage 키에 단일 JSON으로 저장하고 구독(listener) 패턴으로 React를 갱신한다. Supabase/Stripe 연동은 후속 플랜 (이 플랜의 store API가 그 교체 지점).

**Tech Stack:** React 19, react-router-dom 7, Vitest, lucide-react, CSS 변수 토큰.

**i18n (2026-06-12 변경):** 모든 신규 화면 텍스트는 4개 언어(EN/中文/KO/ES) 완전 지원. `translations.js`에 `platform` 섹션을 언어별로 추가하고, 데이터는 키 기반(쉐입 `round`, 메탈 `wg18`, 배송단계 `production|qc|ready|shipping|delivered`, 템플릿 `name: {ko,en,zh,es}`)으로 저장해 사전에서 라벨을 매핑한다. 플랜 본문 코드의 한국어 하드코딩 문구는 구현 시 `t.platform.*` 사전 키로 대체한다 (구조·로직은 동일).

**샘플 사진 (기존 자산 재사용):** `/assets/jewelry-lineup.png`(5분할 크롭: background-position 0%/24%/50%/72%/100%), `/assets/lab-diamond-tweezers.png`, `/assets/diamond-noir-white.mp4`, `/assets/concept-lumina-lab.png`.

**파일 구조:**

```
src/
  main.jsx                  진입점 (Router + Provider)
  App.jsx                   라우트 정의
  Layout.jsx                헤더/푸터 셸 (역할별 메뉴)
  i18n.jsx                  LocaleProvider + useLocale
  translations.js           기존 4개 언어 사전 (App.jsx에서 이동)
  styles.css                기존 홈 스타일 (유지)
  platform.css              신규 화면 공통 스타일
  components/ui.jsx         won, CropImage, MediaThumb, StatusBadge, Stepper, EmptyNote
  lib/
    statusMachine.js        주문 상태머신 (허용 전이 + 역할 검증)
    masking.js              연락처 마스킹
    seed.js                 데모 데이터
    store.js                mock DB (localStorage) + 도메인 API
    auth.jsx                AuthProvider, useAuth, RequireRole
    useDB.js                useDBVersion 구독 훅
    __tests__/statusMachine.test.js
    __tests__/masking.test.js
    __tests__/store.test.js
  pages/
    Home.jsx                기존 홈 섹션 (App.jsx에서 이동)
    Diamonds.jsx            다이아 검색 (필터/정렬)
    DiamondDetail.jsx       다이아 상세 (미디어/4C/인증서)
    Templates.jsx           템플릿 갤러리
    CustomWizard.jsx        커스텀 주문 4단계 위저드
    Login.jsx               로그인/회원가입 (+데모 계정 버튼)
    Account.jsx             마이페이지 (주문/결제/프로필 탭)
    RequestDetail.jsx       시안 검토 + 결제 + 배송 추적
    Guide.jsx               교육 페이지 2종
    vendor/VendorQueue.jsx  벤더 요청 큐
    vendor/VendorRequest.jsx 벤더 주문 상세 + 시안 업로드
    admin/Admin.jsx         어드민 셸 + 대시보드
    admin/AdminDiamonds.jsx 인벤토리 + 가격 조정
    admin/AdminTemplates.jsx
    admin/AdminOrders.jsx   주문 감독 + 벤더 배정
    admin/AdminVendors.jsx
    admin/AdminSettings.jsx
```

**커밋 규칙:** 태스크당 1커밋, 브랜치 `feature/lumina-platform`.

---

### Task 1: Vitest 설치 + 상태머신 (TDD)

**Files:**
- Modify: `package.json` (scripts.test, devDependencies)
- Create: `src/lib/statusMachine.js`
- Test: `src/lib/__tests__/statusMachine.test.js`

- [ ] **Step 1: 의존성 설치**

```bash
npm i react-router-dom && npm i -D vitest
```

`package.json` scripts에 추가: `"test": "vitest run", "test:watch": "vitest"`

- [ ] **Step 2: 실패하는 테스트 작성** — `src/lib/__tests__/statusMachine.test.js`

```js
import { describe, expect, it } from "vitest";
import { STATUSES, canTransition, assertTransition } from "../statusMachine.js";

describe("statusMachine", () => {
  it("정의된 전체 상태를 노출한다", () => {
    expect(STATUSES).toContain("PROPOSAL_UPLOADED");
    expect(STATUSES).toContain("ON_HOLD");
  });

  it("핵심 해피패스 전이를 허용한다", () => {
    expect(canTransition("DRAFT", "SUBMITTED", "customer")).toBe(true);
    expect(canTransition("SUBMITTED", "VENDOR_ASSIGNED", "admin")).toBe(true);
    expect(canTransition("VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "vendor")).toBe(true);
    expect(canTransition("PROPOSAL_UPLOADED", "REVISION_REQUESTED", "customer")).toBe(true);
    expect(canTransition("REVISION_REQUESTED", "PROPOSAL_UPLOADED", "vendor")).toBe(true);
    expect(canTransition("PROPOSAL_UPLOADED", "CONFIRMED", "customer")).toBe(true);
    expect(canTransition("CONFIRMED", "DEPOSIT_PAID", "customer")).toBe(true);
    expect(canTransition("DEPOSIT_PAID", "IN_PRODUCTION", "vendor")).toBe(true);
    expect(canTransition("IN_PRODUCTION", "QUALITY_CHECK", "vendor")).toBe(true);
    expect(canTransition("QUALITY_CHECK", "FINAL_PAYMENT_PAID", "customer")).toBe(true);
    expect(canTransition("FINAL_PAYMENT_PAID", "SHIPPED", "admin")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED", "admin")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED", "customer")).toBe(true);
  });

  it("역할이 틀리면 거부한다", () => {
    expect(canTransition("SUBMITTED", "VENDOR_ASSIGNED", "vendor")).toBe(false);
    expect(canTransition("VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "customer")).toBe(false);
    expect(canTransition("PROPOSAL_UPLOADED", "CONFIRMED", "vendor")).toBe(false);
  });

  it("허용되지 않은 점프를 거부한다", () => {
    expect(canTransition("SUBMITTED", "DEPOSIT_PAID", "customer")).toBe(false);
    expect(canTransition("DRAFT", "SHIPPED", "admin")).toBe(false);
    expect(canTransition("CONFIRMED", "IN_PRODUCTION", "vendor")).toBe(false);
  });

  it("검수 실패 시 재제작 루프를 허용한다", () => {
    expect(canTransition("QUALITY_CHECK", "IN_PRODUCTION", "admin")).toBe(true);
  });

  it("취소 규칙: 고객은 CONFIRMED까지, 디파짓 후는 운영자만", () => {
    expect(canTransition("SUBMITTED", "CANCELLED", "customer")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED", "customer")).toBe(true);
    expect(canTransition("DEPOSIT_PAID", "CANCELLED", "customer")).toBe(false);
    expect(canTransition("DEPOSIT_PAID", "CANCELLED", "admin")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED", "admin")).toBe(false);
    expect(canTransition("PROPOSAL_UPLOADED", "CANCELLED", "vendor")).toBe(false);
  });

  it("assertTransition은 잘못된 전이에 throw한다", () => {
    expect(() => assertTransition("DRAFT", "SHIPPED", "admin")).toThrow(/Invalid transition/);
    expect(() => assertTransition("DRAFT", "SUBMITTED", "customer")).not.toThrow();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/__tests__/statusMachine.test.js`
Expected: FAIL — "Cannot find module '../statusMachine.js'"

- [ ] **Step 4: 구현** — `src/lib/statusMachine.js`

```js
export const STATUSES = [
  "DRAFT", "SUBMITTED", "VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "REVISION_REQUESTED",
  "CONFIRMED", "DEPOSIT_PAID", "IN_PRODUCTION", "QUALITY_CHECK", "FINAL_PAYMENT_PAID",
  "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "ON_HOLD",
];

// to 상태 기준 허용 규칙: 어떤 from에서, 어떤 역할이 일으킬 수 있는가
const TRANSITIONS = {
  SUBMITTED: { from: ["DRAFT"], roles: ["customer"] },
  VENDOR_ASSIGNED: { from: ["SUBMITTED", "ON_HOLD"], roles: ["admin"] },
  PROPOSAL_UPLOADED: { from: ["VENDOR_ASSIGNED", "REVISION_REQUESTED"], roles: ["vendor"] },
  REVISION_REQUESTED: { from: ["PROPOSAL_UPLOADED"], roles: ["customer"] },
  CONFIRMED: { from: ["PROPOSAL_UPLOADED"], roles: ["customer"] },
  DEPOSIT_PAID: { from: ["CONFIRMED"], roles: ["customer", "system"] },
  IN_PRODUCTION: { from: ["DEPOSIT_PAID", "QUALITY_CHECK"], roles: ["vendor", "admin"] },
  QUALITY_CHECK: { from: ["IN_PRODUCTION"], roles: ["vendor", "admin"] },
  FINAL_PAYMENT_PAID: { from: ["QUALITY_CHECK"], roles: ["customer", "system"] },
  SHIPPED: { from: ["FINAL_PAYMENT_PAID"], roles: ["admin"] },
  DELIVERED: { from: ["SHIPPED"], roles: ["admin", "system"] },
  COMPLETED: { from: ["DELIVERED"], roles: ["customer", "system"] },
  ON_HOLD: { from: ["CONFIRMED"], roles: ["admin", "system"] },
};

const CUSTOMER_CANCELLABLE = [
  "SUBMITTED", "VENDOR_ASSIGNED", "PROPOSAL_UPLOADED", "REVISION_REQUESTED", "CONFIRMED",
];

export function canTransition(from, to, role) {
  if (to === "CANCELLED") {
    if (role === "admin") return from !== "COMPLETED" && from !== "CANCELLED";
    if (role === "customer") return CUSTOMER_CANCELLABLE.includes(from);
    return false;
  }
  const rule = TRANSITIONS[to];
  if (!rule) return false;
  return rule.from.includes(from) && rule.roles.includes(role);
}

export function assertTransition(from, to, role) {
  if (!canTransition(from, to, role)) {
    throw new Error(`Invalid transition ${from} -> ${to} by ${role}`);
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/__tests__/statusMachine.test.js`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/lib
git commit -m "feat: 주문 상태머신 + Vitest 도입 (TDD)"
```

---

### Task 2: 연락처 마스킹 (TDD)

**Files:**
- Create: `src/lib/masking.js`
- Test: `src/lib/__tests__/masking.test.js`

- [ ] **Step 1: 실패하는 테스트** — `src/lib/__tests__/masking.test.js`

```js
import { describe, expect, it } from "vitest";
import { maskContacts } from "../masking.js";

describe("maskContacts", () => {
  it("전화번호를 마스킹한다", () => {
    expect(maskContacts("연락주세요 010-1234-5678")).not.toContain("010-1234-5678");
    expect(maskContacts("call +82 10 1234 5678 now")).not.toContain("1234");
  });
  it("이메일을 마스킹한다", () => {
    expect(maskContacts("저는 foo.bar@gmail.com 입니다")).not.toContain("foo.bar@gmail.com");
  });
  it("URL을 마스킹한다", () => {
    expect(maskContacts("https://open.kakao.com/o/abc 로 오세요")).not.toContain("open.kakao.com");
    expect(maskContacts("visit www.mysite.co.kr please")).not.toContain("mysite");
  });
  it("SNS 아이디 패턴을 마스킹한다", () => {
    expect(maskContacts("카톡 아이디 jewel_master 추가요")).not.toContain("jewel_master");
    expect(maskContacts("insta @diamond.guy dm me")).not.toContain("diamond.guy");
  });
  it("일반 텍스트는 보존한다", () => {
    expect(maskContacts("밴드를 1mm 더 얇게 해주세요")).toBe("밴드를 1mm 더 얇게 해주세요");
  });
  it("빈 값은 그대로", () => {
    expect(maskContacts("")).toBe("");
    expect(maskContacts(null)).toBe(null);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/masking.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: 구현** — `src/lib/masking.js`

```js
const MASK = "[차단됨]";

const PATTERNS = [
  /https?:\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  // 8자리 이상 숫자(구분자 포함) — 전화번호
  /\+?\d[\d\s().-]{6,}\d/g,
  // 메신저/SNS 키워드 + 아이디
  /\b(?:카톡|카카오톡?|kakao|insta(?:gram)?|인스타|telegram|텔레그램|wechat|위챗|line|라인)\s*(?:id|아이디)?\s*[:@]?\s*[A-Za-z0-9._-]{3,}/gi,
  /@[A-Za-z0-9._]{3,}/g,
];

export function maskContacts(text) {
  if (!text) return text;
  return PATTERNS.reduce((out, re) => out.replace(re, MASK), String(text));
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/masking.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/masking.js src/lib/__tests__/masking.test.js
git commit -m "feat: 시안 코멘트 연락처 마스킹 (TDD)"
```

---

### Task 3: 시드 데이터 + mock 스토어 (TDD)

**Files:**
- Create: `src/lib/seed.js`
- Create: `src/lib/store.js`
- Create: `src/lib/useDB.js`
- Test: `src/lib/__tests__/store.test.js`

- [ ] **Step 1: 시드 작성** — `src/lib/seed.js`

```js
const LINEUP = "/assets/jewelry-lineup.png";
const TWEEZERS = "/assets/lab-diamond-tweezers.png";
const NOIR_VIDEO = "/assets/diamond-noir-white.mp4";

// 샘플 사진: 기존 자산 재사용. pos가 있으면 jewelry-lineup.png 크롭(5분할)
const crop = (pos) => ({ kind: "image", src: LINEUP, pos });

export function seed() {
  return {
    counter: 1100,
    users: [
      { id: "u-admin", email: "admin@demo.com", role: "admin", name: "운영자" },
      { id: "u-vendor1", email: "vendor@demo.com", role: "vendor", name: "ATELIER-01", active: true },
      { id: "u-vendor2", email: "vendor2@demo.com", role: "vendor", name: "ATELIER-02", active: true },
      { id: "u-customer", email: "customer@demo.com", role: "customer", name: "김지원" },
    ],
    diamonds: [
      { id: "d-1", shape: "라운드", carat: 1.0, cut: "Excellent", color: "D", clarity: "VVS1", certOrg: "IGI", certNo: "IGI-588301244", priceKrw: 1850000, visible: true, media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }] },
      { id: "d-2", shape: "라운드", carat: 1.5, cut: "Excellent", color: "E", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301245", priceKrw: 3200000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-3", shape: "오벌", carat: 1.2, cut: "Excellent", color: "F", clarity: "VVS2", certOrg: "IGI", certNo: "IGI-588301246", priceKrw: 2400000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-4", shape: "프린세스", carat: 1.0, cut: "Very Good", color: "E", clarity: "VS2", certOrg: "GIA", certNo: "GIA-2231855700", priceKrw: 1700000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-5", shape: "에메랄드", carat: 2.0, cut: "Excellent", color: "F", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301248", priceKrw: 5900000, visible: true, media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }] },
      { id: "d-6", shape: "페어", carat: 1.5, cut: "Excellent", color: "D", clarity: "VVS2", certOrg: "GIA", certNo: "GIA-2231855701", priceKrw: 3600000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-7", shape: "쿠션", carat: 1.0, cut: "Very Good", color: "G", clarity: "SI1", certOrg: "IGI", certNo: "IGI-588301250", priceKrw: 1250000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-8", shape: "마퀴즈", carat: 0.9, cut: "Excellent", color: "E", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301251", priceKrw: 1450000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-9", shape: "래디언트", carat: 1.8, cut: "Excellent", color: "F", clarity: "VS2", certOrg: "IGI", certNo: "IGI-588301252", priceKrw: 4300000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-10", shape: "아셔", carat: 1.3, cut: "Excellent", color: "E", clarity: "VVS1", certOrg: "GIA", certNo: "GIA-2231855702", priceKrw: 3100000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-11", shape: "하트", carat: 1.0, cut: "Very Good", color: "F", clarity: "VS1", certOrg: "IGI", certNo: "IGI-588301254", priceKrw: 1950000, visible: true, media: [{ kind: "image", src: TWEEZERS }] },
      { id: "d-12", shape: "라운드", carat: 2.0, cut: "Excellent", color: "D", clarity: "IF", certOrg: "IGI", certNo: "IGI-588301255", priceKrw: 8400000, visible: true, media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }] },
    ],
    templates: [
      { id: "t-1", category: "ring", name: "아우로라 솔리테어", desc: "6프롱 클래식 솔리테어. 스톤이 주인공이 되는 가장 순수한 형태.", basePriceKrw: 690000, visible: true, media: [crop("0% center")] },
      { id: "t-2", category: "ring", name: "이터니티 밴드", desc: "밴드를 따라 흐르는 파베 세팅. 단독 착용과 레이어링 모두.", basePriceKrw: 890000, visible: true, media: [crop("24% center")] },
      { id: "t-3", category: "necklace", name: "루미나 펜던트", desc: "쇄골 위에 떠 있는 한 점의 빛. 데일리 펜던트의 정석.", basePriceKrw: 590000, visible: true, media: [crop("50% center")] },
      { id: "t-4", category: "earring", name: "클래식 스터드", desc: "각도까지 계산된 4프롱 스터드. 매일의 기본.", basePriceKrw: 490000, visible: true, media: [crop("72% center")] },
      { id: "t-5", category: "bracelet", name: "테니스 브레이슬릿", desc: "손목을 감싸는 연속된 광채.", basePriceKrw: 1190000, visible: true, media: [crop("100% center")] },
      { id: "t-6", category: "ring", name: "프리스타일 (자유 디자인)", desc: "참고 이미지를 첨부해 원하는 디자인을 자유롭게 의뢰하세요.", basePriceKrw: 0, visible: true, media: [{ kind: "image", src: "/assets/concept-lumina-lab.png" }] },
    ],
    requests: [
      {
        id: "req-1001", code: "#1001", customerId: "u-customer", templateId: "t-1", diamondId: "d-1",
        details: { metal: "18K 화이트골드", size: "11호", engraving: "J ♥ M", budget: 3000000, notes: "최대한 심플하고 가늘게 부탁드려요" },
        status: "PROPOSAL_UPLOADED", vendorId: "u-vendor1",
        createdAt: "2026-06-10T09:00:00.000Z", assignedAt: "2026-06-10T12:00:00.000Z",
      },
    ],
    proposals: [
      { id: "prop-1", requestId: "req-1001", vendorId: "u-vendor1", version: 1, comment: "요청하신 대로 밴드 1.6mm로 제작한 1차 시안입니다.", media: [crop("0% center"), { kind: "image", src: TWEEZERS }], createdAt: "2026-06-11T10:00:00.000Z" },
    ],
    feedback: [],
    orders: [],
    payments: [],
    productionMedia: [],
    statusEvents: [
      { id: "evt-1", refId: "req-1001", from: "DRAFT", to: "SUBMITTED", actorId: "u-customer", at: "2026-06-10T09:00:00.000Z" },
      { id: "evt-2", refId: "req-1001", from: "SUBMITTED", to: "VENDOR_ASSIGNED", actorId: "u-admin", at: "2026-06-10T12:00:00.000Z" },
      { id: "evt-3", refId: "req-1001", from: "VENDOR_ASSIGNED", to: "PROPOSAL_UPLOADED", actorId: "u-vendor1", at: "2026-06-11T10:00:00.000Z" },
    ],
    settings: { depositRate: 0.3, shippingStages: ["제작중", "검수", "배송준비", "배송중", "배송완료"] },
  };
}
```

- [ ] **Step 2: 실패하는 스토어 테스트** — `src/lib/__tests__/store.test.js`

```js
import { beforeEach, describe, expect, it } from "vitest";
import {
  resetDB, getDB, listDiamonds, adjustDiamondPrices, saveDiamond,
  createRequest, assignVendor, addProposal, addFeedback, payOrder,
  transitionRequest, getOrderByRequest, anonymizeForVendor, getRequest, listEvents,
} from "../store.js";

const customer = { id: "u-customer", role: "customer" };
const vendor = { id: "u-vendor1", role: "vendor" };
const admin = { id: "u-admin", role: "admin" };

beforeEach(() => resetDB());

describe("store", () => {
  it("시드 다이아 12개, visible 필터", () => {
    expect(listDiamonds().length).toBe(12);
    saveDiamond({ id: "d-1", visible: false });
    expect(listDiamonds().length).toBe(11);
    expect(listDiamonds({ includeHidden: true }).length).toBe(12);
  });

  it("일괄 % 가격 조정", () => {
    const before = listDiamonds()[0].priceKrw;
    adjustDiamondPrices(10);
    expect(listDiamonds()[0].priceKrw).toBeGreaterThan(before);
  });

  it("주문제작 전체 플로우: 제출→배정→시안→수정→시안→컨펌→디파짓→제작→검수→잔금→배송→수령", () => {
    const req = createRequest({ customerId: "u-customer", templateId: "t-1", diamondId: "d-2", details: { metal: "18K 옐로골드", size: "12호", engraving: "", budget: 5000000, notes: "" } });
    expect(req.status).toBe("SUBMITTED");
    expect(req.code).toMatch(/^#\d+$/);

    assignVendor(req.id, "u-vendor1", admin);
    const p1 = addProposal(req.id, "u-vendor1", { media: [], comment: "1차 시안. 문의는 010-1234-5678" });
    expect(p1.comment).not.toContain("010-1234-5678"); // 마스킹
    expect(getRequest(req.id).status).toBe("PROPOSAL_UPLOADED");

    addFeedback(p1.id, { decision: "revise", choices: ["밴드 두께"], comment: "더 얇게요" }, customer);
    expect(getRequest(req.id).status).toBe("REVISION_REQUESTED");

    const p2 = addProposal(req.id, "u-vendor1", { media: [], comment: "2차 시안" });
    const { order } = addFeedback(p2.id, { decision: "confirm", choices: [], comment: "" }, customer);
    expect(getRequest(req.id).status).toBe("CONFIRMED");
    expect(order.totalKrw).toBe(690000 + 3200000);
    expect(order.depositKrw).toBe(Math.round(order.totalKrw * 0.3));

    payOrder(order.id, "deposit", customer);
    expect(getRequest(req.id).status).toBe("DEPOSIT_PAID");

    transitionRequest(req.id, "IN_PRODUCTION", vendor);
    transitionRequest(req.id, "QUALITY_CHECK", vendor);
    payOrder(order.id, "final", customer);
    expect(getRequest(req.id).status).toBe("FINAL_PAYMENT_PAID");
    expect(getOrderByRequest(req.id).shippingStage).toBe("배송준비");

    transitionRequest(req.id, "SHIPPED", admin);
    transitionRequest(req.id, "DELIVERED", admin);
    transitionRequest(req.id, "COMPLETED", customer);
    expect(getOrderByRequest(req.id).shippingStage).toBe("배송완료");
    expect(listEvents(req.id).length).toBeGreaterThanOrEqual(11); // 감사 로그
  });

  it("잘못된 전이는 throw", () => {
    const req = createRequest({ customerId: "u-customer", templateId: "t-1", diamondId: null, details: {} });
    expect(() => transitionRequest(req.id, "SHIPPED", admin)).toThrow();
    expect(() => addProposal(req.id, "u-vendor1", { media: [], comment: "" })).toThrow(); // 배정 전
  });

  it("벤더 익명화: PII 제거", () => {
    const req = getRequest("req-1001");
    const anon = anonymizeForVendor(req);
    expect(anon.customerId).toBeUndefined();
    expect(anon.customerLabel).toBe("주문 #1001");
    expect(anon.details.metal).toBe("18K 화이트골드"); // 스펙은 유지
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/__tests__/store.test.js`
Expected: FAIL — store.js not found

- [ ] **Step 4: 구현** — `src/lib/store.js`

```js
import { seed } from "./seed.js";
import { assertTransition } from "./statusMachine.js";
import { maskContacts } from "./masking.js";

const KEY = "lumina-db-v1";

// 테스트(node) 환경 폴백
const memoryStorage = (() => {
  let m = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } };
})();
const storage = typeof localStorage !== "undefined" ? localStorage : memoryStorage;

let cache = null;
const listeners = new Set();

function db() {
  if (!cache) {
    const raw = storage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : seed();
    if (!raw) storage.setItem(KEY, JSON.stringify(cache));
  }
  return cache;
}
function persist() {
  storage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((fn) => fn());
}
const now = () => new Date().toISOString();

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getDB() { return db(); }
export function resetDB() { cache = seed(); persist(); }

function nextId(prefix) {
  db().counter += 1;
  return `${prefix}-${db().counter}`;
}
function logEvent(refId, from, to, actorId) {
  db().statusEvents.push({ id: nextId("evt"), refId, from, to, actorId, at: now() });
}

// ---------- users ----------
export function findUserByEmail(email) {
  return db().users.find((u) => u.email === String(email).trim().toLowerCase()) || null;
}
export function getUser(id) { return db().users.find((u) => u.id === id) || null; }
export function addUser({ email, name, role = "customer" }) {
  const user = { id: nextId("u"), email: String(email).trim().toLowerCase(), name, role, active: true };
  db().users.push(user);
  persist();
  return user;
}
export function listVendors() { return db().users.filter((u) => u.role === "vendor"); }
export function setVendorActive(id, active) {
  const v = getUser(id);
  if (v) { v.active = active; persist(); }
}

// ---------- diamonds ----------
export function listDiamonds({ includeHidden = false } = {}) {
  return db().diamonds.filter((d) => includeHidden || d.visible);
}
export function getDiamond(id) { return db().diamonds.find((d) => d.id === id) || null; }
export function saveDiamond(diamond) {
  const list = db().diamonds;
  const i = list.findIndex((d) => d.id === diamond.id);
  if (i >= 0) list[i] = { ...list[i], ...diamond };
  else list.push({ media: [{ kind: "image", src: "/assets/lab-diamond-tweezers.png" }], visible: true, ...diamond, id: nextId("d") });
  persist();
}
export function adjustDiamondPrices(percent) {
  db().diamonds.forEach((d) => {
    d.priceKrw = Math.round((d.priceKrw * (1 + percent / 100)) / 1000) * 1000;
  });
  persist();
}

// ---------- templates ----------
export function listTemplates({ includeHidden = false } = {}) {
  return db().templates.filter((t) => includeHidden || t.visible);
}
export function getTemplate(id) { return db().templates.find((t) => t.id === id) || null; }
export function saveTemplate(tpl) {
  const list = db().templates;
  const i = list.findIndex((t) => t.id === tpl.id);
  if (i >= 0) list[i] = { ...list[i], ...tpl };
  else list.push({ media: [], visible: true, ...tpl, id: nextId("t") });
  persist();
}

// ---------- custom requests ----------
export function listRequests(filter = {}) {
  let rs = [...db().requests];
  if (filter.customerId) rs = rs.filter((r) => r.customerId === filter.customerId);
  if (filter.vendorId) rs = rs.filter((r) => r.vendorId === filter.vendorId);
  return rs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getRequest(id) { return db().requests.find((r) => r.id === id) || null; }

export function createRequest({ customerId, templateId, diamondId, details }) {
  const id = nextId("req");
  const request = {
    id, code: `#${id.slice(4)}`, customerId, templateId, diamondId: diamondId || null,
    details: { ...details, notes: maskContacts(details?.notes || "") },
    status: "SUBMITTED", vendorId: null, createdAt: now(), assignedAt: null,
  };
  db().requests.push(request);
  logEvent(id, "DRAFT", "SUBMITTED", customerId);
  persist();
  return request;
}

// 상태 전이 공통 경로 + 주문 배송단계 동기화
const STAGE_BY_STATUS = {
  IN_PRODUCTION: "제작중", QUALITY_CHECK: "검수", FINAL_PAYMENT_PAID: "배송준비",
  SHIPPED: "배송중", DELIVERED: "배송완료", COMPLETED: "배송완료",
};
export function transitionRequest(id, to, actor) {
  const r = getRequest(id);
  assertTransition(r.status, to, actor.role);
  logEvent(id, r.status, to, actor.id);
  r.status = to;
  const order = getOrderByRequest(id);
  if (order && STAGE_BY_STATUS[to]) order.shippingStage = STAGE_BY_STATUS[to];
  persist();
  return r;
}

export function assignVendor(requestId, vendorId, actor) {
  const r = getRequest(requestId);
  assertTransition(r.status, "VENDOR_ASSIGNED", actor.role);
  logEvent(requestId, r.status, "VENDOR_ASSIGNED", actor.id);
  r.status = "VENDOR_ASSIGNED";
  r.vendorId = vendorId;
  r.assignedAt = now();
  persist();
  return r;
}

// 벤더에게 보여줄 때 PII 제거 (핵심 익명성 규칙)
export function anonymizeForVendor(request) {
  const { customerId, ...rest } = request;
  return { ...rest, customerLabel: `주문 ${request.code}` };
}

// ---------- proposals & feedback ----------
export function listProposals(requestId) {
  return db().proposals.filter((p) => p.requestId === requestId).sort((a, b) => a.version - b.version);
}
export function addProposal(requestId, vendorId, { media, comment }) {
  const r = getRequest(requestId);
  assertTransition(r.status, "PROPOSAL_UPLOADED", "vendor");
  const proposal = {
    id: nextId("prop"), requestId, vendorId, version: listProposals(requestId).length + 1,
    media: media || [], comment: maskContacts(comment || ""), createdAt: now(),
  };
  db().proposals.push(proposal);
  logEvent(requestId, r.status, "PROPOSAL_UPLOADED", vendorId);
  r.status = "PROPOSAL_UPLOADED";
  persist();
  return proposal;
}
export function listFeedback(proposalId) {
  return db().feedback.filter((f) => f.proposalId === proposalId);
}
export function addFeedback(proposalId, { decision, choices, comment }, actor) {
  const proposal = db().proposals.find((p) => p.id === proposalId);
  const r = getRequest(proposal.requestId);
  const to = decision === "confirm" ? "CONFIRMED" : "REVISION_REQUESTED";
  assertTransition(r.status, to, actor.role);
  db().feedback.push({
    id: nextId("fb"), proposalId, customerId: actor.id, decision,
    choices: choices || [], comment: maskContacts(comment || ""), createdAt: now(),
  });
  logEvent(r.id, r.status, to, actor.id);
  r.status = to;
  let order = null;
  if (to === "CONFIRMED") {
    const tpl = getTemplate(r.templateId);
    const dia = r.diamondId ? getDiamond(r.diamondId) : null;
    const totalKrw = (tpl?.basePriceKrw || 0) + (dia?.priceKrw || 0);
    order = {
      id: nextId("ord"), requestId: r.id, totalKrw,
      depositKrw: Math.round(totalKrw * db().settings.depositRate),
      depositPaidAt: null, finalPaidAt: null, shippingStage: null, trackingNo: null, createdAt: now(),
    };
    db().orders.push(order);
  }
  persist();
  return { request: r, order };
}

// ---------- orders & payments ----------
export function listOrders() { return [...db().orders]; }
export function getOrderByRequest(requestId) {
  return db().orders.find((o) => o.requestId === requestId) || null;
}
export function payOrder(orderId, kind, actor) {
  const order = db().orders.find((o) => o.id === orderId);
  const r = getRequest(order.requestId);
  const to = kind === "deposit" ? "DEPOSIT_PAID" : "FINAL_PAYMENT_PAID";
  assertTransition(r.status, to, actor.role);
  const amount = kind === "deposit" ? order.depositKrw : order.totalKrw - order.depositKrw;
  db().payments.push({ id: nextId("pay"), orderId, kind, provider: "mock-pg", amount, currency: "KRW", status: "paid", at: now() });
  if (kind === "deposit") order.depositPaidAt = now();
  else order.finalPaidAt = now();
  logEvent(r.id, r.status, to, actor.id);
  r.status = to;
  if (STAGE_BY_STATUS[to]) order.shippingStage = STAGE_BY_STATUS[to];
  persist();
  return order;
}
export function listPayments(customerId) {
  const reqIds = new Set(listRequests({ customerId }).map((r) => r.id));
  const orderIds = new Set(db().orders.filter((o) => reqIds.has(o.requestId)).map((o) => o.id));
  return db().payments.filter((p) => orderIds.has(p.orderId));
}
export function updateShipping(orderId, { trackingNo }) {
  const order = db().orders.find((o) => o.id === orderId);
  if (trackingNo !== undefined) order.trackingNo = trackingNo;
  persist();
}

// ---------- production media ----------
export function listProductionMedia(requestId) {
  return db().productionMedia.filter((m) => m.requestId === requestId);
}
export function addProductionMedia(requestId, media) {
  db().productionMedia.push({ id: nextId("pm"), requestId, ...media, createdAt: now() });
  persist();
}

// ---------- misc ----------
export function listEvents(refId) { return db().statusEvents.filter((e) => e.refId === refId); }
export function getSettings() { return db().settings; }
export function updateSettings(patch) { Object.assign(db().settings, patch); persist(); }
```

- [ ] **Step 5: 구독 훅** — `src/lib/useDB.js`

```js
import { useEffect, useState } from "react";
import { subscribe } from "./store.js";

// 스토어 변경 시 리렌더 트리거. 페이지는 이 훅 호출 후 store API를 직접 읽는다.
export function useDBVersion() {
  const [, setVersion] = useState(0);
  useEffect(() => subscribe(() => setVersion((v) => v + 1)), []);
}
```

- [ ] **Step 6: 전체 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS — statusMachine 7, masking 6, store 5

- [ ] **Step 7: 커밋**

```bash
git add src/lib
git commit -m "feat: mock 데이터 스토어 + 시드 + 주문 플로우 API (TDD)"
```

---

### Task 4: 라우터 도입 + 파일 재구성 (홈 분리)

**Files:**
- Create: `src/translations.js` — App.jsx의 `translations`·`localeOptions` 객체를 그대로 이동 (수정 없이 복사, `export const` 로)
- Create: `src/i18n.jsx`
- Create: `src/Layout.jsx`
- Create: `src/pages/Home.jsx` — App.jsx의 `renderLines, getLocalizedCollections, getLocalizedProducts, Hero, Collections, ProductCard, Products, Quality, Concierge` 컴포넌트와 `collectionImages, productImages` 상수를 그대로 이동
- Modify: `src/App.jsx` — 라우트 정의만 남김
- Modify: `src/main.jsx`

- [ ] **Step 1: translations 분리** — `src/translations.js`

App.jsx 상단의 `localeOptions` 배열(20-25행)과 `translations` 객체(43-368행)를 잘라내 그대로 옮기고 `export const localeOptions = ...`, `export const translations = ...` 로 내보낸다. 내용 수정 없음.

- [ ] **Step 2: LocaleProvider** — `src/i18n.jsx`

```jsx
import { createContext, useContext, useEffect, useState } from "react";
import { localeOptions, translations } from "./translations.js";

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState(() => localStorage.getItem("lumina-locale") || "ko");
  const t = translations[locale];

  useEffect(() => {
    localStorage.setItem("lumina-locale", locale);
    const option = localeOptions.find((item) => item.code === locale);
    document.documentElement.lang = option?.htmlLang ?? "en";
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
  }, [locale, t]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
```

- [ ] **Step 3: Layout (헤더/푸터 이동)** — `src/Layout.jsx`

App.jsx의 `Header`, `Footer` 컴포넌트를 옮기되 라우팅에 맞게 수정. 데스크톱/모바일 내비는 신규 라우트로 교체하고, 계정 아이콘은 역할별 분기(Task 5에서 useAuth 연결 전까지는 `/login` 고정):

```jsx
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Languages, LogOut, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { localeOptions } from "./translations.js";
import { useLocale } from "./i18n.jsx";
import { useAuth } from "./lib/auth.jsx";

// 신규 라우트 내비 (KO 우선 — 스펙 §6 노트)
const navItems = [
  { to: "/diamonds", label: "다이아몬드" },
  { to: "/templates", label: "디자인 갤러리" },
  { to: "/custom/new", label: "주문제작" },
  { to: "/guide/lab-diamond", label: "가이드" },
];

function roleHome(user) {
  if (!user) return "/login";
  if (user.role === "vendor") return "/vendor";
  if (user.role === "admin") return "/admin";
  return "/account";
}

export function Header() {
  const { locale, setLocale, t } = useLocale();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <button className="mobile-menu-button" aria-label={t.aria.openMenu} onClick={() => setOpen(true)}>
        <Menu size={22} strokeWidth={1.7} />
      </button>

      <Link className="brand" to="/" aria-label="LUMINA LAB home">LUMINA LAB</Link>

      <nav className="desktop-nav" aria-label={t.aria.primaryNav}>
        {navItems.map((item) => (
          <NavLink to={item.to} key={item.to}>{item.label}</NavLink>
        ))}
      </nav>

      <div className="header-actions">
        <label className="language-control">
          <Languages size={16} strokeWidth={1.7} aria-hidden="true" />
          <select aria-label={t.aria.language} value={locale} onChange={(e) => setLocale(e.target.value)}>
            {localeOptions.map((o) => <option value={o.code} key={o.code}>{o.label}</option>)}
          </select>
        </label>
        <button className="icon-button" aria-label={t.aria.search} onClick={() => navigate("/diamonds")}>
          <Search size={20} strokeWidth={1.7} />
        </button>
        <button className="icon-button" aria-label={t.aria.account} onClick={() => navigate(roleHome(user))}>
          <UserRound size={20} strokeWidth={1.7} />
        </button>
        {user ? (
          <button className="icon-button" aria-label="로그아웃" onClick={() => { logout(); navigate("/"); }}>
            <LogOut size={20} strokeWidth={1.7} />
          </button>
        ) : (
          <button className="icon-button" aria-label={t.aria.shoppingBag} onClick={() => navigate("/account")}>
            <ShoppingBag size={20} strokeWidth={1.7} />
          </button>
        )}
      </div>

      <div className={`mobile-panel ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <button className="icon-button close-button" aria-label={t.aria.closeMenu} onClick={() => setOpen(false)}>
          <X size={20} strokeWidth={1.7} />
        </button>
        {navItems.map((item) => (
          <NavLink to={item.to} key={item.to} onClick={() => setOpen(false)}>{item.label}</NavLink>
        ))}
        <NavLink to={roleHome(user)} onClick={() => setOpen(false)}>
          {user ? "마이페이지" : "로그인"}
        </NavLink>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useLocale();
  const footerLinks = [
    { href: "/#collections", label: t.footer.links[0] },
    { href: "/guide/lab-diamond", label: t.footer.links[1] },
    { href: "/#concierge", label: t.footer.links[2] },
    { href: "/#products", label: t.footer.links[3] },
  ];
  return (
    <footer className="footer">
      <span className="brand">LUMINA LAB</span>
      <nav aria-label={t.aria.footerNav}>
        {footerLinks.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}
      </nav>
      <span>{t.footer.copyright}</span>
    </footer>
  );
}

export default function Layout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
```

(Task 5 전까지 `useAuth` import 가 없으므로, Task 4 시점에는 `const user = null; const logout = () => {};` 스텁으로 두고 Task 5에서 교체해도 된다 — 순서대로 한 번에 작업한다면 Task 5를 먼저 머지하고 함께 커밋.)

- [ ] **Step 4: Home 페이지** — `src/pages/Home.jsx`

App.jsx의 `collectionImages, productImages, renderLines, getLocalizedCollections, getLocalizedProducts, Hero, Collections, ProductCard, Products, Quality, Concierge` 를 그대로 이동. 변경점:
- 최상단 `import { useLocale } from "../i18n.jsx";`
- `export default function Home() { const { t } = useLocale(); return (<> <Hero t={t}/> <Collections t={t}/> <Products t={t}/> <Quality t={t}/> <Concierge t={t}/> </>); }`
- Hero 의 CTA 링크 교체: `href="#collections"` → `<Link className="button primary" to="/diamonds">`, `href="#concierge"` → `<Link className="button secondary" to="/custom/new">` (`import { Link } from "react-router-dom"`)
- Quality 의 CTA: `href="#lab-diamond"` → `<Link ... to="/guide/lab-diamond">`
- Products 의 카드 CTA: `href="#concierge"` → `<Link to="/templates">`

- [ ] **Step 5: App = 라우트 정의** — `src/App.jsx` 전체 교체

```jsx
import { Route, Routes } from "react-router-dom";
import Layout from "./Layout.jsx";
import Home from "./pages/Home.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
      </Route>
    </Routes>
  );
}
```

(이후 태스크마다 라우트를 추가한다.)

- [ ] **Step 6: main.jsx**

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { LocaleProvider } from "./i18n.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import "./styles.css";
import "./platform.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 7: 검증**

Run: `npm run build` → 에러 없이 빌드. 브라우저에서 `http://127.0.0.1:5173/` 홈이 기존과 동일하게 렌더(히어로·컬렉션·베스트셀러·랩다이아·콘시어지·푸터), 언어 셀렉터 동작.

- [ ] **Step 8: 커밋** (Task 5와 함께 커밋해도 됨)

```bash
git add src && git commit -m "refactor: react-router 도입, 홈/레이아웃/i18n 분리"
```

---

### Task 5: 인증 (mock) + 로그인 페이지

**Files:**
- Create: `src/lib/auth.jsx`
- Create: `src/pages/Login.jsx`
- Modify: `src/App.jsx` (라우트 추가)

- [ ] **Step 1: AuthProvider** — `src/lib/auth.jsx`

```jsx
import { createContext, useContext, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { addUser, findUserByEmail, getUser } from "./store.js";

const SESSION_KEY = "lumina-session";
const AuthContext = createContext(null);
const DEMO_PASSWORD = "demo1234"; // mock: 모든 데모 계정 공통

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(SESSION_KEY));
  const user = userId ? getUser(userId) : null;

  function login(email, password) {
    const found = findUserByEmail(email);
    if (!found || password !== DEMO_PASSWORD) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다. (데모 비밀번호: demo1234)");
    }
    localStorage.setItem(SESSION_KEY, found.id);
    setUserId(found.id);
    return found;
  }

  function signup(name, email) {
    if (findUserByEmail(email)) throw new Error("이미 가입된 이메일입니다.");
    const created = addUser({ email, name, role: "customer" });
    localStorage.setItem(SESSION_KEY, created.id);
    setUserId(created.id);
    return created;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireRole({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 2: 로그인 페이지** — `src/pages/Login.jsx`

```jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

const DEMO_ACCOUNTS = [
  { label: "고객으로 둘러보기", email: "customer@demo.com", to: "/account" },
  { label: "벤더로 둘러보기", email: "vendor@demo.com", to: "/vendor" },
  { label: "운영자로 둘러보기", email: "admin@demo.com", to: "/admin" },
];

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const from = location.state?.from;

  function afterLogin(user) {
    if (from) return navigate(from, { replace: true });
    if (user.role === "vendor") return navigate("/vendor", { replace: true });
    if (user.role === "admin") return navigate("/admin", { replace: true });
    navigate("/account", { replace: true });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      afterLogin(mode === "login" ? login(email, password) : signup(name, email));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{mode === "login" ? "로그인" : "회원가입"}</h1>
      <form className="panel form-stack" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label className="field">
            <span>이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label className="field">
          <span>이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode === "login" && (
          <label className="field">
            <span>비밀번호</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="button primary" type="submit">
          {mode === "login" ? "로그인" : "가입하기"}
        </button>
        <button
          type="button" className="text-link"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
        >
          {mode === "login" ? "처음이신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </form>

      <div className="panel demo-panel">
        <p className="section-label">데모 계정 (비밀번호 demo1234)</p>
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.email} className="button secondary"
            onClick={() => { afterLogin(login(acc.email, "demo1234")); }}
          >
            {acc.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 라우트 추가** — App.jsx Routes 안에 `<Route path="login" element={<Login />} />`

- [ ] **Step 4: 검증**

`npm run build` 통과. 브라우저: `/login`에서 "고객으로 둘러보기" 클릭 → `/account`(아직 404 → Task 10에서 구현되므로 일단 `/`)로 이동, 헤더 계정 아이콘이 역할별 경로로 변경.

- [ ] **Step 5: 커밋**

```bash
git add src && git commit -m "feat: mock 인증(역할 3종) + 로그인/회원가입 + 데모 계정"
```

---

### Task 6: 공통 UI 컴포넌트 + platform.css

**Files:**
- Create: `src/components/ui.jsx`
- Create: `src/platform.css`

- [ ] **Step 1: UI 헬퍼** — `src/components/ui.jsx`

```jsx
// 신규 화면 공통 빌딩블록. 샘플 사진은 jewelry-lineup.png 크롭(pos) 또는 단일 이미지(src).
export const STATUS_LABELS = {
  DRAFT: "작성중", SUBMITTED: "접수됨", VENDOR_ASSIGNED: "제작팀 배정",
  PROPOSAL_UPLOADED: "시안 도착", REVISION_REQUESTED: "수정 요청됨", CONFIRMED: "시안 확정",
  DEPOSIT_PAID: "디파짓 결제완료", IN_PRODUCTION: "제작중", QUALITY_CHECK: "검수중",
  FINAL_PAYMENT_PAID: "잔금 결제완료", SHIPPED: "배송중", DELIVERED: "배송완료",
  COMPLETED: "완료", CANCELLED: "취소됨", ON_HOLD: "보류",
};

export const CATEGORY_LABELS = { ring: "링", necklace: "네크리스", earring: "이어링", bracelet: "브레이슬릿" };

export function won(n) {
  return `₩${Number(n || 0).toLocaleString("ko-KR")}`;
}

export function MediaThumb({ media, ratio = "1 / 1", alt = "" }) {
  if (!media) return <div className="media-thumb media-empty" style={{ aspectRatio: ratio }} />;
  if (media.kind === "video") {
    return <video className="media-thumb" style={{ aspectRatio: ratio }} src={media.src} muted loop autoPlay playsInline />;
  }
  if (media.pos) {
    return (
      <div
        className="media-thumb media-crop" role="img" aria-label={alt}
        style={{ backgroundImage: `url(${media.src})`, backgroundPosition: media.pos, aspectRatio: ratio }}
      />
    );
  }
  return <img className="media-thumb" style={{ aspectRatio: ratio }} src={media.src} alt={alt} />;
}

export function StatusBadge({ status }) {
  return <span className={`status-badge st-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

// steps: [{key,label}], currentIndex: 진행 인덱스 (-1이면 미시작)
export function Stepper({ steps, currentIndex }) {
  return (
    <ol className="stepper">
      {steps.map((step, i) => (
        <li key={step.key} className={i < currentIndex ? "done" : i === currentIndex ? "current" : ""}>
          <span className="dot" />
          <span className="step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function EmptyNote({ children }) {
  return <p className="empty-note">{children}</p>;
}
```

- [ ] **Step 2: 스타일** — `src/platform.css`

```css
/* ===== 신규 화면 공통 (NOIR 토큰 재사용) ===== */
.page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 120px clamp(22px, 4vw, 56px) 96px;
}
.page-narrow { max-width: 560px; }
.page-title {
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(34px, 4vw, 52px);
  margin: 0 0 12px;
}
.page-sub { color: var(--muted); margin: 0 0 42px; }

.panel {
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 28px;
}
.panel + .panel { margin-top: 18px; }
.panel h3 { margin: 0 0 16px; font-weight: 600; font-size: 16px; }

.form-stack { display: grid; gap: 16px; }
.field { display: grid; gap: 8px; font-size: 13px; color: var(--muted); }
.field input, .field select, .field textarea {
  background: var(--bg-2);
  border: 1px solid var(--line);
  color: var(--text);
  padding: 13px 14px;
  font: inherit;
}
.field textarea { min-height: 96px; resize: vertical; }
.field input:focus, .field select:focus, .field textarea:focus {
  outline: none;
  border-color: rgba(214, 197, 160, 0.6);
}
.form-error { color: #e08585; font-size: 13px; margin: 0; }
.form-hint { color: var(--quiet); font-size: 12px; margin: 0; }
.demo-panel { margin-top: 18px; display: grid; gap: 10px; }

/* 필터 칩 */
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  padding: 9px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 160ms ease;
}
.chip:hover { border-color: var(--line-strong); color: var(--text); }
.chip.is-active { background: var(--accent); border-color: var(--accent); color: #15120c; }

/* 카드 그리드 */
.card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; }
.card-grid.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.item-card {
  border: 1px solid var(--line);
  background: var(--surface);
  transition: transform 180ms ease, border-color 180ms ease;
  display: block;
}
.item-card:hover { transform: translateY(-3px); border-color: var(--line-strong); }
.item-card .card-body { padding: 16px 18px 20px; }
.item-card h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
.item-card .spec { color: var(--quiet); font-size: 12.5px; margin: 0 0 10px; }
.item-card .price { color: var(--accent-bright); font-size: 14px; margin: 0; }

.media-thumb { width: 100%; object-fit: cover; display: block; background: #050607; }
.media-crop { background-size: 500% auto; background-repeat: no-repeat; }
.media-empty { background: var(--surface-2); }

/* 상태 배지 */
.status-badge {
  display: inline-block;
  padding: 5px 11px;
  font-size: 11.5px;
  letter-spacing: 0.5px;
  border: 1px solid var(--line-strong);
  color: var(--muted);
  white-space: nowrap;
}
.st-PROPOSAL_UPLOADED, .st-CONFIRMED { border-color: rgba(214,197,160,.65); color: var(--accent-bright); }
.st-DEPOSIT_PAID, .st-IN_PRODUCTION, .st-QUALITY_CHECK, .st-FINAL_PAYMENT_PAID, .st-SHIPPED { border-color: rgba(150,190,255,.4); color: #b9d2f5; }
.st-DELIVERED, .st-COMPLETED { border-color: rgba(140,210,160,.4); color: #aee0bd; }
.st-CANCELLED, .st-ON_HOLD { border-color: rgba(224,133,133,.4); color: #e0a5a5; }

/* 스텝퍼 (배송/위저드 공용) */
.stepper { list-style: none; display: flex; gap: 0; margin: 18px 0 0; padding: 0; }
.stepper li { flex: 1; position: relative; text-align: center; color: var(--quiet); font-size: 12px; }
.stepper .dot {
  display: block; width: 10px; height: 10px; border-radius: 50%;
  background: var(--surface-2); border: 1px solid var(--line-strong);
  margin: 0 auto 8px; position: relative; z-index: 1;
}
.stepper li::before {
  content: ""; position: absolute; top: 5px; left: -50%; right: 50%;
  height: 1px; background: var(--line);
}
.stepper li:first-child::before { display: none; }
.stepper li.done .dot, .stepper li.current .dot { background: var(--accent); border-color: var(--accent); }
.stepper li.done, .stepper li.current { color: var(--text); }

/* 테이블 (어드민) */
.data-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.data-table th, .data-table td { padding: 12px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
.data-table th { color: var(--quiet); font-weight: 500; font-size: 12px; letter-spacing: 1px; }
.data-table input, .data-table select {
  background: var(--bg-2); border: 1px solid var(--line); color: var(--text);
  padding: 7px 9px; font: inherit; font-size: 13px;
}
.data-table input[type="number"] { width: 110px; }

/* 탭 */
.tab-row { display: flex; gap: 6px; border-bottom: 1px solid var(--line); margin-bottom: 28px; flex-wrap: wrap; }
.tab-row button {
  background: none; padding: 13px 18px; color: var(--muted); font-size: 14px; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab-row button.is-active { color: var(--text); border-bottom-color: var(--accent); }

/* 시안 카드 */
.proposal-card { border: 1px solid var(--line); background: var(--surface); padding: 22px; }
.proposal-card + .proposal-card { margin-top: 16px; }
.proposal-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
.proposal-media { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.proposal-comment { color: var(--muted); font-size: 13.5px; margin: 14px 0 0; line-height: 1.6; }
.feedback-note { border-left: 2px solid var(--accent); padding: 10px 14px; margin-top: 14px; color: var(--muted); font-size: 13px; background: var(--bg-2); }

/* 어드민 셸 */
.admin-shell { display: grid; grid-template-columns: 200px 1fr; gap: 36px; }
.admin-side { display: grid; gap: 2px; align-content: start; position: sticky; top: 110px; }
.admin-side a { padding: 11px 14px; color: var(--muted); font-size: 14px; border-left: 2px solid transparent; }
.admin-side a.active { color: var(--text); border-left-color: var(--accent); background: var(--surface); }

.row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.button.small { min-height: 38px; padding: 0 16px; font-size: 12px; }
.button.danger { border: 1px solid rgba(224,133,133,.5); background: transparent; color: #e0a5a5; }

.empty-note { color: var(--quiet); padding: 36px 0; text-align: center; }
.warn-note { color: #e8c07a; font-size: 13px; }

.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
.summary-card { border: 1px solid var(--line); background: var(--surface); padding: 20px; }
.summary-card .num { font-size: 30px; font-family: var(--serif); color: var(--accent-bright); }
.summary-card .lbl { font-size: 12px; color: var(--quiet); margin-top: 4px; }

@media (max-width: 1120px) {
  .card-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .card-grid.cols-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .admin-shell { grid-template-columns: 1fr; }
  .admin-side { position: static; display: flex; flex-wrap: wrap; }
  .summary-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width: 760px) {
  .page { padding: 96px 18px 72px; }
  .card-grid, .card-grid.cols-3 { grid-template-columns: 1fr 1fr; }
  .proposal-media { grid-template-columns: 1fr 1fr; }
  .data-table { display: block; overflow-x: auto; }
  .stepper { flex-wrap: wrap; row-gap: 14px; }
  .stepper li { min-width: 33%; }
}
```

- [ ] **Step 3: 검증 + 커밋**

`npm run build` 통과 후:

```bash
git add src && git commit -m "feat: 플랫폼 공통 UI 컴포넌트 + 스타일"
```

---

### Task 7: 다이아몬드 검색 + 상세

**Files:**
- Create: `src/pages/Diamonds.jsx`
- Create: `src/pages/DiamondDetail.jsx`
- Modify: `src/App.jsx` (라우트 2개 추가)

- [ ] **Step 1: 검색 페이지** — `src/pages/Diamonds.jsx`

```jsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listDiamonds } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, won } from "../components/ui.jsx";

const SHAPES = ["라운드", "오벌", "프린세스", "에메랄드", "페어", "마퀴즈", "쿠션", "래디언트", "아셔", "하트"];
const COLORS = ["D", "E", "F", "G", "H"];
const CLARITIES = ["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"];
const CUTS = ["Excellent", "Very Good", "Good"];
const CERTS = ["IGI", "GIA"];
const SORTS = [
  { key: "price-asc", label: "가격 낮은순", fn: (a, b) => a.priceKrw - b.priceKrw },
  { key: "price-desc", label: "가격 높은순", fn: (a, b) => b.priceKrw - a.priceKrw },
  { key: "carat-desc", label: "캐럿 높은순", fn: (a, b) => b.carat - a.carat },
];

const initialFilters = { shape: null, caratMin: "", caratMax: "", priceMax: "", cut: "", color: "", clarity: "", cert: "" };

export default function Diamonds() {
  useDBVersion();
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState("price-asc");
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const results = useMemo(() => {
    let list = listDiamonds();
    if (filters.shape) list = list.filter((d) => d.shape === filters.shape);
    if (filters.caratMin) list = list.filter((d) => d.carat >= Number(filters.caratMin));
    if (filters.caratMax) list = list.filter((d) => d.carat <= Number(filters.caratMax));
    if (filters.priceMax) list = list.filter((d) => d.priceKrw <= Number(filters.priceMax));
    if (filters.cut) list = list.filter((d) => d.cut === filters.cut);
    if (filters.color) list = list.filter((d) => d.color === filters.color);
    if (filters.clarity) list = list.filter((d) => d.clarity === filters.clarity);
    if (filters.cert) list = list.filter((d) => d.certOrg === filters.cert);
    return [...list].sort(SORTS.find((s) => s.key === sort).fn);
  }, [filters, sort]);

  return (
    <div className="page">
      <h1 className="page-title">다이아몬드</h1>
      <p className="page-sub">전 스톤 IGI·GIA 인증 랩그로운 다이아몬드. 운영팀이 직접 검수한 미디어로 확인하세요.</p>

      <div className="panel form-stack">
        <div className="chip-row" role="group" aria-label="쉐입 필터">
          {SHAPES.map((s) => (
            <button key={s} className={`chip ${filters.shape === s ? "is-active" : ""}`}
              onClick={() => set({ shape: filters.shape === s ? null : s })}>{s}</button>
          ))}
        </div>
        <div className="filter-grid">
          <label className="field"><span>캐럿 min</span>
            <input type="number" step="0.1" value={filters.caratMin} onChange={(e) => set({ caratMin: e.target.value })} /></label>
          <label className="field"><span>캐럿 max</span>
            <input type="number" step="0.1" value={filters.caratMax} onChange={(e) => set({ caratMax: e.target.value })} /></label>
          <label className="field"><span>최대 가격(₩)</span>
            <input type="number" step="100000" value={filters.priceMax} onChange={(e) => set({ priceMax: e.target.value })} /></label>
          <label className="field"><span>컷</span>
            <select value={filters.cut} onChange={(e) => set({ cut: e.target.value })}>
              <option value="">전체</option>{CUTS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>컬러</span>
            <select value={filters.color} onChange={(e) => set({ color: e.target.value })}>
              <option value="">전체</option>{COLORS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>클래리티</span>
            <select value={filters.clarity} onChange={(e) => set({ clarity: e.target.value })}>
              <option value="">전체</option>{CLARITIES.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>인증</span>
            <select value={filters.cert} onChange={(e) => set({ cert: e.target.value })}>
              <option value="">전체</option>{CERTS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>정렬</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></label>
        </div>
        <button className="text-link" onClick={() => setFilters(initialFilters)}>필터 초기화</button>
      </div>

      <p className="page-sub" style={{ margin: "26px 0 18px" }}>{results.length}개 스톤</p>
      {results.length === 0 ? (
        <p className="empty-note">조건에 맞는 다이아몬드가 없습니다.</p>
      ) : (
        <div className="card-grid">
          {results.map((d) => (
            <Link className="item-card" to={`/diamonds/${d.id}`} key={d.id}>
              <MediaThumb media={d.media[0]} alt={`${d.shape} ${d.carat}ct`} />
              <div className="card-body">
                <h3>{d.shape} {d.carat.toFixed(1)}ct</h3>
                <p className="spec">{d.cut} · {d.color} · {d.clarity} · {d.certOrg}</p>
                <p className="price">{won(d.priceKrw)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

platform.css에 추가:

```css
.filter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 1120px) { .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
```

- [ ] **Step 2: 상세 페이지** — `src/pages/DiamondDetail.jsx`

```jsx
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDiamond } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, won } from "../components/ui.jsx";

export default function DiamondDetail() {
  useDBVersion();
  const { id } = useParams();
  const diamond = getDiamond(id);
  const [active, setActive] = useState(0);

  if (!diamond || !diamond.visible) {
    return <div className="page"><p className="empty-note">해당 다이아몬드를 찾을 수 없습니다.</p></div>;
  }

  const specs = [
    ["쉐입", diamond.shape], ["캐럿", `${diamond.carat.toFixed(2)}ct`],
    ["컷", diamond.cut], ["컬러", diamond.color], ["클래리티", diamond.clarity],
    ["인증기관", diamond.certOrg], ["인증번호", diamond.certNo],
  ];

  return (
    <div className="page detail-layout">
      <div className="detail-media">
        <MediaThumb media={diamond.media[active]} alt={`${diamond.shape} ${diamond.carat}ct`} />
        {diamond.media.length > 1 && (
          <div className="thumb-row">
            {diamond.media.map((m, i) => (
              <button key={i} className={`thumb-btn ${i === active ? "is-active" : ""}`} onClick={() => setActive(i)}>
                <MediaThumb media={m} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="detail-info">
        <h1 className="page-title">{diamond.shape} {diamond.carat.toFixed(1)}ct</h1>
        <p className="price detail-price">{won(diamond.priceKrw)}</p>

        <table className="data-table">
          <tbody>
            {specs.map(([k, v]) => (
              <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>

        <p className="form-hint" style={{ marginTop: 14 }}>
          인증서 원본은 제작 확정 후 실물과 함께 제공됩니다. ({diamond.certOrg} {diamond.certNo})
        </p>

        <div className="hero-ctas" style={{ justifyContent: "flex-start" }}>
          <Link className="button primary" to={`/custom/new?diamond=${diamond.id}`}>
            이 다이아몬드로 주문제작
          </Link>
          <Link className="button secondary" to="/diamonds">목록으로</Link>
        </div>
      </div>
    </div>
  );
}
```

platform.css에 추가:

```css
.detail-layout { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 48px; align-items: start; }
.detail-price { font-size: 24px; margin: 0 0 26px; }
.thumb-row { display: flex; gap: 10px; margin-top: 12px; }
.thumb-btn { width: 84px; padding: 0; background: none; border: 1px solid var(--line); cursor: pointer; }
.thumb-btn.is-active { border-color: var(--accent); }
@media (max-width: 1120px) { .detail-layout { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: 라우트 추가** — App.jsx에

```jsx
<Route path="diamonds" element={<Diamonds />} />
<Route path="diamonds/:id" element={<DiamondDetail />} />
```

- [ ] **Step 4: 검증 + 커밋**

`npm run build` 통과. 브라우저 `/diamonds`: 12개 카드, 쉐입 칩 "라운드" → 3개, 정렬 변경 동작. `/diamonds/d-1`: 영상 썸네일 전환, 4C 테이블, CTA.

```bash
git add src && git commit -m "feat: 다이아몬드 검색(필터/정렬) + 상세 페이지"
```

---

### Task 8: 템플릿 갤러리

**Files:**
- Create: `src/pages/Templates.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 페이지** — `src/pages/Templates.jsx`

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { listTemplates } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { CATEGORY_LABELS, MediaThumb, won } from "../components/ui.jsx";

const CATEGORIES = ["all", "ring", "necklace", "earring", "bracelet"];

export default function Templates() {
  useDBVersion();
  const [category, setCategory] = useState("all");
  const templates = listTemplates().filter((t) => category === "all" || t.category === category);

  return (
    <div className="page">
      <h1 className="page-title">디자인 갤러리</h1>
      <p className="page-sub">LUMINA LAB이 준비한 샘플 디자인. 원하는 디자인을 골라 나만의 주얼리로 주문제작하세요.</p>

      <div className="chip-row" style={{ marginBottom: 30 }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${category === c ? "is-active" : ""}`} onClick={() => setCategory(c)}>
            {c === "all" ? "전체" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="card-grid cols-3">
        {templates.map((t) => (
          <Link className="item-card" to={`/custom/new?template=${t.id}`} key={t.id}>
            <MediaThumb media={t.media[0]} ratio="1 / 1.05" alt={t.name} />
            <div className="card-body">
              <h3>{t.name}</h3>
              <p className="spec">{CATEGORY_LABELS[t.category]} · {t.desc}</p>
              <p className="price">{t.basePriceKrw > 0 ? `세팅 ${won(t.basePriceKrw)}~` : "견적 문의"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 라우트** — `<Route path="templates" element={<Templates />} />`

- [ ] **Step 3: 검증 + 커밋**

브라우저 `/templates`: 6개 카드 + 카테고리 필터 동작, 카드 클릭 시 `/custom/new?template=t-1` 이동.

```bash
git add src && git commit -m "feat: 템플릿(샘플 디자인) 갤러리"
```

---

### Task 9: 커스텀 주문 위저드 (4단계)

**Files:**
- Create: `src/pages/CustomWizard.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 위저드** — `src/pages/CustomWizard.jsx`

```jsx
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { createRequest, getDiamond, getTemplate, listDiamonds, listTemplates } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { CATEGORY_LABELS, MediaThumb, Stepper, won } from "../components/ui.jsx";

const STEPS = [
  { key: "template", label: "① 디자인" },
  { key: "diamond", label: "② 다이아몬드" },
  { key: "details", label: "③ 세부사항" },
  { key: "review", label: "④ 검토·제출" },
];
const METALS = ["18K 화이트골드", "18K 옐로골드", "18K 로즈골드", "플래티넘 PT950"];

export default function CustomWizard() {
  useDBVersion();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState(params.get("template"));
  const [diamondId, setDiamondId] = useState(params.get("diamond"));
  const [details, setDetails] = useState({ metal: METALS[0], size: "", engraving: "", budget: "", notes: "" });
  const setD = (patch) => setDetails((d) => ({ ...d, ...patch }));

  const template = templateId ? getTemplate(templateId) : null;
  const diamond = diamondId ? getDiamond(diamondId) : null;
  const estimate = (template?.basePriceKrw || 0) + (diamond?.priceKrw || 0);

  function submit() {
    if (!user) return navigate("/login", { state: { from: "/custom/new" } });
    const request = createRequest({ customerId: user.id, templateId, diamondId, details: { ...details, budget: Number(details.budget) || null } });
    navigate(`/account/requests/${request.id}`, { state: { submitted: true } });
  }

  return (
    <div className="page">
      <h1 className="page-title">주문제작</h1>
      <p className="page-sub">디자인과 스톤을 고르면 전담 제작팀이 시안(사진·영상)으로 먼저 보여드립니다. 컨펌 전에는 결제가 없습니다.</p>
      <Stepper steps={STEPS} currentIndex={step} />

      {step === 0 && (
        <section style={{ marginTop: 38 }}>
          <div className="card-grid cols-3">
            {listTemplates().map((t) => (
              <button key={t.id} className={`item-card select-card ${templateId === t.id ? "is-selected" : ""}`} onClick={() => setTemplateId(t.id)}>
                <MediaThumb media={t.media[0]} ratio="1 / 1.05" alt={t.name} />
                <div className="card-body">
                  <h3>{t.name}</h3>
                  <p className="spec">{CATEGORY_LABELS[t.category]}</p>
                  <p className="price">{t.basePriceKrw > 0 ? `세팅 ${won(t.basePriceKrw)}~` : "견적 문의"}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="wizard-nav">
            <span />
            <button className="button primary" disabled={!templateId} onClick={() => setStep(1)}>다음</button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section style={{ marginTop: 38 }}>
          <p className="form-hint">스톤을 아직 못 정하셨다면 건너뛰어도 됩니다 — 예산에 맞는 스톤을 시안과 함께 제안해드립니다.</p>
          <div className="card-grid" style={{ marginTop: 18 }}>
            {listDiamonds().map((d) => (
              <button key={d.id} className={`item-card select-card ${diamondId === d.id ? "is-selected" : ""}`}
                onClick={() => setDiamondId(diamondId === d.id ? null : d.id)}>
                <MediaThumb media={d.media[0]} alt={`${d.shape} ${d.carat}ct`} />
                <div className="card-body">
                  <h3>{d.shape} {d.carat.toFixed(1)}ct</h3>
                  <p className="spec">{d.cut} · {d.color} · {d.clarity} · {d.certOrg}</p>
                  <p className="price">{won(d.priceKrw)}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="wizard-nav">
            <button className="button secondary" onClick={() => setStep(0)}>이전</button>
            <button className="button primary" onClick={() => setStep(2)}>{diamondId ? "다음" : "스톤 없이 다음"}</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel form-stack" style={{ marginTop: 38, maxWidth: 560 }}>
          <label className="field"><span>메탈</span>
            <select value={details.metal} onChange={(e) => setD({ metal: e.target.value })}>
              {METALS.map((m) => <option key={m}>{m}</option>)}
            </select></label>
          <label className="field"><span>사이즈 (호수/길이)</span>
            <input value={details.size} onChange={(e) => setD({ size: e.target.value })} placeholder="예: 11호 / 42cm" /></label>
          <label className="field"><span>각인 (선택)</span>
            <input value={details.engraving} onChange={(e) => setD({ engraving: e.target.value })} maxLength={20} /></label>
          <label className="field"><span>예산 (₩, 선택)</span>
            <input type="number" step="100000" value={details.budget} onChange={(e) => setD({ budget: e.target.value })} /></label>
          <label className="field"><span>요청사항</span>
            <textarea value={details.notes} onChange={(e) => setD({ notes: e.target.value })}
              placeholder="원하는 디테일을 적어주세요. (연락처·외부 링크는 자동 차단됩니다)" /></label>
          <div className="wizard-nav">
            <button className="button secondary" onClick={() => setStep(1)}>이전</button>
            <button className="button primary" disabled={!details.size} onClick={() => setStep(3)}>다음</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="panel" style={{ marginTop: 38, maxWidth: 640 }}>
          <h3>주문 요약</h3>
          <table className="data-table"><tbody>
            <tr><th>디자인</th><td>{template?.name}</td></tr>
            <tr><th>다이아몬드</th><td>{diamond ? `${diamond.shape} ${diamond.carat.toFixed(1)}ct ${diamond.color}/${diamond.clarity} (${won(diamond.priceKrw)})` : "제작팀 추천 요청"}</td></tr>
            <tr><th>메탈/사이즈</th><td>{details.metal} / {details.size}</td></tr>
            {details.engraving && <tr><th>각인</th><td>{details.engraving}</td></tr>}
            {details.budget && <tr><th>예산</th><td>{won(details.budget)}</td></tr>}
            {details.notes && <tr><th>요청사항</th><td>{details.notes}</td></tr>}
            <tr><th>예상 시작가</th><td className="price">{estimate > 0 ? `${won(estimate)}~` : "시안과 함께 견적 제공"}</td></tr>
          </tbody></table>
          <p className="form-hint" style={{ marginTop: 14 }}>
            제출 후 제작팀이 시안을 올리면 알림이 표시됩니다. 시안 컨펌 시 디파짓(30%) 결제로 제작이 시작됩니다.
          </p>
          <div className="wizard-nav">
            <button className="button secondary" onClick={() => setStep(2)}>이전</button>
            {user
              ? <button className="button primary" onClick={submit}>주문 제출</button>
              : <Link className="button primary" to="/login" state={{ from: "/custom/new" }}>로그인 후 제출</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
```

platform.css에 추가:

```css
.select-card { text-align: left; cursor: pointer; padding: 0; }
.select-card.is-selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.wizard-nav { display: flex; justify-content: space-between; margin-top: 30px; gap: 12px; }
```

- [ ] **Step 2: 라우트** — `<Route path="custom/new" element={<CustomWizard />} />`

- [ ] **Step 3: 검증 + 커밋**

브라우저: `/templates`에서 카드 클릭 → 위저드 1단계에 해당 템플릿 선택됨 → 4단계까지 진행, 비로그인 제출 시 `/login` 경유. 데모 고객 로그인 후 제출 → `/account/requests/req-…` 로 이동(Task 10 전까지 404 — 정상).

```bash
git add src && git commit -m "feat: 커스텀 주문 4단계 위저드"
```

---

### Task 10: 마이페이지 + 시안 검토/결제/배송 추적

**Files:**
- Create: `src/pages/Account.jsx`
- Create: `src/pages/RequestDetail.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 마이페이지** — `src/pages/Account.jsx`

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { getTemplate, listPayments, listRequests } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote, StatusBadge, won } from "../components/ui.jsx";

const TABS = [
  { key: "orders", label: "주문제작 현황" },
  { key: "payments", label: "결제 내역" },
  { key: "profile", label: "프로필" },
];

export default function Account() {
  useDBVersion();
  const { user } = useAuth();
  const [tab, setTab] = useState("orders");
  const requests = listRequests({ customerId: user.id });
  const payments = listPayments(user.id);

  return (
    <div className="page">
      <h1 className="page-title">마이페이지</h1>
      <p className="page-sub">{user.name}님, 환영합니다.</p>

      <div className="tab-row">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "is-active" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "orders" && (
        requests.length === 0 ? (
          <EmptyNote>아직 주문이 없습니다. <Link className="text-link" to="/templates">디자인 갤러리</Link>에서 시작해보세요.</EmptyNote>
        ) : (
          <table className="data-table">
            <thead><tr><th>주문번호</th><th>디자인</th><th>상태</th><th>접수일</th><th /></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{getTemplate(r.templateId)?.name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.createdAt.slice(0, 10)}</td>
                  <td><Link className="text-link" to={`/account/requests/${r.id}`}>상세 보기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "payments" && (
        payments.length === 0 ? <EmptyNote>결제 내역이 없습니다.</EmptyNote> : (
          <table className="data-table">
            <thead><tr><th>일시</th><th>구분</th><th>금액</th><th>상태</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.at.slice(0, 10)}</td>
                  <td>{p.kind === "deposit" ? "디파짓" : "잔금"}</td>
                  <td>{won(p.amount)}</td>
                  <td>{p.status === "paid" ? "결제 완료" : p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === "profile" && (
        <div className="panel" style={{ maxWidth: 480 }}>
          <table className="data-table"><tbody>
            <tr><th>이름</th><td>{user.name}</td></tr>
            <tr><th>이메일</th><td>{user.email}</td></tr>
            <tr><th>역할</th><td>고객</td></tr>
          </tbody></table>
          <p className="form-hint" style={{ marginTop: 12 }}>배송지·연락처는 결제 단계에서 입력받습니다 (제작팀에는 공유되지 않습니다).</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 시안 검토 상세** — `src/pages/RequestDetail.jsx`

```jsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { canTransition } from "../lib/statusMachine.js";
import {
  addFeedback, getDiamond, getOrderByRequest, getRequest, getSettings, getTemplate,
  listFeedback, listProductionMedia, listProposals, payOrder, transitionRequest,
} from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote, MediaThumb, StatusBadge, Stepper, won } from "../components/ui.jsx";

const REVISION_CHOICES = ["사이즈 조정", "스톤 위치 변경", "밴드 두께", "컬러 톤", "각인 위치"];

function FeedbackForm({ proposal, actor }) {
  const [decision, setDecision] = useState("confirm");
  const [choices, setChoices] = useState([]);
  const [comment, setComment] = useState("");

  function toggle(choice) {
    setChoices((c) => (c.includes(choice) ? c.filter((x) => x !== choice) : [...c, choice]));
  }
  function submit(e) {
    e.preventDefault();
    addFeedback(proposal.id, { decision, choices, comment }, actor);
  }

  return (
    <form className="form-stack" style={{ marginTop: 18 }} onSubmit={submit}>
      <div className="chip-row">
        <button type="button" className={`chip ${decision === "confirm" ? "is-active" : ""}`} onClick={() => setDecision("confirm")}>이 시안으로 확정</button>
        <button type="button" className={`chip ${decision === "revise" ? "is-active" : ""}`} onClick={() => setDecision("revise")}>수정 요청</button>
      </div>
      {decision === "revise" && (
        <>
          <div className="chip-row">
            {REVISION_CHOICES.map((c) => (
              <button type="button" key={c} className={`chip ${choices.includes(c) ? "is-active" : ""}`} onClick={() => toggle(c)}>{c}</button>
            ))}
          </div>
          <label className="field"><span>상세 요청 (연락처·링크 자동 차단)</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        </>
      )}
      <button className="button primary" type="submit">
        {decision === "confirm" ? "시안 확정하기" : "수정 요청 보내기"}
      </button>
    </form>
  );
}

export default function RequestDetail() {
  useDBVersion();
  const { id } = useParams();
  const { user } = useAuth();
  const request = getRequest(id);

  if (!request || request.customerId !== user.id) {
    return <div className="page"><EmptyNote>주문을 찾을 수 없습니다.</EmptyNote></div>;
  }

  const template = getTemplate(request.templateId);
  const diamond = request.diamondId ? getDiamond(request.diamondId) : null;
  const proposals = [...listProposals(request.id)].reverse(); // 최신 먼저
  const order = getOrderByRequest(request.id);
  const settings = getSettings();
  const productionMedia = listProductionMedia(request.id);
  const stages = settings.shippingStages.map((s) => ({ key: s, label: s }));
  const stageIndex = order?.shippingStage ? settings.shippingStages.indexOf(order.shippingStage) : -1;
  const latest = proposals[0];

  return (
    <div className="page">
      <h1 className="page-title">주문 {request.code}</h1>
      <p className="page-sub">
        {template?.name} · {request.details.metal} · {request.details.size}
        {diamond && <> · {diamond.shape} {diamond.carat.toFixed(1)}ct</>}
        &nbsp;<StatusBadge status={request.status} />
      </p>

      {/* 결제 카드 */}
      {order && request.status === "CONFIRMED" && (
        <div className="panel pay-panel">
          <h3>디파짓 결제</h3>
          <table className="data-table"><tbody>
            <tr><th>총 제작금액</th><td>{won(order.totalKrw)}</td></tr>
            <tr><th>디파짓 ({Math.round(settings.depositRate * 100)}%)</th><td className="price">{won(order.depositKrw)}</td></tr>
          </tbody></table>
          <button className="button primary" style={{ marginTop: 16 }} onClick={() => payOrder(order.id, "deposit", user)}>
            {won(order.depositKrw)} 결제하기 (모의 결제)
          </button>
          <p className="form-hint" style={{ marginTop: 10 }}>실서비스에서는 Stripe 결제창으로 연결됩니다.</p>
        </div>
      )}
      {order && request.status === "QUALITY_CHECK" && (
        <div className="panel pay-panel">
          <h3>잔금 결제</h3>
          <p className="form-hint">검수가 진행 중입니다. 잔금 결제 후 배송이 시작됩니다.</p>
          <button className="button primary" style={{ marginTop: 12 }} onClick={() => payOrder(order.id, "final", user)}>
            잔금 {won(order.totalKrw - order.depositKrw)} 결제하기 (모의 결제)
          </button>
        </div>
      )}

      {/* 배송 추적 */}
      {order && stageIndex >= 0 && (
        <div className="panel">
          <h3>제작·배송 단계</h3>
          <Stepper steps={stages} currentIndex={stageIndex} />
          {order.trackingNo && <p className="form-hint" style={{ marginTop: 14 }}>운송장: {order.trackingNo}</p>}
          {request.status === "DELIVERED" && (
            <button className="button primary small" style={{ marginTop: 16 }} onClick={() => transitionRequest(request.id, "COMPLETED", user)}>
              수령 확인
            </button>
          )}
        </div>
      )}

      {/* 제작 과정 사진 */}
      {productionMedia.length > 0 && (
        <div className="panel">
          <h3>제작 과정</h3>
          <div className="proposal-media">
            {productionMedia.map((m) => <MediaThumb key={m.id} media={m} alt="제작 과정" />)}
          </div>
        </div>
      )}

      {/* 시안 목록 */}
      <h3 style={{ margin: "36px 0 14px" }}>시안 ({proposals.length})</h3>
      {proposals.length === 0 && (
        <EmptyNote>제작팀이 시안을 준비하고 있습니다. 시안이 올라오면 여기에서 확인·컨펌할 수 있습니다.</EmptyNote>
      )}
      {proposals.map((p) => {
        const fbs = listFeedback(p.id);
        return (
          <article className="proposal-card" key={p.id}>
            <div className="proposal-head">
              <strong>시안 v{p.version}</strong>
              <span className="form-hint">{p.createdAt.slice(0, 10)}</span>
            </div>
            <div className="proposal-media">
              {p.media.map((m, i) => <MediaThumb key={i} media={m} alt={`시안 v${p.version}`} />)}
            </div>
            {p.comment && <p className="proposal-comment">{p.comment}</p>}
            {fbs.map((f) => (
              <div className="feedback-note" key={f.id}>
                {f.decision === "confirm" ? "✓ 확정함" : `수정 요청: ${f.choices.join(", ")}`}
                {f.comment && ` — ${f.comment}`}
              </div>
            ))}
            {p.id === latest?.id && request.status === "PROPOSAL_UPLOADED" && (
              <FeedbackForm proposal={p} actor={user} />
            )}
          </article>
        );
      })}

      {/* 취소 */}
      {canTransition(request.status, "CANCELLED", "customer") && (
        <button
          className="button danger small" style={{ marginTop: 32 }}
          onClick={() => { if (confirm("주문을 취소할까요?")) transitionRequest(request.id, "CANCELLED", user); }}
        >
          주문 취소
        </button>
      )}
    </div>
  );
}
```

platform.css에 추가:

```css
.pay-panel { border-color: rgba(214, 197, 160, 0.5); }
```

- [ ] **Step 3: 라우트** — App.jsx

```jsx
<Route path="account" element={<RequireRole role="customer"><Account /></RequireRole>} />
<Route path="account/requests/:id" element={<RequireRole role="customer"><RequestDetail /></RequireRole>} />
```

(`import { RequireRole } from "./lib/auth.jsx";`)

- [ ] **Step 4: 검증 + 커밋**

데모 고객 로그인 → `/account`에 시드 주문 #1001 (시안 도착) 표시 → 상세에서 시안 v1 + 컨펌/수정요청 폼 → "수정 요청" 제출 시 상태가 "수정 요청됨"으로 변경. localStorage 초기화(`localStorage.clear()`) 후 재시도해 "이 시안으로 확정" → 디파짓 카드 → 모의 결제 → 배송 스텝퍼 확인.

```bash
git add src && git commit -m "feat: 마이페이지 + 시안 검토 루프 + 모의 결제 + 배송 추적"
```

---

### Task 11: 벤더 포털 (익명 큐 + 시안 업로드)

**Files:**
- Modify: `src/components/ui.jsx` (MediaPicker 추가)
- Create: `src/pages/vendor/VendorQueue.jsx`
- Create: `src/pages/vendor/VendorRequest.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: MediaPicker** — `src/components/ui.jsx`에 추가

```jsx
import { useState } from "react"; // 파일 상단에 추가

// 샘플 라이브러리(영구 저장) + 파일 업로드(dataURL, 데모용 2MB 제한)
const SAMPLE_LIBRARY = [
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "0% center", label: "솔리테어 링" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "24% center", label: "밴드 링" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "50% center", label: "펜던트" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "72% center", label: "스터드" },
  { kind: "image", src: "/assets/jewelry-lineup.png", pos: "100% center", label: "브레이슬릿" },
  { kind: "image", src: "/assets/lab-diamond-tweezers.png", label: "루스 스톤" },
  { kind: "video", src: "/assets/diamond-noir-white.mp4", label: "스톤 영상" },
];

export function MediaPicker({ value, onChange }) {
  const [error, setError] = useState("");

  function toggleSample(item) {
    const exists = value.some((m) => m.src === item.src && m.pos === item.pos);
    onChange(exists ? value.filter((m) => !(m.src === item.src && m.pos === item.pos)) : [...value, item]);
  }
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("데모에서는 2MB 이하 이미지만 업로드할 수 있습니다."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = () => onChange([...value, { kind: "image", src: reader.result }]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="form-stack">
      <p className="form-hint">샘플 라이브러리에서 선택하거나 파일을 업로드하세요 ({value.length}개 선택됨)</p>
      <div className="picker-grid">
        {SAMPLE_LIBRARY.map((item, i) => {
          const selected = value.some((m) => m.src === item.src && m.pos === item.pos);
          return (
            <button type="button" key={i} className={`picker-cell ${selected ? "is-selected" : ""}`} onClick={() => toggleSample(item)}>
              <MediaThumb media={item} alt={item.label} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <label className="field"><span>파일 업로드 (이미지, 2MB 이하)</span>
        <input type="file" accept="image/*" onChange={handleFile} /></label>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
```

platform.css에 추가:

```css
.picker-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.picker-cell { background: none; border: 1px solid var(--line); padding: 0 0 6px; cursor: pointer; font-size: 11px; color: var(--quiet); display: grid; gap: 5px; }
.picker-cell.is-selected { border-color: var(--accent); color: var(--text); }
@media (max-width: 1120px) { .picker-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
```

- [ ] **Step 2: 요청 큐** — `src/pages/vendor/VendorQueue.jsx`

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { anonymizeForVendor, getTemplate, listRequests } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, StatusBadge } from "../../components/ui.jsx";

const TABS = [
  { key: "new", label: "응답 대기", statuses: ["VENDOR_ASSIGNED", "REVISION_REQUESTED"] },
  { key: "waiting", label: "고객 검토중", statuses: ["PROPOSAL_UPLOADED"] },
  { key: "production", label: "제작·검수", statuses: ["DEPOSIT_PAID", "IN_PRODUCTION", "QUALITY_CHECK", "FINAL_PAYMENT_PAID", "SHIPPED"] },
  { key: "done", label: "완료", statuses: ["CONFIRMED", "DELIVERED", "COMPLETED", "CANCELLED"] },
];

export function hoursSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

export default function VendorQueue() {
  useDBVersion();
  const { user } = useAuth();
  const [tab, setTab] = useState("new");
  const tabDef = TABS.find((t) => t.key === tab);
  const requests = listRequests({ vendorId: user.id })
    .filter((r) => tabDef.statuses.includes(r.status))
    .map(anonymizeForVendor); // PII 제거 — 벤더는 익명 주문만 본다

  return (
    <div className="page">
      <h1 className="page-title">벤더 포털</h1>
      <p className="page-sub">{user.name} — 배정된 주문만 표시됩니다. 고객 정보는 익명 처리됩니다.</p>

      <div className="tab-row">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "is-active" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {requests.length === 0 ? <EmptyNote>해당 상태의 주문이 없습니다.</EmptyNote> : (
        <table className="data-table">
          <thead><tr><th>주문</th><th>디자인</th><th>상태</th><th>경과</th><th /></tr></thead>
          <tbody>
            {requests.map((r) => {
              const waitingHours = r.assignedAt ? hoursSince(r.assignedAt) : 0;
              const slaWarn = (r.status === "VENDOR_ASSIGNED" || r.status === "REVISION_REQUESTED") && waitingHours >= 48;
              return (
                <tr key={r.id}>
                  <td>{r.customerLabel}</td>
                  <td>{getTemplate(r.templateId)?.name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className={slaWarn ? "warn-note" : ""}>{waitingHours}시간{slaWarn ? " ⚠ SLA 초과" : ""}</td>
                  <td><Link className="text-link" to={`/vendor/requests/${r.id}`}>작업하기</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 벤더 주문 상세** — `src/pages/vendor/VendorRequest.jsx`

```jsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import {
  addProductionMedia, addProposal, anonymizeForVendor, getDiamond, getRequest,
  getTemplate, listFeedback, listProductionMedia, listProposals, transitionRequest,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb, StatusBadge, won } from "../../components/ui.jsx";

const UPLOADABLE = ["VENDOR_ASSIGNED", "REVISION_REQUESTED"];

export default function VendorRequest() {
  useDBVersion();
  const { id } = useParams();
  const { user } = useAuth();
  const raw = getRequest(id);
  const [media, setMedia] = useState([]);
  const [comment, setComment] = useState("");
  const [prodMedia, setProdMedia] = useState([]);

  if (!raw || raw.vendorId !== user.id) {
    return <div className="page"><EmptyNote>배정된 주문이 아닙니다.</EmptyNote></div>;
  }
  const request = anonymizeForVendor(raw); // PII 제거 뷰
  const template = getTemplate(request.templateId);
  const diamond = request.diamondId ? getDiamond(request.diamondId) : null;
  const proposals = [...listProposals(request.id)].reverse();
  const production = listProductionMedia(request.id);

  function uploadProposal(e) {
    e.preventDefault();
    if (media.length === 0) return;
    addProposal(request.id, user.id, { media, comment });
    setMedia([]); setComment("");
  }
  function uploadProduction() {
    prodMedia.forEach((m) => addProductionMedia(request.id, m));
    setProdMedia([]);
  }

  return (
    <div className="page">
      <h1 className="page-title">{request.customerLabel}</h1>
      <p className="page-sub">컨펌을 받을 때까지 시안을 계속 업로드해주세요. 고객과의 직접 연락은 불가능합니다. <StatusBadge status={request.status} /></p>

      <div className="panel">
        <h3>주문 사양</h3>
        <table className="data-table"><tbody>
          <tr><th>디자인</th><td>{template?.name} ({template?.desc})</td></tr>
          <tr><th>다이아몬드</th><td>{diamond ? `${diamond.shape} ${diamond.carat.toFixed(1)}ct ${diamond.cut} ${diamond.color}/${diamond.clarity} ${diamond.certOrg}` : "벤더 추천 요청"}</td></tr>
          <tr><th>메탈</th><td>{request.details.metal}</td></tr>
          <tr><th>사이즈</th><td>{request.details.size}</td></tr>
          {request.details.engraving && <tr><th>각인</th><td>{request.details.engraving}</td></tr>}
          {request.details.budget && <tr><th>예산</th><td>{won(request.details.budget)}</td></tr>}
          {request.details.notes && <tr><th>요청사항</th><td>{request.details.notes}</td></tr>}
        </tbody></table>
      </div>

      {UPLOADABLE.includes(request.status) && (
        <form className="panel form-stack" onSubmit={uploadProposal}>
          <h3>시안 업로드 (v{proposals.length + 1})</h3>
          <MediaPicker value={media} onChange={setMedia} />
          <label className="field"><span>코멘트 (연락처·링크 자동 차단)</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          <button className="button primary" type="submit" disabled={media.length === 0}>시안 올리기</button>
        </form>
      )}

      {request.status === "DEPOSIT_PAID" && (
        <div className="panel">
          <h3>제작 시작</h3>
          <p className="form-hint">디파짓이 결제되었습니다. 제작을 시작하면 고객에게 단계가 표시됩니다.</p>
          <button className="button primary" style={{ marginTop: 12 }} onClick={() => transitionRequest(request.id, "IN_PRODUCTION", user)}>제작 시작</button>
        </div>
      )}

      {request.status === "IN_PRODUCTION" && (
        <div className="panel form-stack">
          <h3>제작 진행</h3>
          <MediaPicker value={prodMedia} onChange={setProdMedia} />
          <div className="row-actions">
            <button className="button secondary small" disabled={prodMedia.length === 0} onClick={uploadProduction}>진행 사진 올리기</button>
            <button className="button primary small" onClick={() => transitionRequest(request.id, "QUALITY_CHECK", user)}>제작 완료 → 검수 요청</button>
          </div>
        </div>
      )}

      {production.length > 0 && (
        <div className="panel">
          <h3>제작 과정 기록</h3>
          <div className="proposal-media">
            {production.map((m) => <MediaThumb key={m.id} media={m} alt="제작 과정" />)}
          </div>
        </div>
      )}

      <h3 style={{ margin: "36px 0 14px" }}>업로드한 시안</h3>
      {proposals.length === 0 && <EmptyNote>아직 시안이 없습니다. 첫 시안을 올려주세요.</EmptyNote>}
      {proposals.map((p) => (
        <article className="proposal-card" key={p.id}>
          <div className="proposal-head">
            <strong>시안 v{p.version}</strong>
            <span className="form-hint">{p.createdAt.slice(0, 10)}</span>
          </div>
          <div className="proposal-media">
            {p.media.map((m, i) => <MediaThumb key={i} media={m} alt={`시안 v${p.version}`} />)}
          </div>
          {p.comment && <p className="proposal-comment">{p.comment}</p>}
          {listFeedback(p.id).map((f) => (
            <div className="feedback-note" key={f.id}>
              고객 피드백 — {f.decision === "confirm" ? "✓ 확정" : `수정 요청: ${f.choices.join(", ")}`}
              {f.comment && ` · ${f.comment}`}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 라우트** — App.jsx

```jsx
<Route path="vendor" element={<RequireRole role="vendor"><VendorQueue /></RequireRole>} />
<Route path="vendor/requests/:id" element={<RequireRole role="vendor"><VendorRequest /></RequireRole>} />
```

- [ ] **Step 5: 검증 + 커밋**

데모 벤더 로그인 → `/vendor` "고객 검토중" 탭에 주문 #1001 (고객 이름 미노출 확인) → 상세에서 사양 확인. 고객 계정으로 #1001 수정 요청 → 벤더 "응답 대기" 탭 이동 → 시안 v2 업로드(라이브러리 선택 + 코멘트에 전화번호 입력 시 마스킹되어 저장되는지 확인) → 고객 화면에 v2 표시.

```bash
git add src && git commit -m "feat: 벤더 포털 — 익명 요청 큐 + 시안 업로드 + 제작 단계"
```

---

### Task 12: 운영자 어드민

**Files:**
- Create: `src/pages/admin/Admin.jsx` (셸 + 대시보드)
- Create: `src/pages/admin/AdminDiamonds.jsx`
- Create: `src/pages/admin/AdminTemplates.jsx`
- Create: `src/pages/admin/AdminOrders.jsx`
- Create: `src/pages/admin/AdminVendors.jsx`
- Create: `src/pages/admin/AdminSettings.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 셸 + 대시보드** — `src/pages/admin/Admin.jsx`

```jsx
import { NavLink, Outlet } from "react-router-dom";
import { listDiamonds, listOrders, listRequests } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { hoursSince } from "../vendor/VendorQueue.jsx";

const MENU = [
  { to: "/admin", label: "대시보드", end: true },
  { to: "/admin/diamonds", label: "다이아몬드" },
  { to: "/admin/templates", label: "템플릿" },
  { to: "/admin/orders", label: "주문 감독" },
  { to: "/admin/vendors", label: "벤더" },
  { to: "/admin/settings", label: "설정" },
];

export default function Admin() {
  return (
    <div className="page">
      <h1 className="page-title">어드민</h1>
      <div className="admin-shell">
        <nav className="admin-side">
          {MENU.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>)}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  useDBVersion();
  const requests = listRequests();
  const active = requests.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.status));
  const unassigned = requests.filter((r) => r.status === "SUBMITTED");
  const slaBreached = requests.filter(
    (r) => ["VENDOR_ASSIGNED", "REVISION_REQUESTED"].includes(r.status) && r.assignedAt && hoursSince(r.assignedAt) >= 48
  );
  const awaitingDeposit = requests.filter((r) => r.status === "CONFIRMED");

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card"><div className="num">{active.length}</div><div className="lbl">진행중 주문</div></div>
        <div className="summary-card"><div className="num">{unassigned.length}</div><div className="lbl">벤더 미배정</div></div>
        <div className="summary-card"><div className="num">{slaBreached.length}</div><div className="lbl">SLA 48h 초과</div></div>
        <div className="summary-card"><div className="num">{listDiamonds({ includeHidden: true }).length}</div><div className="lbl">인벤토리 스톤</div></div>
      </div>
      {slaBreached.length > 0 && (
        <p className="warn-note" style={{ marginTop: 18 }}>
          ⚠ 벤더 무응답 48시간 초과: {slaBreached.map((r) => r.code).join(", ")} — 주문 감독에서 재배정하세요.
        </p>
      )}
      {awaitingDeposit.length > 0 && (
        <p className="form-hint" style={{ marginTop: 10 }}>디파짓 대기: {awaitingDeposit.map((r) => r.code).join(", ")}</p>
      )}
      {listOrders().length === 0 && <p className="form-hint" style={{ marginTop: 18 }}>아직 결제된 주문이 없습니다.</p>}
    </>
  );
}
```

- [ ] **Step 2: 인벤토리 + 가격 조정** — `src/pages/admin/AdminDiamonds.jsx`

```jsx
import { useState } from "react";
import { adjustDiamondPrices, listDiamonds, saveDiamond } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, won } from "../../components/ui.jsx";

const SHAPES = ["라운드", "오벌", "프린세스", "에메랄드", "페어", "마퀴즈", "쿠션", "래디언트", "아셔", "하트"];

const emptyForm = { shape: "라운드", carat: "1.0", cut: "Excellent", color: "D", clarity: "VS1", certOrg: "IGI", certNo: "", priceKrw: "" };

export default function AdminDiamonds() {
  useDBVersion();
  const diamonds = listDiamonds({ includeHidden: true });
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formMedia, setFormMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function addDiamond(e) {
    e.preventDefault();
    saveDiamond({
      shape: form.shape, carat: Number(form.carat), cut: form.cut, color: form.color,
      clarity: form.clarity, certOrg: form.certOrg, certNo: form.certNo,
      priceKrw: Number(form.priceKrw), visible: true,
      media: formMedia.length ? formMedia : undefined,
    });
    setForm(emptyForm); setFormMedia([]);
  }

  return (
    <>
      <div className="panel">
        <h3>일괄 가격 조정</h3>
        <div className="row-actions">
          <input type="number" step="0.5" placeholder="%" value={bulk} onChange={(e) => setBulk(e.target.value)}
            style={{ width: 100, background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "9px 10px" }} />
          <button className="button secondary small" disabled={!bulk} onClick={() => { adjustDiamondPrices(Number(bulk)); setBulk(""); }}>
            전체 {bulk || "n"}% 조정
          </button>
        </div>
        <p className="form-hint" style={{ marginTop: 8 }}>양수 = 인상, 음수 = 인하. 1,000원 단위 반올림.</p>
      </div>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>인벤토리 ({diamonds.length})</h3>
        <table className="data-table">
          <thead><tr><th>스톤</th><th>4C</th><th>인증</th><th>가격 (₩, 직접 수정)</th><th>공개</th></tr></thead>
          <tbody>
            {diamonds.map((d) => (
              <tr key={d.id}>
                <td>{d.shape} {d.carat.toFixed(1)}ct</td>
                <td>{d.cut} · {d.color} · {d.clarity}</td>
                <td>{d.certOrg} {d.certNo}</td>
                <td>
                  <input
                    type="number" step="10000" defaultValue={d.priceKrw} key={`${d.id}-${d.priceKrw}`}
                    onBlur={(e) => { const v = Number(e.target.value); if (v && v !== d.priceKrw) saveDiamond({ id: d.id, priceKrw: v }); }}
                  />
                  <span className="form-hint"> {won(d.priceKrw)}</span>
                </td>
                <td>
                  <button className={`chip ${d.visible ? "is-active" : ""}`} onClick={() => saveDiamond({ id: d.id, visible: !d.visible })}>
                    {d.visible ? "공개" : "비공개"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={addDiamond}>
        <h3>새 다이아몬드 등록 (미디어 수동 업로드)</h3>
        <div className="filter-grid">
          <label className="field"><span>쉐입</span>
            <select value={form.shape} onChange={(e) => setF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="field"><span>캐럿</span><input type="number" step="0.01" value={form.carat} onChange={(e) => setF({ carat: e.target.value })} required /></label>
          <label className="field"><span>컷</span>
            <select value={form.cut} onChange={(e) => setF({ cut: e.target.value })}><option>Excellent</option><option>Very Good</option><option>Good</option></select></label>
          <label className="field"><span>컬러</span>
            <select value={form.color} onChange={(e) => setF({ color: e.target.value })}>{["D","E","F","G","H"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>클래리티</span>
            <select value={form.clarity} onChange={(e) => setF({ clarity: e.target.value })}>{["IF","VVS1","VVS2","VS1","VS2","SI1"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>인증기관</span>
            <select value={form.certOrg} onChange={(e) => setF({ certOrg: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>인증번호</span><input value={form.certNo} onChange={(e) => setF({ certNo: e.target.value })} required /></label>
          <label className="field"><span>가격 (₩)</span><input type="number" step="10000" value={form.priceKrw} onChange={(e) => setF({ priceKrw: e.target.value })} required /></label>
        </div>
        <MediaPicker value={formMedia} onChange={setFormMedia} />
        <button className="button primary" type="submit">등록</button>
      </form>
    </>
  );
}
```

- [ ] **Step 3: 템플릿 관리** — `src/pages/admin/AdminTemplates.jsx`

```jsx
import { useState } from "react";
import { listTemplates, saveTemplate } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { CATEGORY_LABELS, MediaPicker, won } from "../../components/ui.jsx";

const emptyForm = { name: "", category: "ring", desc: "", basePriceKrw: "" };

export default function AdminTemplates() {
  useDBVersion();
  const templates = listTemplates({ includeHidden: true });
  const [form, setForm] = useState(emptyForm);
  const [media, setMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function addTemplate(e) {
    e.preventDefault();
    saveTemplate({ ...form, basePriceKrw: Number(form.basePriceKrw) || 0, media });
    setForm(emptyForm); setMedia([]);
  }

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>템플릿 ({templates.length})</h3>
        <table className="data-table">
          <thead><tr><th>이름</th><th>카테고리</th><th>세팅가</th><th>공개</th></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{CATEGORY_LABELS[t.category]}</td>
                <td>{won(t.basePriceKrw)}</td>
                <td>
                  <button className={`chip ${t.visible ? "is-active" : ""}`} onClick={() => saveTemplate({ id: t.id, visible: !t.visible })}>
                    {t.visible ? "공개" : "비공개"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={addTemplate}>
        <h3>새 템플릿 (샘플 디자인) 등록</h3>
        <label className="field"><span>이름</span><input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></label>
        <label className="field"><span>카테고리</span>
          <select value={form.category} onChange={(e) => setF({ category: e.target.value })}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field"><span>설명</span><textarea value={form.desc} onChange={(e) => setF({ desc: e.target.value })} /></label>
        <label className="field"><span>기본 세팅가 (₩)</span><input type="number" step="10000" value={form.basePriceKrw} onChange={(e) => setF({ basePriceKrw: e.target.value })} /></label>
        <MediaPicker value={media} onChange={setMedia} />
        <button className="button primary" type="submit" disabled={!form.name}>등록</button>
      </form>
    </>
  );
}
```

- [ ] **Step 4: 주문 감독** — `src/pages/admin/AdminOrders.jsx`

```jsx
import { canTransition, STATUSES } from "../../lib/statusMachine.js";
import {
  assignVendor, getOrderByRequest, getTemplate, getUser, listRequests,
  listVendors, transitionRequest, updateShipping,
} from "../../lib/store.js";
import { useAuth } from "../../lib/auth.jsx";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, StatusBadge, won } from "../../components/ui.jsx";

export default function AdminOrders() {
  useDBVersion();
  const { user } = useAuth();
  const requests = listRequests();
  const vendors = listVendors().filter((v) => v.active);

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <h3>전체 주문 ({requests.length})</h3>
      {requests.length === 0 ? <EmptyNote>주문이 없습니다.</EmptyNote> : (
        <table className="data-table">
          <thead><tr><th>주문</th><th>고객 (PII — 어드민만)</th><th>디자인</th><th>벤더</th><th>상태</th><th>결제</th><th>강제 전이</th></tr></thead>
          <tbody>
            {requests.map((r) => {
              const order = getOrderByRequest(r.id);
              const allowedTargets = STATUSES.filter((s) => s !== r.status && canTransition(r.status, s, "admin"));
              return (
                <tr key={r.id}>
                  <td>{r.code}</td>
                  <td>{getUser(r.customerId)?.name}<br /><span className="form-hint">{getUser(r.customerId)?.email}</span></td>
                  <td>{getTemplate(r.templateId)?.name}</td>
                  <td>
                    <select
                      value={r.vendorId || ""}
                      onChange={(e) => assignVendor(r.id, e.target.value, user)}
                      disabled={!canTransition(r.status, "VENDOR_ASSIGNED", "admin")}
                    >
                      <option value="" disabled>배정…</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    {order ? (
                      <>
                        {won(order.totalKrw)}<br />
                        <span className="form-hint">
                          디파짓 {order.depositPaidAt ? "✓" : "—"} · 잔금 {order.finalPaidAt ? "✓" : "—"}
                        </span>
                        {order.shippingStage === "배송준비" && (
                          <input placeholder="운송장 입력" defaultValue={order.trackingNo || ""}
                            onBlur={(e) => updateShipping(order.id, { trackingNo: e.target.value })} />
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td>
                    <select value="" onChange={(e) => transitionRequest(r.id, e.target.value, user)}>
                      <option value="" disabled>전이…</option>
                      {allowedTargets.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 벤더 관리** — `src/pages/admin/AdminVendors.jsx`

```jsx
import { useState } from "react";
import { addUser, getDB, listRequests, listVendors, setVendorActive } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";

export default function AdminVendors() {
  useDBVersion();
  const vendors = listVendors();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function stats(vendorId) {
    const assigned = listRequests({ vendorId });
    const proposals = getDB().proposals.filter((p) => p.vendorId === vendorId);
    return { assigned: assigned.length, proposals: proposals.length };
  }

  return (
    <>
      <div className="panel">
        <h3>벤더 계정 ({vendors.length})</h3>
        <table className="data-table">
          <thead><tr><th>표시명</th><th>이메일</th><th>배정 주문</th><th>업로드 시안</th><th>상태</th></tr></thead>
          <tbody>
            {vendors.map((v) => {
              const s = stats(v.id);
              return (
                <tr key={v.id}>
                  <td>{v.name}</td><td>{v.email}</td><td>{s.assigned}</td><td>{s.proposals}</td>
                  <td>
                    <button className={`chip ${v.active ? "is-active" : ""}`} onClick={() => setVendorActive(v.id, !v.active)}>
                      {v.active ? "활성" : "정지"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); addUser({ email, name, role: "vendor" }); setName(""); setEmail(""); }}>
        <h3>벤더 계정 발급</h3>
        <label className="field"><span>표시명 (예: ATELIER-03)</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>이메일</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <button className="button primary" type="submit">발급 (비밀번호: demo1234)</button>
      </form>
    </>
  );
}
```

- [ ] **Step 6: 설정** — `src/pages/admin/AdminSettings.jsx`

```jsx
import { getSettings, resetDB, updateSettings } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";

export default function AdminSettings() {
  useDBVersion();
  const settings = getSettings();

  return (
    <>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>결제 설정</h3>
        <label className="field"><span>디파짓 비율 (%)</span>
          <input
            type="number" min="10" max="90" step="5" defaultValue={Math.round(settings.depositRate * 100)} key={settings.depositRate}
            onBlur={(e) => updateSettings({ depositRate: Number(e.target.value) / 100 })}
          /></label>
        <p className="form-hint">새 주문 컨펌 시점부터 적용됩니다.</p>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>배송 단계 라벨</h3>
        <p className="form-hint">{settings.shippingStages.join(" → ")}</p>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>히어로 영상 슬롯</h3>
        <p className="form-hint">현재: /assets/diamond-noir-white.mp4 — 실사 촬영본 확보 시 같은 파일명으로 교체하면 즉시 반영됩니다.</p>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>데모 데이터</h3>
        <button className="button danger" onClick={() => { if (confirm("모든 데모 데이터를 초기화할까요?")) resetDB(); }}>
          시드 데이터로 초기화
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 7: 라우트** — App.jsx (중첩 라우트)

```jsx
<Route path="admin" element={<RequireRole role="admin"><Admin /></RequireRole>}>
  <Route index element={<AdminDashboard />} />
  <Route path="diamonds" element={<AdminDiamonds />} />
  <Route path="templates" element={<AdminTemplates />} />
  <Route path="orders" element={<AdminOrders />} />
  <Route path="vendors" element={<AdminVendors />} />
  <Route path="settings" element={<AdminSettings />} />
</Route>
```

- [ ] **Step 8: 검증 + 커밋**

데모 운영자 로그인 → 대시보드 카운트 → 다이아 가격 인라인 수정 → `/diamonds`에 반영 확인 → 일괄 +10% → 새 주문(고객 계정으로 제출) → 주문 감독에서 벤더 배정 → 벤더 화면에 익명으로 표시(고객 열은 어드민만 보임) 확인.

```bash
git add src && git commit -m "feat: 어드민 — 인벤토리/가격조정/템플릿/주문감독/벤더/설정"
```

---

### Task 13: 교육 페이지 + 마무리 와이어링

**Files:**
- Create: `src/pages/Guide.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: 가이드 2종** — `src/pages/Guide.jsx`

```jsx
import { Link } from "react-router-dom";

export function GuideLabDiamond() {
  return (
    <div className="page page-narrow guide-page">
      <h1 className="page-title">랩그로운 다이아몬드란?</h1>
      <p>랩그로운 다이아몬드는 천연 다이아몬드와 물리적·화학적·광학적으로 100% 동일한 진짜 다이아몬드입니다. 유일한 차이는 탄생지 — 땅속 대신 실험실에서 성장합니다.</p>
      <h3>천연과 동일한 물성</h3>
      <p>경도(모스 10), 굴절률, 분산도 모두 동일합니다. 보석 감정사도 전용 장비 없이는 구분할 수 없습니다.</p>
      <h3>IGI·GIA 인증</h3>
      <p>LUMINA LAB의 모든 스톤은 IGI 또는 GIA 인증서가 함께 제공되며, 인증번호로 진위를 직접 조회할 수 있습니다.</p>
      <h3>정직한 가격</h3>
      <p>채굴·유통 프리미엄이 없어 동급 천연 대비 절반 수준의 가격으로, 같은 예산에 더 크고 더 깨끗한 스톤을 선택할 수 있습니다.</p>
      <p><Link className="button primary" to="/diamonds">다이아몬드 둘러보기</Link></p>
      <p><Link className="text-link" to="/guide/4c">다음: 4C 가이드 →</Link></p>
    </div>
  );
}

export function Guide4C() {
  return (
    <div className="page page-narrow guide-page">
      <h1 className="page-title">4C 가이드</h1>
      <h3>Carat — 캐럿</h3>
      <p>스톤의 무게(1ct = 0.2g). 같은 캐럿이라도 컷에 따라 보이는 크기가 다릅니다.</p>
      <h3>Cut — 컷</h3>
      <p>광채를 결정하는 가장 중요한 요소. Excellent 컷은 빛을 최대로 반사합니다.</p>
      <h3>Color — 컬러</h3>
      <p>D(완전 무색)부터 Z까지. D–F는 무색, G–H는 거의 무색으로 육안 차이가 미미합니다.</p>
      <h3>Clarity — 클래리티</h3>
      <p>내포물의 정도. IF(무결점)–VS2까지는 육안으로 내포물이 보이지 않습니다.</p>
      <p className="form-hint">팁: 예산 대비 가장 효율적인 조합은 Excellent 컷 + F–G 컬러 + VS1–VS2 클래리티입니다.</p>
      <p><Link className="button primary" to="/custom/new">이 기준으로 주문제작 시작</Link></p>
    </div>
  );
}
```

platform.css에 추가:

```css
.guide-page p { color: var(--muted); line-height: 1.75; }
.guide-page h3 { margin: 30px 0 8px; color: var(--text); }
```

- [ ] **Step 2: 라우트**

```jsx
<Route path="guide/lab-diamond" element={<GuideLabDiamond />} />
<Route path="guide/4c" element={<Guide4C />} />
<Route path="*" element={<div className="page"><p className="empty-note">페이지를 찾을 수 없습니다.</p></div>} />
```

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run build && npx vitest run
git add src && git commit -m "feat: 교육 페이지(랩다이아/4C) + 404"
```

---

### Task 14: 최종 검증 (E2E 수동 + 회귀)

- [ ] **Step 1: 전체 테스트 + 빌드**

Run: `npx vitest run && npm run build`
Expected: 테스트 전부 PASS, 빌드 에러 없음.

- [ ] **Step 2: 핵심 플로우 클릭스루** (Playwright 브라우저로 직접 수행)

1. 홈 → 히어로 영상 재생 확인 (화이트 다이아)
2. `/diamonds` 필터 → 상세 → "이 다이아몬드로 주문제작"
3. 위저드 4단계 → 로그인(고객 데모) → 제출
4. 로그아웃 → 벤더 로그인 → 큐에서 새 주문(익명) → 시안 업로드 (코멘트에 010-1111-2222 입력 → 마스킹 확인)
5. 고객 재로그인 → 시안 확인 → 수정 요청 → (벤더 v2 업로드) → 확정 → 디파짓 모의 결제
6. 벤더: 제작 시작 → 진행 사진 → 검수 요청
7. 고객: 잔금 결제 → 어드민: 운송장 입력 + SHIPPED → DELIVERED → 고객: 수령 확인 → COMPLETED
8. 어드민: 가격 ±, 템플릿 비공개 → 갤러리에서 사라짐 확인
9. 데스크톱(1680px)·모바일(390px) 스크린샷 회귀 (홈 히어로)

- [ ] **Step 3: 마무리 커밋 & 브랜치 정리**

superpowers:finishing-a-development-branch 스킬로 main 머지 여부 결정.

---

## Self-Review 체크 (작성 후 확인 완료)

- 스펙 §5.1 고객 기능: 홈(✓T4), 검색(✓T7), 상세(✓T7), 갤러리(✓T8), 위저드(✓T9), 마이페이지·시안검토·결제·배송(✓T10), 교육(✓T13), 로그인(✓T5)
- §5.2 벤더: 큐·상세·시안업로드·피드백·제작단계(✓T11), SLA 표시(✓T11)
- §5.3 어드민: 인벤토리·가격(개별+일괄)·미디어, 템플릿, 주문감독(배정·강제전이·운송장), 벤더관리, 설정(디파짓 비율)(✓T12), 대시보드 경고(48h SLA, 디파짓 대기)(✓T12)
- §3 익명성: anonymizeForVendor + 마스킹 + 구조화 피드백(✓T2/T3/T11), 고객에게 벤더 미노출(고객 화면에 벤더명 없음 ✓T10)
- §4 상태머신: 전이 전수 테스트(✓T1), 감사로그 statusEvents(✓T3)
- 미루는 것(스펙과 동일): Stripe/Supabase/react-i18next 전환, 다국어 신규페이지 카피, 영상 트랜스코딩, 카카오/푸시
- 타입 일관성: store API 시그니처는 T3 정의를 T7–T12가 그대로 사용. `hoursSince`는 VendorQueue에서 export, Admin이 import.




