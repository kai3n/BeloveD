# 벤더 다이아몬드 풀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 벤더가 자기 재고 다이아를 상설 풀(`poolDiamonds`)에 미리 올려두면, 솔리테어 주문 시 시스템이 조건 맞는 스톤을 자동 매칭해 고객 후보로 띄우고, 운영자는 모든 벤더 풀을 사진·레코드까지 CRUD한다.

**Architecture:** 새 `poolDiamonds` 컬렉션을 추가한다(B2C `diamonds`·주문별 `diamondCands`와 분리). 순수 매칭 로직은 `ops.js`(등급 순서 + `poolStoneMatches`), 컬렉션 CRUD·매칭·자동후보생성은 `store.js`. 인테이크 자동발행(`autoDispatchIntake`)이 풀을 먼저 매칭하고 0건이면 기존 벤더 소싱 PR로 폴백. 락 시 풀 스톤 sold + 형제 후보 무효화. 벤더 `/supplier/pool`·운영자 `/admin/pool` 페이지는 표시 전용 store API를 호출.

**Tech Stack:** React 19, react-router-dom v7, vitest(node 환경 — 컴포넌트 렌더 테스트 인프라 없음 → 로직/스토어 테스트만, 페이지는 빌드 검증), localStorage mock store, 기존 `useLocale()`/`MediaPicker`/`usd`.

**스펙:** `docs/superpowers/specs/2026-06-13-vendor-diamond-pool-design.md`

> ⚠️ **병행 세션 충돌 주의**: `src/lib/store.js`·`src/lib/ops.js`·`src/pages/ClientPortal.jsx` 등에 다른 세션의 미커밋 변경이 있을 수 있다. **절대 `git add -A`/`commit -a` 금지.** 각 커밋은 이 플랜이 명시한 파일만 stage하고, 커밋 전 `git diff --cached --stat`로 외부 파일이 섞이지 않았는지 확인한다. 가능하면 워크트리 격리(using-git-worktrees) 후 실행 권장.

---

## File Structure

| 파일 | 역할 |
|---|---|
| Modify `src/lib/ops.js` | 등급 순서 상수(`COLOR_ORDER`/`CLARITY_ORDER`) + 순수 `poolStoneMatches(stone, prefs, opts)` |
| Modify `src/lib/store.js` | `poolDiamonds` CRUD, `matchPoolForOrder`, `autoMatchFromPool`, `autoDispatchIntake`·`lockCandidate` 수정, isValidDB·v11 |
| Modify `src/lib/seed.js` | `poolDiamonds[]` 시드 + settings 3개 키 |
| Create `src/lib/__tests__/pool.test.js` | 매칭·CRUD·자동후보·락 동기화 테스트 |
| Modify `src/platformStrings.js` | `admin.menu.pool` + `admin.pool` 블록 (4언어) |
| Modify `src/opsStrings.js` | `supplierPool` 블록 + `supplierP.poolLink` (4언어) |
| Create `src/pages/supplier/SupplierPool.jsx` | 벤더 자기 풀 CRUD 페이지 |
| Create `src/pages/admin/AdminPool.jsx` | 운영자 전체 풀 오버사이트 CRUD 페이지 |
| Modify `src/App.jsx` | `/supplier/pool`·`/admin/pool` 라우트 |
| Modify `src/pages/admin/Admin.jsx` | 어드민 사이드바 pool 항목 |
| Modify `src/pages/supplier/SupplierQueue.jsx` | "My Pool" 링크 |

---

### Task 1: 등급 순서 + 순수 매칭 판정 (`ops.js`)

**Files:**
- Modify: `src/lib/ops.js`
- Test: `src/lib/__tests__/pool.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/pool.test.js` 생성:

```js
import { describe, expect, it } from "vitest";
import { COLOR_ORDER, CLARITY_ORDER, poolStoneMatches } from "../ops.js";

const OPTS = { caratUnder: 0.05, caratOver: 0.4 };
const base = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD" };
const prefs = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD" };

describe("poolStoneMatches — 순수 매칭 판정", () => {
  it("등급 순서 상수", () => {
    expect(COLOR_ORDER[0]).toBe("D");
    expect(COLOR_ORDER.indexOf("D")).toBeLessThan(COLOR_ORDER.indexOf("E"));
    expect(CLARITY_ORDER[0]).toBe("FL");
    expect(CLARITY_ORDER.indexOf("IF")).toBeLessThan(CLARITY_ORDER.indexOf("VS1"));
  });
  it("정확 일치는 매칭", () => {
    expect(poolStoneMatches(base, prefs, OPTS)).toBe(true);
  });
  it("셰이프 불일치 제외", () => {
    expect(poolStoneMatches({ ...base, shape: "oval" }, prefs, OPTS)).toBe(false);
  });
  it("컬러·클래리티는 '등급 이상'만 통과", () => {
    expect(poolStoneMatches({ ...base, color: "D", clarity: "IF" }, prefs, OPTS)).toBe(true); // 더 좋음
    expect(poolStoneMatches({ ...base, color: "F" }, prefs, OPTS)).toBe(false);              // 더 나쁨
    expect(poolStoneMatches({ ...base, clarity: "VS2" }, prefs, OPTS)).toBe(false);          // 더 나쁨
  });
  it("캐럿 범위 경계", () => {
    expect(poolStoneMatches({ ...base, carat: 1.46 }, prefs, OPTS)).toBe(true);  // -0.04 ≥ -0.05
    expect(poolStoneMatches({ ...base, carat: 1.44 }, prefs, OPTS)).toBe(false); // -0.06 < -0.05
    expect(poolStoneMatches({ ...base, carat: 1.9 }, prefs, OPTS)).toBe(true);   // +0.4
    expect(poolStoneMatches({ ...base, carat: 1.95 }, prefs, OPTS)).toBe(false); // +0.45
  });
  it("성장방식: 요청 있으면 일치 필요, 없으면 무시", () => {
    expect(poolStoneMatches({ ...base, growth: "HPHT" }, prefs, OPTS)).toBe(false);
    expect(poolStoneMatches({ ...base, growth: "HPHT" }, { ...prefs, growth: "" }, OPTS)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: FAIL — `COLOR_ORDER` is not exported / `poolStoneMatches is not a function`

- [ ] **Step 3: 구현 추가**

`src/lib/ops.js` 파일 끝(마지막 export 뒤)에 추가:

```js
// ---------- 벤더 다이아 풀 매칭 (순수) ----------
// 등급 순서: 인덱스가 작을수록 고등급. "등급 이상" = 스톤 인덱스 ≤ 요청 인덱스.
export const COLOR_ORDER = ["D", "E", "F", "G", "H", "I", "J", "K"];
export const CLARITY_ORDER = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2"];

function gradeAtLeast(order, stoneGrade, prefGrade) {
  const pi = order.indexOf(prefGrade);
  if (pi < 0) return true; // 요청 등급이 목록에 없으면 해당 축 무시(관대)
  const si = order.indexOf(stoneGrade);
  return si >= 0 && si <= pi;
}

// 풀 스톤이 고객 선호(prefs)에 매칭되는지. opts: { caratUnder, caratOver }
export function poolStoneMatches(stone, prefs, opts) {
  if (!stone || !prefs) return false;
  if (stone.shape !== prefs.shape) return false;
  const carat = Number(stone.carat), want = Number(prefs.carat);
  if (!(carat >= want - opts.caratUnder && carat <= want + opts.caratOver)) return false;
  if (!gradeAtLeast(COLOR_ORDER, stone.color, prefs.color)) return false;
  if (!gradeAtLeast(CLARITY_ORDER, stone.clarity, prefs.clarity)) return false;
  if (prefs.growth && stone.growth !== prefs.growth) return false;
  return true;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ops.js src/lib/__tests__/pool.test.js
git diff --cached --stat   # 이 두 파일만 보여야 함
git commit -m "feat(pool): 등급 순서 상수 + 순수 매칭 판정 poolStoneMatches"
```

---

### Task 2: `poolDiamonds` 컬렉션 + CRUD + 시드 + DB v11

**Files:**
- Modify: `src/lib/seed.js`
- Modify: `src/lib/store.js`
- Test: `src/lib/__tests__/pool.test.js`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/__tests__/pool.test.js` 상단 import에 store 추가:

```js
import { listPoolDiamonds, getPoolDiamond, savePoolDiamond, archivePoolDiamond, setPoolAvailability } from "../store.js";
```

파일 끝에 describe 블록 추가:

```js
describe("poolDiamonds — CRUD & 권한 스코프", () => {
  it("시드에 풀 스톤이 있고 기본은 archived 제외", () => {
    const all = listPoolDiamonds();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((s) => !s.archived)).toBe(true);
  });
  it("supplierId 스코프 — 벤더는 자기 것만", () => {
    const s1 = listPoolDiamonds({ supplierId: "u-supplier1" });
    expect(s1.length).toBeGreaterThan(0);
    expect(s1.every((s) => s.supplierId === "u-supplier1")).toBe(true);
  });
  it("새 스톤 추가 → POOL- id + available 기본값", () => {
    const created = savePoolDiamond({ supplierId: "u-supplier2", shape: "round", carat: 1.7, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", igiNo: "IGI-TEST-1", procurementCostUsd: 700 });
    expect(created.id).toMatch(/^POOL-/);
    expect(created.availability).toBe("available");
    expect(created.archived).toBe(false);
    expect(getPoolDiamond(created.id)).toBeTruthy();
  });
  it("수정·재고토글·아카이브", () => {
    const c = savePoolDiamond({ supplierId: "u-supplier1", shape: "oval", carat: 1.2, color: "F", clarity: "VVS2", growth: "CVD", lab: "IGI", igiNo: "IGI-TEST-2", procurementCostUsd: 500 });
    savePoolDiamond({ id: c.id, procurementCostUsd: 550 });
    expect(getPoolDiamond(c.id).procurementCostUsd).toBe(550);
    setPoolAvailability(c.id, "unavailable");
    expect(getPoolDiamond(c.id).availability).toBe("unavailable");
    archivePoolDiamond(c.id);
    expect(getPoolDiamond(c.id).archived).toBe(true);
    expect(listPoolDiamonds().find((s) => s.id === c.id)).toBeUndefined(); // 기본 목록서 제외
    expect(listPoolDiamonds({ includeArchived: true }).find((s) => s.id === c.id)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: FAIL — `listPoolDiamonds is not a function`

- [ ] **Step 3: 시드에 `poolDiamonds` + settings 키 추가**

`src/lib/seed.js`에서 `diamonds: [ … ],` 배열 닫힘 바로 다음 줄에 추가:

```js
    poolDiamonds: [
      // 기본 벤더 u-supplier1 — round/1.5/E/VS1/CVD 인테이크가 자동 매칭되도록
      { id: "POOL-000001", supplierId: "u-supplier1", igiNo: "IGI-LG-700001", shape: "round", carat: 1.5, color: "D", clarity: "VVS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 640, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "POOL-000002", supplierId: "u-supplier1", igiNo: "IGI-LG-700002", shape: "round", carat: 1.6, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }, { kind: "video", src: NOIR_VIDEO }], procurementCostUsd: 680, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "POOL-000003", supplierId: "u-supplier1", igiNo: "IGI-LG-700003", shape: "round", carat: 1.5, color: "E", clarity: "IF", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 720, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      // 매칭 제외 데모: 컬러 낮음(G), 성장 HPHT, 캐럿 초과
      { id: "POOL-000004", supplierId: "u-supplier1", igiNo: "IGI-LG-700004", shape: "round", carat: 1.5, color: "G", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 520, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "POOL-000005", supplierId: "u-supplier2", igiNo: "IGI-LG-700005", shape: "round", carat: 1.55, color: "E", clarity: "VVS2", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 700, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      // 다른 셰이프 — 오벌 주문용
      { id: "POOL-000006", supplierId: "u-supplier2", igiNo: "IGI-LG-700006", shape: "oval", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 660, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
      { id: "POOL-000007", supplierId: "u-supplier2", igiNo: "IGI-LG-700007", shape: "emerald", carat: 2.0, color: "F", clarity: "VS1", growth: "HPHT", lab: "IGI", certOrg: "IGI", reportUrl: "", proportions: {}, colorTreatment: "disclosed", media: [{ kind: "image", src: TWEEZERS }], procurementCostUsd: 1500, availability: "available", archived: false, createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" },
    ],
```

같은 파일 `settings: {` 객체 안, `stockConfirmWithinDays: 3,` 줄 다음에 추가:

```js
      poolCaratUnder: 0.05, poolCaratOver: 0.4, poolMatchLimit: 12, // 풀 자동매칭 허용 캐럿범위·후보 캡
```

- [ ] **Step 4: store.js — DB v11 + isValidDB + CRUD 함수**

`src/lib/store.js`에서 KEY 상수 교체:

```js
const KEY = "lumina-db-v11"; // v11: 벤더 다이아 풀(poolDiamonds) 추가
```

`db()` 함수의 `storage.removeItem("lumina-db-v9");` 줄 다음에 추가:

```js
    storage.removeItem("lumina-db-v10");
```

`isValidDB` 함수의 `&& d.settings?.defaultSupplierId != null` 뒤(마지막 조건)에 추가:

```js
      && Array.isArray(d.poolDiamonds)
```

`saveDiamond` 함수(`// ---------- diamonds ----------` 섹션) 바로 뒤에 풀 CRUD 섹션 추가:

```js
// ---------- vendor diamond pool ----------
export function listPoolDiamonds({ supplierId, includeArchived = false } = {}) {
  return db().poolDiamonds.filter((s) =>
    (includeArchived || !s.archived) && (!supplierId || s.supplierId === supplierId));
}
export function getPoolDiamond(id) { return db().poolDiamonds.find((s) => s.id === id) || null; }
export function savePoolDiamond(stone) {
  const list = db().poolDiamonds;
  const i = stone.id ? list.findIndex((s) => s.id === stone.id) : -1;
  if (i >= 0) {
    list[i] = { ...list[i], ...stone, updatedAt: now() };
    persist();
    return list[i];
  }
  const created = {
    media: [], availability: "available", archived: false, proportions: {}, colorTreatment: "disclosed",
    reportUrl: "", ...stone, id: nextSeqId("POOL"), createdAt: now(), updatedAt: now(),
  };
  list.push(created);
  audit(stone.supplierId || "ops", "pool", created.id, "create", null, "available");
  persist();
  return created;
}
export function archivePoolDiamond(id, archived = true) {
  const s = getPoolDiamond(id);
  if (!s) return;
  s.archived = archived; s.updatedAt = now();
  persist();
}
export function setPoolAvailability(id, availability) {
  const s = getPoolDiamond(id);
  if (!s) return;
  s.availability = availability; s.updatedAt = now();
  persist();
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: PASS (10 tests 누적)

- [ ] **Step 6: 전체 테스트 회귀 확인**

Run: `npx vitest run`
Expected: 기존 테스트 + pool 테스트 전부 PASS (DB v11 재시드가 다른 테스트를 깨지 않는지 확인)

- [ ] **Step 7: 커밋**

```bash
git add src/lib/seed.js src/lib/store.js src/lib/__tests__/pool.test.js
git diff --cached --stat   # 이 세 파일만
git commit -m "feat(pool): poolDiamonds 컬렉션 + CRUD + 시드 + DB v11"
```

---

### Task 3: 자동매칭 → 후보 생성 + 인테이크 통합

**Files:**
- Modify: `src/lib/store.js`
- Test: `src/lib/__tests__/pool.test.js`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/__tests__/pool.test.js` import에 추가:

```js
import { createIntake, listCandidates, listProcurements, matchPoolForOrder } from "../store.js";
```

파일 끝에 describe 추가:

```js
describe("자동매칭 → 후보 생성 + 폴백", () => {
  const solitairePrefs = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" };
  const form = (prefs) => ({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "", budget: null, metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: prefs, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] });

  it("matchPoolForOrder — round/1.5/E/VS1/CVD는 시드 3건 매칭 (D/VVS1, E/VS1, E/IF)", () => {
    const m = matchPoolForOrder(solitairePrefs);
    expect(m.length).toBe(3);
    expect(m.every((s) => s.shape === "round" && s.growth === "CVD")).toBe(true);
    expect(m.map((s) => s.id)).not.toContain("POOL-000004"); // 컬러 G 제외
    expect(m.map((s) => s.id)).not.toContain("POOL-000005"); // u-supplier2지만 VVS2 — VS1 이상이라 포함? VVS2<VS1 → 포함
  });

  it("솔리테어 인테이크 → 풀에서 published 후보 자동 생성, PR 없음", () => {
    const { order } = createIntake(form(solitairePrefs));
    const cands = listCandidates({ orderId: order.id });
    expect(cands.length).toBeGreaterThanOrEqual(3);
    expect(cands.every((c) => c.poolDiamondId && c.prId === null)).toBe(true);
    expect(cands.some((c) => c.published && c.customerPriceUsd > 0)).toBe(true);
    expect(listProcurements({ orderId: order.id }).some((p) => p.type === "diamondCandidates")).toBe(false);
  });

  it("매칭 0건 → 후보 0 + diamondCandidates 폴백 PR 발행", () => {
    const noMatch = { ...solitairePrefs, shape: "heart" }; // 하트 풀 스톤 없음
    const { order } = createIntake(form(noMatch));
    expect(listCandidates({ orderId: order.id }).length).toBe(0);
    expect(listProcurements({ orderId: order.id }).some((p) => p.type === "diamondCandidates" && p.status === "open")).toBe(true);
  });
});
```

> 참고: 위 두 번째 테스트의 `POOL-000005`(u-supplier2, VVS2)는 VS1 이상이라 **매칭에 포함**된다. 따라서 round/1.5/E/VS1 매칭은 POOL-000001(D/VVS1)·000002(E/VS1)·000003(E/IF)·000005(E/VVS2) = **4건**이 맞다. 첫 테스트의 기대값을 4로 적고, `not.toContain("POOL-000005")` 줄은 삭제한다. 아래 Step 3 구현 후 실제 카운트로 확정한다.

수정된 첫 테스트:

```js
  it("matchPoolForOrder — round/1.5/E/VS1/CVD 매칭 (D/VVS1, E/VS1, E/IF, E/VVS2)", () => {
    const m = matchPoolForOrder(solitairePrefs);
    expect(m.map((s) => s.id).sort()).toEqual(["POOL-000001", "POOL-000002", "POOL-000003", "POOL-000005"]);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: FAIL — `matchPoolForOrder is not a function`

- [ ] **Step 3: store.js — `matchPoolForOrder` + `autoMatchFromPool`**

`src/lib/store.js`의 import에 `poolStoneMatches`를 추가한다(기존 ops.js import 블록):

```js
import {
  MILESTONE_STAGES, publicDiamondView, customerOrderView, supplierTaskView,
  quoteCompute, reconcileDelta, randomQueryCode, tierForCarat,
  autoBrief, candidateAutoPrice, isCandidateComplete, poolStoneMatches,
} from "./ops.js";
```

풀 CRUD 섹션(Task 2) 끝에 매칭 함수 추가:

```js
// 고객 선호(prefs)에 맞는 available 풀 스톤 — 활성 벤더만, 캐럿 근접→원가 순, 캡 적용
export function matchPoolForOrder(prefs) {
  if (!prefs) return [];
  const s = db().settings;
  const opts = { caratUnder: s.poolCaratUnder ?? 0.05, caratOver: s.poolCaratOver ?? 0.4 };
  const limit = s.poolMatchLimit ?? 12;
  return db().poolDiamonds
    .filter((stone) => {
      if (stone.archived || stone.availability !== "available") return false;
      const owner = getUser(stone.supplierId);
      if (!owner || owner.active === false) return false;
      return poolStoneMatches(stone, prefs, opts);
    })
    .sort((a, b) =>
      Math.abs(a.carat - prefs.carat) - Math.abs(b.carat - prefs.carat) ||
      (a.procurementCostUsd || 0) - (b.procurementCostUsd || 0))
    .slice(0, limit);
}

// 매칭된 풀 스톤을 주문 후보(diamondCands)로 스냅샷 복제 — 완결+벤치마크면 자동가·공개
function autoMatchFromPool(order, intake) {
  const prefs = intake.stonePrefs;
  const matches = matchPoolForOrder(prefs);
  const existing = listCandidates({ orderId: order.id }).length;
  const created = matches.map((pool, i) => {
    const image = (pool.media || []).find((m) => m.kind === "image")?.src || "";
    const video = (pool.media || []).find((m) => m.kind === "video")?.src || "";
    return {
      id: `DIA-${order.id}-${String(existing + i + 1).padStart(2, "0")}`,
      orderId: order.id, prId: null, poolDiamondId: pool.id,
      igiNo: pool.igiNo, shape: pool.shape, carat: pool.carat, color: pool.color, clarity: pool.clarity,
      growth: pool.growth, lab: pool.lab, proportions: pool.proportions || {}, reportUrl: pool.reportUrl || "",
      image, video, colorTreatment: pool.colorTreatment || "disclosed", availability: "available",
      procurementCostUsd: pool.procurementCostUsd, supplierId: pool.supplierId,
      internalReview: null, internalNotes: "", published: false, customerPriceUsd: null,
      clientSelection: "none", locked: false, createdAt: now(),
    };
  });
  db().poolDiamonds; // noop keep
  db().diamondCands.push(...created);
  created.forEach((c) => {
    const bench = benchmarkFor(c.shape, c.carat);
    if (isCandidateComplete(c) && bench) {
      c.customerPriceUsd = candidateAutoPrice(bench.unitUsdPerCt, c.carat, db().settings.opsMultiplier);
      c.published = true;
      audit("auto", "diamond", c.id, "published", "false", "true");
    }
  });
  return created;
}
```

> 주의: `autoMatchFromPool`은 함수 선언(hoisted)이라 `autoDispatchIntake`보다 뒤에 있어도 호출 가능. `db().poolDiamonds; // noop keep` 줄은 불필요하면 삭제해도 된다.

- [ ] **Step 4: `autoDispatchIntake` 솔리테어 분기 수정**

`src/lib/store.js`의 `autoDispatchIntake` 함수에서 솔리테어 분기를 교체:

```js
function autoDispatchIntake(order, intake) {
  if (intake.productLine === "solitaire") {
    // 풀에서 자동 매칭 → 후보 생성. 매칭 0건이면 벤더 소싱 요청으로 폴백.
    const matched = autoMatchFromPool(order, intake);
    if (matched.length === 0) {
      autoIssuePr(order.id, "diamondCandidates", {
        supplierId: routeSupplier(order.styleId),
        batchValidUntil: plusDays(db().settings.batchValidDays), brief: autoBrief(intake),
      });
    }
  } else if (!tryAutoQuote(order.id)) {
    autoIssuePr(order.id, "weightLabor", {
      supplierId: routeSupplier(order.styleId), brief: autoBrief(intake), metal: intake.metal || null,
      measurements: Object.entries(intake.conditional || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || null,
    });
  }
}
```

- [ ] **Step 5: 테스트 통과 확인 (카운트 확정)**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: PASS. 매칭 카운트가 4가 아니면 실제 값으로 첫 테스트 기대값을 맞춘다(시드 스톤 등급 재확인).

- [ ] **Step 6: `autoFlow.test.js` 회귀 수정 (필수 — 알려진 충돌)**

`autoFlow.test.js`의 `solitaireForm.stonePrefs`는 `round/1.5/E/VS1/CVD`로 **시드 풀과 매칭**된다. 이제 솔리테어 인테이크는 풀 자동매칭으로 후보를 만들고 `diamondCandidates` PR을 발행하지 않으므로, 그 PR을 기대하는 4개 테스트(약 L22·L60·L74·L98)가 깨진다. 이 4개 테스트는 **벤더 제출(submitCandidates) fallback 체인**을 검증하는 것이므로, 인테이크가 풀에 매칭되지 않게 해서 fallback 경로를 그대로 태운다.

`src/lib/__tests__/autoFlow.test.js`의 `solitaireForm` 셰이프를 풀에 없는 `princess`로 변경:

```js
const solitaireForm = {
  name: "Auto Kim", contact: "auto@x.com", productLine: "solitaire", category: "ring",
  styleId: "RING-001", metal: "18kw", conditional: { ringSize: "6 US" },
  // 셰이프 princess = 시드 풀에 없음 → 자동매칭 0건 → 벤더 소싱(diamondCandidates) fallback 경로 검증
  stonePrefs: { shape: "princess", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" },
  requiredDate: "2026-09-01", country: "USA", termsAccepted: true,
};
```

같은 파일에서 brief 단언 한 줄 변경(첫 테스트):

```js
    expect(pr.brief).toContain("1.5ct princess");
```

(나머지 3개 테스트는 PR을 찾아 `submitCandidates`만 하므로 폼 셰이프 변경으로 자동 복구된다. 제출 후보의 shape는 `round`로 두어도 무방 — 벤치마크/가격 단언은 후보 shape 기준이라 1123 등 기존 값 유지.)

> ⚠️ `autoFlow.test.js`는 병행 세션의 미커밋 변경이 있을 수 있다. 이 파일을 stage할 때 `git diff --cached`로 본인 변경(solitaireForm 2줄)만 포함되는지 확인하고, 병행 세션 변경이 섞이면 그 세션과 커밋 순서를 조율한다.

- [ ] **Step 7: 전체 회귀**

Run: `npx vitest run`
Expected: 전부 PASS (pool 테스트 + 수정된 autoFlow 포함). 남은 실패가 있으면 단언을 읽고 의도에 맞게 최소 수정.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/store.js src/lib/__tests__/pool.test.js src/lib/__tests__/autoFlow.test.js
git diff --cached --stat
git commit -m "feat(pool): 자동매칭 → 후보 자동생성 + 인테이크 통합(매칭 0건 폴백)"
```

---

### Task 4: 락 → 풀 재고 동기화 + 형제 후보 무효화

**Files:**
- Modify: `src/lib/store.js`
- Test: `src/lib/__tests__/pool.test.js`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/__tests__/pool.test.js` import에 `lockCandidate` 추가:

```js
import { lockCandidate } from "../store.js";
```

파일 끝에 추가:

```js
describe("락 → 풀 sold + 형제 후보 무효화", () => {
  const prefs = { shape: "oval", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" };
  const form = () => ({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "", budget: null, metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: prefs, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] });

  it("두 주문이 같은 풀 스톤(POOL-000006 oval)을 후보로 가짐", () => {
    const o1 = createIntake(form()).order;
    const o2 = createIntake(form()).order;
    const c1 = listCandidates({ orderId: o1.id }).find((c) => c.poolDiamondId === "POOL-000006");
    const c2 = listCandidates({ orderId: o2.id }).find((c) => c.poolDiamondId === "POOL-000006");
    expect(c1 && c2).toBeTruthy();

    lockCandidate(c1.id);
    expect(getPoolDiamond("POOL-000006").availability).toBe("sold");
    // 다른 주문의 형제 후보는 무효화(unpublish + sold)
    const c2after = listCandidates({ orderId: o2.id }).find((c) => c.poolDiamondId === "POOL-000006");
    expect(c2after.published).toBe(false);
    expect(c2after.availability).toBe("sold");
    // sold 풀 스톤은 이후 새 주문에 매칭 안 됨
    expect(matchPoolForOrder(prefs).map((s) => s.id)).not.toContain("POOL-000006");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: FAIL — `availability` is "available" not "sold" (동기화 미구현)

- [ ] **Step 3: `lockCandidate` 수정**

`src/lib/store.js`의 `lockCandidate`를 교체:

```js
export function lockCandidate(diaId) {
  const c = getCandidate(diaId);
  c.locked = true;
  // 풀 스톤 소진 + 같은 스톤을 가리키는 다른 주문 후보 무효화 (이중 판매 방지)
  if (c.poolDiamondId) {
    const pool = getPoolDiamond(c.poolDiamondId);
    if (pool && pool.availability !== "sold") {
      pool.availability = "sold"; pool.updatedAt = now();
      audit("auto", "pool", pool.id, "availability", "available", "sold");
    }
    db().diamondCands.forEach((other) => {
      if (other.poolDiamondId === c.poolDiamondId && other.id !== c.id && !other.locked) {
        other.published = false;
        other.availability = "sold";
      }
    });
  }
  const order = getOpsOrder(c.orderId);
  updateOpsOrder(order.id, { selectedDiamondId: diaId, status: "QUOTATION" });
  upsertMilestone(order.id, "diamondLocked", { status: "done", publishToClient: true, clientUpdate: c.id });
  tryAutoQuote(order.id); // 스펙이 준비돼 있으면 어드민 없이 견적 즉시 발송
  return c;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/pool.test.js`
Expected: PASS (락 동기화 테스트 포함)

- [ ] **Step 5: 전체 회귀**

Run: `npx vitest run`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/lib/store.js src/lib/__tests__/pool.test.js
git diff --cached --stat
git commit -m "feat(pool): 락 시 풀 스톤 sold + 형제 후보 무효화(이중 판매 방지)"
```

---

### Task 5: i18n 문자열 (4개 언어)

**Files:**
- Modify: `src/platformStrings.js` (admin.menu.pool + admin.pool — en≈L112/118, ko≈L278/284, zh≈L444/450, es≈L610/616)
- Modify: `src/opsStrings.js` (supplierPool + supplierP.poolLink — supplierP en≈L114, ko≈L300, zh≈L486, es≈L672)

- [ ] **Step 1: platformStrings.js — 각 로케일 `admin.menu`에 `pool` 키 추가**

en `admin.menu`(`menu: { dashboard: "Dashboard", diamonds: "Diamonds", … }`)에 `pool: "Diamond Pool",` 추가. ko에 `pool: "다이아 풀",`, zh에 `pool: "钻石池",`, es에 `pool: "Pool de Diamantes",` 추가.

- [ ] **Step 2: platformStrings.js — 각 로케일 `admin` 객체에 `pool` 블록 추가**

각 `admin: {` 객체 안, `dia: {` 블록 바로 앞에 추가.

en:
```js
    pool: {
      title: "Vendor Diamond Pool", sub: "All suppliers' standing stock. Add stones, manage photos, and archive any entry.",
      filterAll: "All suppliers", supplier: "Supplier", stone: "Stone", fourC: "4C", cert: "Certificate",
      cost: "Cost", statusCol: "Status", photos: "Photos", edit: "Edit", save: "Save",
      archive: "Archive", restore: "Restore", archived: "Archived",
      avail: { available: "Available", unavailable: "Off", sold: "Sold" },
      newTitle: "Add a stone", addBtn: "Add to pool", count: (n) => `${n} stones`,
    },
```
ko:
```js
    pool: {
      title: "벤더 다이아 풀", sub: "모든 벤더의 상설 재고. 스톤 추가·사진 관리·아카이브 가능.",
      filterAll: "전체 벤더", supplier: "벤더", stone: "스톤", fourC: "4C", cert: "인증",
      cost: "원가", statusCol: "상태", photos: "사진", edit: "수정", save: "저장",
      archive: "아카이브", restore: "복원", archived: "아카이브됨",
      avail: { available: "재고 있음", unavailable: "내림", sold: "판매됨" },
      newTitle: "스톤 추가", addBtn: "풀에 추가", count: (n) => `스톤 ${n}개`,
    },
```
zh:
```js
    pool: {
      title: "供应商钻石池", sub: "所有供应商的常备库存。可添加钻石、管理照片、归档任意条目。",
      filterAll: "全部供应商", supplier: "供应商", stone: "钻石", fourC: "4C", cert: "证书",
      cost: "成本", statusCol: "状态", photos: "照片", edit: "编辑", save: "保存",
      archive: "归档", restore: "恢复", archived: "已归档",
      avail: { available: "有货", unavailable: "下架", sold: "已售" },
      newTitle: "添加钻石", addBtn: "加入池", count: (n) => `${n} 颗`,
    },
```
es:
```js
    pool: {
      title: "Pool de Diamantes", sub: "Stock permanente de todos los proveedores. Añade piedras, gestiona fotos y archiva.",
      filterAll: "Todos los proveedores", supplier: "Proveedor", stone: "Piedra", fourC: "4C", cert: "Certificado",
      cost: "Costo", statusCol: "Estado", photos: "Fotos", edit: "Editar", save: "Guardar",
      archive: "Archivar", restore: "Restaurar", archived: "Archivado",
      avail: { available: "Disponible", unavailable: "Retirada", sold: "Vendida" },
      newTitle: "Añadir piedra", addBtn: "Añadir al pool", count: (n) => `${n} piedras`,
    },
```

- [ ] **Step 3: opsStrings.js — 각 로케일 `supplierP`에 `poolLink` + `supplierPool` 블록 추가**

각 로케일 `supplierP: {` 객체의 `title:` 줄 뒤에 `poolLink: "…"`를 추가하고, `supplierP` 객체 **닫힘 `},` 바로 뒤**에 `supplierPool` 블록을 추가한다.

en — `supplierP`에 `poolLink: "My Pool",` 추가, 그리고 `supplierP` 닫힘 뒤:
```js
  supplierPool: {
    title: "My Diamond Pool", sub: "Pre-load your stock — matching orders pull from here automatically.",
    stone: "Stone", fourC: "4C", cert: "Certificate", cost: "Cost ($)", statusCol: "Status", photos: "Photos",
    archive: "Archive", restore: "Restore", archived: "Archived", toggleAvail: "Toggle",
    avail: { available: "Available", unavailable: "Off", sold: "Sold" },
    newTitle: "Add a stone", addBtn: "Add to pool",
    shape: "Shape", carat: "Carat", color: "Color", clarity: "Clarity", growth: "Growth", lab: "Lab",
    certOrg: "Cert org", certNo: "Cert no.", treatment: "Color treatment", costField: "Your cost ($)", media: "Photos & video",
    count: (n) => `${n} stones`,
  },
```
ko — `poolLink: "내 풀",`, 그리고:
```js
  supplierPool: {
    title: "내 다이아 풀", sub: "재고를 미리 올려두세요 — 조건 맞는 주문이 자동으로 여기서 가져갑니다.",
    stone: "스톤", fourC: "4C", cert: "인증", cost: "원가 ($)", statusCol: "상태", photos: "사진",
    archive: "아카이브", restore: "복원", archived: "아카이브됨", toggleAvail: "전환",
    avail: { available: "재고 있음", unavailable: "내림", sold: "판매됨" },
    newTitle: "스톤 추가", addBtn: "풀에 추가",
    shape: "셰이프", carat: "캐럿", color: "컬러", clarity: "클래리티", growth: "성장방식", lab: "감정소",
    certOrg: "인증기관", certNo: "인증번호", treatment: "컬러 처리", costField: "내 원가 ($)", media: "사진·영상",
    count: (n) => `스톤 ${n}개`,
  },
```
zh — `poolLink: "我的钻石池",`, 그리고:
```js
  supplierPool: {
    title: "我的钻石池", sub: "提前上传库存——符合条件的订单会自动从这里匹配。",
    stone: "钻石", fourC: "4C", cert: "证书", cost: "成本 ($)", statusCol: "状态", photos: "照片",
    archive: "归档", restore: "恢复", archived: "已归档", toggleAvail: "切换",
    avail: { available: "有货", unavailable: "下架", sold: "已售" },
    newTitle: "添加钻石", addBtn: "加入池",
    shape: "形状", carat: "克拉", color: "颜色", clarity: "净度", growth: "生长方式", lab: "鉴定所",
    certOrg: "鉴定机构", certNo: "证书编号", treatment: "颜色处理", costField: "我的成本 ($)", media: "照片·视频",
    count: (n) => `${n} 颗`,
  },
```
es — `poolLink: "Mi pool",`, 그리고:
```js
  supplierPool: {
    title: "Mi Pool de Diamantes", sub: "Carga tu stock por adelantado — los pedidos compatibles se surten de aquí automáticamente.",
    stone: "Piedra", fourC: "4C", cert: "Certificado", cost: "Costo ($)", statusCol: "Estado", photos: "Fotos",
    archive: "Archivar", restore: "Restaurar", archived: "Archivado", toggleAvail: "Cambiar",
    avail: { available: "Disponible", unavailable: "Retirada", sold: "Vendida" },
    newTitle: "Añadir piedra", addBtn: "Añadir al pool",
    shape: "Forma", carat: "Quilates", color: "Color", clarity: "Pureza", growth: "Crecimiento", lab: "Laboratorio",
    certOrg: "Entidad cert.", certNo: "N.º cert.", treatment: "Tratamiento de color", costField: "Tu costo ($)", media: "Fotos y video",
    count: (n) => `${n} piedras`,
  },
```

- [ ] **Step 4: 빌드로 문자열 객체 정합성 확인**

Run: `npm run build`
Expected: 빌드 성공 (쉼표·괄호 오류 없음)

- [ ] **Step 5: 커밋**

```bash
git add src/platformStrings.js src/opsStrings.js
git diff --cached --stat
git commit -m "feat(pool): 벤더 풀·어드민 풀 문자열 4개 언어"
```

---

### Task 6: 벤더 풀 페이지 `/supplier/pool`

**Files:**
- Create: `src/pages/supplier/SupplierPool.jsx`
- Modify: `src/App.jsx`
- Modify: `src/pages/supplier/SupplierQueue.jsx`

- [ ] **Step 1: SupplierPool.jsx 작성**

`src/pages/supplier/SupplierPool.jsx` 생성:

```jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { listPoolDiamonds, savePoolDiamond, archivePoolDiamond, setPoolAvailability } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, usd } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

const SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher", "heart"];
const empty = { shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", igiNo: "", colorTreatment: "disclosed", procurementCostUsd: "" };

export default function SupplierPool() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.supplierPool;
  const { user } = useAuth();
  const stones = listPoolDiamonds({ supplierId: user.id, includeArchived: true });
  const [form, setForm] = useState(empty);
  const [media, setMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function add(e) {
    e.preventDefault();
    savePoolDiamond({
      supplierId: user.id, shape: form.shape, carat: Number(form.carat), color: form.color, clarity: form.clarity,
      growth: form.growth, lab: form.lab, certOrg: form.certOrg, igiNo: form.igiNo,
      colorTreatment: form.colorTreatment, procurementCostUsd: Number(form.procurementCostUsd) || 0,
      ...(media.length ? { media } : {}),
    });
    setForm(empty); setMedia([]);
  }

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>
      <p style={{ marginTop: -28, marginBottom: 24 }}><Link className="text-link" to="/supplier">← {p.supplierP.queue}</Link></p>

      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{t.count(listPoolDiamonds({ supplierId: user.id }).length)}</h3>
        <table className="data-table">
          <thead><tr><th>{t.stone}</th><th>{t.fourC}</th><th>{t.cert}</th><th>{t.cost}</th><th>{t.statusCol}</th><th>{t.photos}</th><th></th></tr></thead>
          <tbody>
            {stones.map((s) => (
              <tr key={s.id} style={{ opacity: s.archived ? 0.5 : 1 }}>
                <td>{p.shapes[s.shape]} {Number(s.carat).toFixed(2)}ct</td>
                <td>{s.color} · {s.clarity} · {s.growth}</td>
                <td>{s.certOrg} {s.igiNo}</td>
                <td>{usd(s.procurementCostUsd)}</td>
                <td>
                  {s.availability === "sold" ? (
                    <span className="status-badge">{t.avail.sold}</span>
                  ) : (
                    <button className={`chip ${s.availability === "available" ? "is-active" : ""}`}
                      disabled={s.archived}
                      onClick={() => setPoolAvailability(s.id, s.availability === "available" ? "unavailable" : "available")}>
                      {s.availability === "available" ? t.avail.available : t.avail.unavailable}
                    </button>
                  )}
                </td>
                <td>{(s.media || []).length}</td>
                <td>
                  <button className="button small" onClick={() => archivePoolDiamond(s.id, !s.archived)}>
                    {s.archived ? t.restore : t.archive}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={add}>
        <h3>{t.newTitle}</h3>
        <div className="filter-grid">
          <label className="field"><span>{t.shape}</span>
            <select value={form.shape} onChange={(e) => setF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{p.shapes[s]}</option>)}</select></label>
          <label className="field"><span>{t.carat}</span><input type="number" step="0.01" value={form.carat} onChange={(e) => setF({ carat: e.target.value })} required /></label>
          <label className="field"><span>{t.color}</span>
            <select value={form.color} onChange={(e) => setF({ color: e.target.value })}>{["D", "E", "F", "G", "H", "I", "J"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{t.clarity}</span>
            <select value={form.clarity} onChange={(e) => setF({ clarity: e.target.value })}>{["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{t.growth}</span>
            <select value={form.growth} onChange={(e) => setF({ growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
          <label className="field"><span>{t.lab}</span>
            <select value={form.lab} onChange={(e) => setF({ lab: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>{t.certOrg}</span>
            <select value={form.certOrg} onChange={(e) => setF({ certOrg: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>{t.certNo}</span><input value={form.igiNo} onChange={(e) => setF({ igiNo: e.target.value })} required /></label>
          <label className="field"><span>{t.costField}</span><input type="number" step="10" value={form.procurementCostUsd} onChange={(e) => setF({ procurementCostUsd: e.target.value })} required /></label>
        </div>
        <MediaPicker value={media} onChange={setMedia} />
        <button className="button primary" type="submit">{t.addBtn}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: App.jsx 라우트 추가**

`src/App.jsx`에서 SupplierPool import 추가(다른 supplier import 근처):

```jsx
import SupplierPool from "./pages/supplier/SupplierPool.jsx";
```

`<Route path="supplier" …>` 라인 다음에 추가:

```jsx
        <Route path="supplier/pool" element={<RequireRole role="supplier"><SupplierPool /></RequireRole>} />
```

- [ ] **Step 3: SupplierQueue.jsx에 "My Pool" 링크**

`src/pages/supplier/SupplierQueue.jsx`에서 `import { Link } from "react-router-dom";`가 이미 있으므로, `<p className="page-sub">{t.sub(user.name)}</p>` 줄 바로 다음에 추가:

```jsx
      <p style={{ marginTop: -28, marginBottom: 24 }}><Link className="text-link" to="/supplier/pool">{t.poolLink} →</Link></p>
```

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add src/pages/supplier/SupplierPool.jsx src/App.jsx src/pages/supplier/SupplierQueue.jsx
git diff --cached --stat
git commit -m "feat(pool): 벤더 풀 페이지 /supplier/pool + 큐 링크"
```

---

### Task 7: 운영자 풀 오버사이트 `/admin/pool`

**Files:**
- Create: `src/pages/admin/AdminPool.jsx`
- Modify: `src/App.jsx`
- Modify: `src/pages/admin/Admin.jsx`

- [ ] **Step 1: AdminPool.jsx 작성**

`src/pages/admin/AdminPool.jsx` 생성:

```jsx
import { useState } from "react";
import { listPoolDiamonds, savePoolDiamond, archivePoolDiamond, listVendors } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, usd } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

const SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher", "heart"];

export default function AdminPool() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.admin.pool;
  const vendors = listVendors();
  const [filter, setFilter] = useState("");
  const all = listPoolDiamonds({ includeArchived: true });
  const stones = filter ? all.filter((s) => s.supplierId === filter) : all;
  const supplierName = (id) => vendors.find((v) => v.id === id)?.name || id;

  const [form, setForm] = useState({ supplierId: vendors[0]?.id || "", shape: "round", carat: "1.5", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", certOrg: "IGI", igiNo: "", colorTreatment: "disclosed", procurementCostUsd: "" });
  const [media, setMedia] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editMedia, setEditMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function add(e) {
    e.preventDefault();
    savePoolDiamond({
      supplierId: form.supplierId, shape: form.shape, carat: Number(form.carat), color: form.color, clarity: form.clarity,
      growth: form.growth, lab: form.lab, certOrg: form.certOrg, igiNo: form.igiNo,
      colorTreatment: form.colorTreatment, procurementCostUsd: Number(form.procurementCostUsd) || 0,
      ...(media.length ? { media } : {}),
    });
    setForm({ ...form, igiNo: "", procurementCostUsd: "" }); setMedia([]);
  }
  function startEdit(s) { setEditId(s.id); setEditMedia(s.media || []); }
  function saveEditMedia() { savePoolDiamond({ id: editId, media: editMedia }); setEditId(null); setEditMedia([]); }

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>{t.title} · {t.count(stones.length)}</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "8px 10px" }}>
            <option value="">{t.filterAll}</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <p className="form-hint" style={{ marginTop: 6 }}>{t.sub}</p>
        <table className="data-table">
          <thead><tr><th>{t.supplier}</th><th>{t.stone}</th><th>{t.fourC}</th><th>{t.cert}</th><th>{t.cost}</th><th>{t.statusCol}</th><th>{t.photos}</th><th></th></tr></thead>
          <tbody>
            {stones.map((s) => (
              <tr key={s.id} style={{ opacity: s.archived ? 0.5 : 1 }}>
                <td>{supplierName(s.supplierId)}</td>
                <td>{p.shapes[s.shape]} {Number(s.carat).toFixed(2)}ct</td>
                <td>{s.color} · {s.clarity} · {s.growth}</td>
                <td>{s.certOrg} {s.igiNo}</td>
                <td>{usd(s.procurementCostUsd)}</td>
                <td><span className="status-badge">{t.avail[s.availability] || s.availability}{s.archived ? ` · ${t.archived}` : ""}</span></td>
                <td>{(s.media || []).length}</td>
                <td>
                  <div className="row-actions">
                    <button className="button small" onClick={() => startEdit(s)}>{t.photos}</button>
                    <button className="button small" onClick={() => archivePoolDiamond(s.id, !s.archived)}>{s.archived ? t.restore : t.archive}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <div className="panel form-stack">
          <h3>{t.edit} — {editId}</h3>
          <MediaPicker value={editMedia} onChange={setEditMedia} />
          <div className="row-actions">
            <button className="button primary small" onClick={saveEditMedia}>{t.save}</button>
            <button className="button small" onClick={() => setEditId(null)}>✕</button>
          </div>
        </div>
      )}

      <form className="panel form-stack" onSubmit={add}>
        <h3>{t.newTitle}</h3>
        <div className="filter-grid">
          <label className="field"><span>{t.supplier}</span>
            <select value={form.supplierId} onChange={(e) => setF({ supplierId: e.target.value })} required>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.shape}</span>
            <select value={form.shape} onChange={(e) => setF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{p.shapes[s]}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.carat}</span><input type="number" step="0.01" value={form.carat} onChange={(e) => setF({ carat: e.target.value })} required /></label>
          <label className="field"><span>{p.supplierPool.color}</span>
            <select value={form.color} onChange={(e) => setF({ color: e.target.value })}>{["D", "E", "F", "G", "H", "I", "J"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.clarity}</span>
            <select value={form.clarity} onChange={(e) => setF({ clarity: e.target.value })}>{["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span>{p.supplierPool.growth}</span>
            <select value={form.growth} onChange={(e) => setF({ growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
          <label className="field"><span>{p.supplierPool.certOrg}</span>
            <select value={form.certOrg} onChange={(e) => setF({ certOrg: e.target.value })}><option>IGI</option><option>GIA</option></select></label>
          <label className="field"><span>{p.supplierPool.certNo}</span><input value={form.igiNo} onChange={(e) => setF({ igiNo: e.target.value })} required /></label>
          <label className="field"><span>{p.supplierPool.costField}</span><input type="number" step="10" value={form.procurementCostUsd} onChange={(e) => setF({ procurementCostUsd: e.target.value })} required /></label>
        </div>
        <MediaPicker value={media} onChange={setMedia} />
        <button className="button primary" type="submit">{t.addBtn}</button>
      </form>
    </>
  );
}
```

- [ ] **Step 2: App.jsx 라우트 추가**

`src/App.jsx`에서 AdminPool import 추가:

```jsx
import AdminPool from "./pages/admin/AdminPool.jsx";
```

`<Route path="diamonds" element={<AdminDiamonds />} />` 다음에 추가:

```jsx
          <Route path="pool" element={<AdminPool />} />
```

- [ ] **Step 3: Admin.jsx 사이드바 항목 추가**

`src/pages/admin/Admin.jsx`의 `menu` 배열에서 `{ to: "/admin/diamonds", key: "diamonds" },` 다음에 추가:

```jsx
    { to: "/admin/pool", key: "pool" },
```

(렌더는 `p.admin.menu[m.key]` — Task 5에서 `pool` 키 추가됨.)

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add src/pages/admin/AdminPool.jsx src/App.jsx src/pages/admin/Admin.jsx
git diff --cached --stat
git commit -m "feat(pool): 운영자 풀 오버사이트 /admin/pool + 사이드바"
```

---

### Task 8: 브라우저 검증

**Files:** 없음 (검증만)

> 병행 세션이 라이브 편집 중이면 dev 서버가 리로드되어 검증이 흔들린다. 현재 HEAD로 임시 워크트리를 만들어 격리 검증:
> ```bash
> NEW=$(git rev-parse HEAD)
> git worktree add /tmp/lumina-pool-verify "$NEW"
> ln -s "$(pwd)/node_modules" /tmp/lumina-pool-verify/node_modules
> (cd /tmp/lumina-pool-verify && npx vite --port 5176 --strictPort)
> ```

- [ ] **Step 1: 벤더 풀 확인 (supplier@demo.com / demo1234)**

`http://localhost:5176/login` → 로그인 → `/supplier/pool`:
1. 시드 풀 스톤(u-supplier1 소유분 4개)이 테이블에 표시 — 컬럼: 스톤·4C·인증·원가·상태·사진수.
2. 재고 토글: "재고 있음" 칩 클릭 → "내림"으로 전환, 다시 클릭 → 복귀.
3. 추가 폼으로 새 스톤(round 1.5 E VS1 CVD) + 사진 추가 → 테이블에 즉시 추가.
4. 아카이브 버튼 → 행이 흐려지고 "복원"으로 바뀜.

- [ ] **Step 2: 자동매칭 확인 (고객 흐름)**

`/custom/new` 솔리테어(round 1.5 E VS1 CVD 기본값)로 인테이크 제출 → 발급된 `/track/:id?code=` 포털에서 **다이아 후보가 여러 개 자동 표시**되는지 확인(벤더 제출/운영자 개입 없이). 후보 사진이 풀 스톤 사진과 동일한지 확인.

- [ ] **Step 3: 운영자 풀 확인 (admin@demo.com)**

`/admin` → 사이드바 "Diamond Pool" → `/admin/pool`:
1. 모든 벤더 스톤 표시 + 벤더 필터 드롭다운 동작.
2. "사진" 버튼 → MediaPicker 패널 열림 → 사진 추가/제거 → 저장 → 사진수 갱신.
3. 새 스톤을 특정 벤더로 추가 → 그 벤더 필터에서 보임.
4. 아카이브/복원 동작.

- [ ] **Step 4: 콘솔 에러 0 확인 + 스크린샷**

콘솔 에러 0 확인, 벤더 풀·운영자 풀·고객 후보 화면 스크린샷을 사용자에게 공유.

- [ ] **Step 5: 워크트리 정리**

```bash
git worktree remove --force /tmp/lumina-pool-verify
```

---

## Self-Review 결과

- **스펙 커버리지**: 데이터 모델(Task 2), 매칭 기준 셰이프+등급이상+캐럿+성장(Task 1·3), 자동매칭 무개입(Task 3), 락 시 차감+이중판매 방지(Task 4), 권한 벤더/운영자(Task 2 스코프 + Task 6·7 페이지), 매칭 0건 폴백(Task 3), 아카이브 소프트삭제(Task 2), 사진 CRUD(Task 6·7 MediaPicker), 시드+DB v11+i18n(Task 2·5), 테스트(Task 1~4) — 전부 매핑됨.
- **플레이스홀더**: 없음(전체 코드·문구 포함). Task 3 Step 1의 매칭 카운트는 Step 5에서 실측으로 확정하라고 명시.
- **타입 일관성**: `poolDiamonds` 필드(supplierId·shape·carat·color·clarity·growth·lab·certOrg·igiNo·reportUrl·proportions·colorTreatment·media·procurementCostUsd·availability·archived·createdAt·updatedAt)가 시드·CRUD·매칭·페이지에서 동일. 후보 스냅샷의 `poolDiamondId`가 Task 3 생성 ↔ Task 4 소비에서 일치. 함수명 `listPoolDiamonds`/`getPoolDiamond`/`savePoolDiamond`/`archivePoolDiamond`/`setPoolAvailability`/`matchPoolForOrder`/`poolStoneMatches` 전 태스크 일관. settings 키 `poolCaratUnder`/`poolCaratOver`/`poolMatchLimit` 시드(Task 2)↔매칭(Task 3) 일치.
- **회귀 위험**: 솔리테어 인테이크가 더 이상 무조건 `diamondCandidates` PR을 발행하지 않음 → 기존 ops/autoFlow 테스트가 이를 단언하면 Task 3 Step 6에서 의도 확인 후 최소 수정.
