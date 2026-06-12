# 비주얼 커뮤니케이션 레이어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 언어가 다른 벤더↔구매자가 사진/영상/핀+칩만으로 소통하는 레이어를 기존 ops 도메인 위에 구축 — 의도 입력(레퍼런스+핀), 3단계 컨펌(스톤/디자인/최종), 구조화 수정 요청, 슬롯형 벤더 제출.

**Architecture:** 순수 로직(`chips.js`)과 store 확장(v7)을 TDD로 먼저 깔고, 그 위에 공유 컴포넌트 `PinAnnotator`를 만들어 IntakeForm·ClientPortal·SupplierTask·AdminOpsOrder 네 화면에 꽂는다. 자유 텍스트 입력은 어디에도 추가하지 않는다(칩 key + 수치만). 모든 신규 문자열은 opsStrings `visual` 네임스페이스에 4개 언어(EN/中文/KO/ES)로 추가.

**Tech Stack:** Vite + React 19, react-router 7, vitest (node, lib만 테스트 — 컴포넌트 테스트 인프라 없음 → UI는 build + 수동 검증), mock localStorage store.

**Spec:** `docs/superpowers/specs/2026-06-12-visual-comm-layer-design.md`

---

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `src/lib/chips.js` | 생성 | 칩 어휘 사전(기본값)·주석 검증·다국어 포맷 — 순수 로직 |
| `src/lib/__tests__/chips.test.js` | 생성 | 칩 로직 테스트 |
| `src/lib/__tests__/visualStore.test.js` | 생성 | store 확장 테스트 (레퍼런스/구조화 피드백/수수료/슬롯/최종컨펌/보안) |
| `src/lib/seed.js` | 수정 | chipCatalog 슬라이스, referenceMedia 시드, freeMinorRevisions 설정 |
| `src/lib/store.js` | 수정 | v7 키, listChips/saveChip, reviewReferenceMedia, decideCad 확장, 슬롯, confirmFinal |
| `src/lib/ops.js` | 수정 | CAD_SLOTS, supplierTaskView에 visualBrief(승인 레퍼런스+리비전 핀) |
| `src/opsStrings.js` | 수정 | `visual` 네임스페이스 ×4 locale |
| `src/components/PinAnnotator.jsx` | 생성 | 핀+칩 주석 컴포넌트 (편집/읽기전용) |
| `src/platform.css` | 수정 | 핀/체크포인트/비교 뷰 스타일 |
| `src/pages/IntakeForm.jsx` | 수정 | 레퍼런스 업로드 + 핀 주석 섹션 |
| `src/pages/ClientPortal.jsx` | 수정 | 타임라인 체크포인트 구조 + 구조화 수정요청 + 최종 컨펌 카드 |
| `src/pages/supplier/SupplierTask.jsx` | 수정 | 비주얼 브리프(읽기전용 핀) + CAD 슬롯 제출 |
| `src/pages/admin/AdminOpsOrder.jsx` | 수정 | 레퍼런스 검수 큐 + 주석/수수료 표시 |
| `src/pages/admin/AdminSettings.jsx` | 수정 | 칩 카탈로그 관리 패널 |

순환 import 금지: `chips.js`는 어떤 내부 모듈도 import하지 않는다. `store.js` → `chips.js` 단방향.

---

### Task 1: 칩 어휘 사전 (`src/lib/chips.js`)

**Files:**
- Create: `src/lib/chips.js`
- Test: `src/lib/__tests__/chips.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/lib/__tests__/chips.test.js
import { describe, expect, it } from "vitest";
import { CHIP_PARTS, defaultChipCatalog, validateAnnotation, formatAnnotation } from "../chips.js";

const catalog = defaultChipCatalog();

describe("chips — 무언어 칩 어휘 사전", () => {
  it("모든 칩이 4개 언어 라벨을 가진다", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(10);
    for (const c of catalog) {
      for (const loc of ["en", "zh", "ko", "es"]) expect(c.labels[loc], `${c.key}.${loc}`).toBeTruthy();
    }
  });

  it("validateAnnotation — 유효/무효 판정", () => {
    const ok = { pinId: 1, x: 50, y: 30, part: "band", chipKey: "thinner", value: 1.6 };
    expect(validateAnnotation(ok, catalog)).toBe(true);
    expect(validateAnnotation({ ...ok, x: 101 }, catalog)).toBe(false);            // 좌표 범위
    expect(validateAnnotation({ ...ok, part: "engine" }, catalog)).toBe(false);    // 미지의 부위
    expect(validateAnnotation({ ...ok, part: "band", chipKey: "prong6" }, catalog)).toBe(false); // 칩-부위 불일치
    expect(validateAnnotation({ ...ok, value: null }, catalog)).toBe(false);       // mm 칩인데 값 없음
    expect(validateAnnotation({ pinId: 2, x: 10, y: 10, part: "prong", chipKey: "prong6", value: 3 }, catalog)).toBe(false); // none 칩인데 값 있음
    expect(validateAnnotation({ pinId: 2, x: 10, y: 10, part: "prong", chipKey: "prong6" }, catalog)).toBe(true);
  });

  it("formatAnnotation — 같은 주석이 ko/zh로 각각 렌더링", () => {
    const a = { pinId: 1, x: 50, y: 30, part: "band", chipKey: "thinner", value: 1.6 };
    expect(formatAnnotation(a, catalog, "ko", { band: "밴드" })).toBe("밴드 · 더 얇게 → 1.6mm");
    expect(formatAnnotation(a, catalog, "zh", { band: "戒臂" })).toBe("戒臂 · 更细 → 1.6mm");
  });

  it("CHIP_PARTS 고정 목록", () => {
    expect(CHIP_PARTS).toContain("band");
    expect(CHIP_PARTS).toContain("prong");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/chips.test.js` / Expected: FAIL (`Failed to load ../chips.js`)

- [ ] **Step 3: 구현**

```js
// src/lib/chips.js
// 칩 어휘 사전 — 무언어(zero-language) 수정 요청의 단어장.
// 자유 텍스트 입력이 없는 것이 보안 설계의 핵심: 오역·연락처 교환 경로가 구조적으로 없다.
// 이 파일은 내부 모듈을 import하지 않는다 (store.js → chips.js 단방향).

export const CHIP_PARTS = ["band", "prong", "stone", "halo", "gallery", "chain", "clasp", "surface"];

// parts: null = 모든 부위 적용 가능. valueType: "mm" | "none".
export function defaultChipCatalog() {
  return [
    { key: "thinner", parts: ["band", "prong", "chain"], valueType: "mm", active: true,
      labels: { en: "Thinner", zh: "更细", ko: "더 얇게", es: "Más fino" } },
    { key: "thicker", parts: ["band", "prong", "chain"], valueType: "mm", active: true,
      labels: { en: "Thicker", zh: "更粗", ko: "더 두껍게", es: "Más grueso" } },
    { key: "lower", parts: ["stone", "halo", "gallery"], valueType: "mm", active: true,
      labels: { en: "Set lower", zh: "降低镶座", ko: "세팅 낮게", es: "Engaste más bajo" } },
    { key: "higher", parts: ["stone", "halo", "gallery"], valueType: "mm", active: true,
      labels: { en: "Set higher", zh: "抬高镶座", ko: "세팅 높게", es: "Engaste más alto" } },
    { key: "smaller", parts: null, valueType: "mm", active: true,
      labels: { en: "Smaller", zh: "更小", ko: "더 작게", es: "Más pequeño" } },
    { key: "larger", parts: null, valueType: "mm", active: true,
      labels: { en: "Larger", zh: "更大", ko: "더 크게", es: "Más grande" } },
    { key: "prong4", parts: ["prong"], valueType: "none", active: true,
      labels: { en: "4 prongs", zh: "4爪", ko: "4프롱", es: "4 garras" } },
    { key: "prong6", parts: ["prong"], valueType: "none", active: true,
      labels: { en: "6 prongs", zh: "6爪", ko: "6프롱", es: "6 garras" } },
    { key: "polishHigh", parts: ["band", "surface"], valueType: "none", active: true,
      labels: { en: "High polish", zh: "高抛光", ko: "유광 마감", es: "Pulido brillante" } },
    { key: "polishMatte", parts: ["band", "surface"], valueType: "none", active: true,
      labels: { en: "Matte finish", zh: "哑光", ko: "무광 마감", es: "Acabado mate" } },
    { key: "likeReference", parts: null, valueType: "none", active: true,
      labels: { en: "Like my reference", zh: "按参考图", ko: "레퍼런스처럼", es: "Como mi referencia" } },
  ];
}

export function chipFor(catalog, key) {
  return catalog.find((c) => c.key === key && c.active !== false) || null;
}

export function chipAppliesTo(chip, part) {
  return !chip.parts || chip.parts.includes(part);
}

// annotation: { pinId, x, y, part, chipKey, value? } — x/y는 이미지 기준 % (0–100, 반응형 대응)
export function validateAnnotation(a, catalog) {
  if (!a || typeof a.x !== "number" || typeof a.y !== "number") return false;
  if (a.x < 0 || a.x > 100 || a.y < 0 || a.y > 100) return false;
  if (!CHIP_PARTS.includes(a.part)) return false;
  const chip = chipFor(catalog, a.chipKey);
  if (!chip || !chipAppliesTo(chip, a.part)) return false;
  if (chip.valueType === "mm") return typeof a.value === "number" && a.value > 0;
  return a.value == null;
}

// 같은 주석 데이터를 구매자/벤더가 각자의 언어로 읽는다 — 번역이 아니라 key 렌더링
export function formatAnnotation(a, catalog, locale, partLabels = {}) {
  const chip = catalog.find((c) => c.key === a.chipKey);
  const label = chip ? (chip.labels[locale] ?? chip.labels.en) : a.chipKey;
  const part = partLabels[a.part] || a.part;
  return chip?.valueType === "mm" && a.value != null ? `${part} · ${label} → ${a.value}mm` : `${part} · ${label}`;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/chips.test.js` / Expected: 4 passed
- [ ] **Step 5: Commit** — `git add src/lib/chips.js src/lib/__tests__/chips.test.js && git commit -m "feat(visual): 칩 어휘 사전 — 검증/4개 언어 포맷 (TDD)"`

---

### Task 2: store v7 — chipCatalog 슬라이스 + 시드

**Files:**
- Modify: `src/lib/seed.js` (import, settings, intakes, 슬라이스 추가)
- Modify: `src/lib/store.js:9-37` (KEY/isValidDB/구키 정리), 파일 말미에 chips API
- Test: `src/lib/__tests__/visualStore.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// src/lib/__tests__/visualStore.test.js
import { beforeEach, describe, expect, it } from "vitest";
import { resetDB, listChips, saveChip } from "../store.js";

beforeEach(() => resetDB());

describe("visual store — 칩 카탈로그", () => {
  it("시드에 칩 카탈로그가 있고 부위 필터가 동작한다", () => {
    expect(listChips().length).toBeGreaterThanOrEqual(10);
    const bandChips = listChips({ part: "band" });
    expect(bandChips.some((c) => c.key === "thinner")).toBe(true);
    expect(bandChips.some((c) => c.key === "prong6")).toBe(false); // 프롱 전용
  });

  it("saveChip — 비활성화하면 목록에서 빠진다", () => {
    const chip = listChips().find((c) => c.key === "polishMatte");
    saveChip({ ...chip, active: false });
    expect(listChips().some((c) => c.key === "polishMatte")).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/visualStore.test.js` / Expected: FAIL (`listChips is not a function`)

- [ ] **Step 3: seed.js 수정** — 3곳:

(a) 파일 상단 import 추가:
```js
import { defaultChipCatalog } from "./chips.js";
```
(b) `intakes`의 IN-000001 레코드에 필드 추가 (`termsAccepted: true,` 뒤):
```js
        referenceMedia: [
          { id: "REF-000001", kind: "image", src: "/assets/lineup-band.png", status: "approved",
            annotations: [{ pinId: 1, x: 50, y: 30, part: "prong", chipKey: "prong6" }] },
          { id: "REF-000002", kind: "image", src: "/assets/lineup-pendant.png", status: "pending", annotations: [] },
        ],
```
IN-000002에는 `referenceMedia: [],` 추가.

(c) `diamondPricing: defaultBenchmark(),` 아래에 슬라이스, `settings`에 키 추가:
```js
    chipCatalog: defaultChipCatalog(),
```
```js
      designChangeFeeUsd: 15, cancelAfterProductionMinUsd: 140, freeMinorRevisions: 1,
```

- [ ] **Step 4: store.js 수정**

`store.js:9` KEY 교체 및 구키 정리(`db()` 안 removeItem 목록에 v6 추가):
```js
const KEY = "lumina-db-v7"; // v7: 비주얼 커뮤니케이션 레이어 (chipCatalog, referenceMedia, 구조화 CAD 피드백)
```
```js
    storage.removeItem("lumina-db-v6");
```
`isValidDB`에 검사 추가:
```js
    && Array.isArray(d.chipCatalog)
```
파일 말미 `// ---------- misc ----------` 위에 추가:
```js
// ---------- visual comm layer: chip catalog ----------
export function listChips({ part } = {}) {
  return db().chipCatalog.filter((c) => c.active !== false && (!part || !c.parts || c.parts.includes(part)));
}
export function saveChip(chip) {
  const list = db().chipCatalog;
  const i = list.findIndex((c) => c.key === chip.key);
  if (i >= 0) list[i] = { ...list[i], ...chip };
  else list.push(chip);
  persist();
}
```

- [ ] **Step 5: 통과 확인** — Run: `npx vitest run` / Expected: 전체 통과 (기존 dealer/ops 테스트 포함 — isValidDB 변경이 메모리 스토리지 재시드로 흡수됨)
- [ ] **Step 6: Commit** — `git commit -am "feat(visual): store v7 — chipCatalog 슬라이스 + 레퍼런스 시드"`

---

### Task 3: 레퍼런스 미디어 — 접수·검수·벤더 브리프

**Files:**
- Modify: `src/lib/store.js` (`createIntake`, `supplierTasks`, 신규 `reviewReferenceMedia`)
- Modify: `src/lib/ops.js` (`supplierTaskView` 확장)
- Test: `src/lib/__tests__/visualStore.test.js` (추가)

- [ ] **Step 1: 실패하는 테스트 추가** (visualStore.test.js에 append)

```js
import {
  createIntake, getIntake, reviewReferenceMedia, supplierTasks, createProcurement,
  addCadVersion, decideCad,
} from "../store.js";

describe("visual store — 레퍼런스 미디어와 벤더 브리프", () => {
  it("인테이크 레퍼런스는 pending으로 저장, 무효 주석은 드랍", () => {
    const { intake } = createIntake({
      name: "Ref", contact: "r@x.com", productLine: "solitaire", category: "ring", styleId: "RING-001",
      metal: "18kw", conditional: { ringSize: "6" }, termsAccepted: true,
      referenceMedia: [{ kind: "image", src: "/up/a.png", annotations: [
        { pinId: 1, x: 40, y: 40, part: "band", chipKey: "thinner", value: 1.6 },
        { pinId: 2, x: 40, y: 40, part: "band", chipKey: "prong6" }, // 칩-부위 불일치 → 드랍
      ] }],
    });
    const saved = getIntake(intake.id).referenceMedia;
    expect(saved[0].status).toBe("pending");
    expect(saved[0].id).toMatch(/^REF-\d{6}$/);
    expect(saved[0].annotations.length).toBe(1);
  });

  it("벤더 태스크에는 승인된 레퍼런스만 — pending/rejected/고객명 미노출", () => {
    // 시드: IN-000001에 approved 1 + pending 1
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-25", brief: "ring cad" });
    const tasks = supplierTasks("u-supplier2");
    const json = JSON.stringify(tasks);
    expect(json).toContain("lineup-band.png");          // approved
    expect(json).not.toContain("lineup-pendant.png");   // pending
    expect(json).not.toContain("김지원");
    expect(json).not.toContain("DM-000001");
  });

  it("검수 승인/반려가 벤더 노출을 토글한다", () => {
    reviewReferenceMedia("IN-000001", "REF-000002", "approved");
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-25", brief: "x" });
    expect(JSON.stringify(supplierTasks("u-supplier2"))).toContain("lineup-pendant.png");
  });

  it("minorRevision 주석이 다음 CAD 태스크의 revision 브리프로 전달된다", () => {
    const r1 = addCadVersion("DM-000001", { fileUrl: "/cad-v1.png", supplierId: "u-supplier2" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [
      { pinId: 1, x: 30, y: 60, part: "band", chipKey: "thinner", value: 1.6 },
    ] }, "customer");
    createProcurement("DM-000001", { type: "cad", supplierId: "u-supplier2", dueDate: "2026-06-26", brief: "v2" });
    const task = supplierTasks("u-supplier2").find((x) => x.brief === "v2");
    expect(task.revision.fileUrl).toBe("/cad-v1.png");
    expect(task.revision.annotations[0].chipKey).toBe("thinner");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/visualStore.test.js` / Expected: FAIL (`reviewReferenceMedia is not a function`)

- [ ] **Step 3: 구현**

`store.js` 상단 import에 추가:
```js
import { validateAnnotation } from "./chips.js";
```
`createIntake`에서 `const intake = { ... }` 직전에 정규화, intake 객체에 주입:
```js
  const referenceMedia = (form.referenceMedia || []).map((m) => ({
    id: nextSeqId("REF"), kind: m.kind || "image", src: m.src, status: "pending",
    annotations: (m.annotations || []).filter((a) => validateAnnotation(a, db().chipCatalog)),
  }));
  const intake = { id: intakeId, orderId, ...form, referenceMedia, createdAt: now() };
```
`reviewReferenceMedia` 신규 (createIntake 아래):
```js
// 레퍼런스 검수 — 승인분만 벤더 브리프에 포함 (타인 디자인 도용·연락처 포함 이미지 차단)
export function reviewReferenceMedia(intakeId, refId, status, actor = "ops") {
  const m = getIntake(intakeId)?.referenceMedia?.find((r) => r.id === refId);
  if (!m) return null;
  audit(actor, "referenceMedia", refId, "status", m.status, status);
  m.status = status;
  persist();
  return m;
}
```
`supplierTasks` 교체:
```js
export function supplierTasks(supplierId) {
  return listProcurements({ supplierId }).map((pr) => {
    const order = getOpsOrder(pr.orderId);
    const style = order?.styleId ? getOpsStyle(order.styleId) : null;
    const intake = order ? getIntake(order.intakeId) : null;
    // CAD 태스크에는 최신 minorRevision 리뷰(이미지+핀)를 브리프로 동봉
    const revision = pr.type === "cad" && order
      ? listCadReviews(order.id).find((c) => c.decision === "minorRevision") || null
      : null;
    return supplierTaskView(pr, order, style, intake, revision);
  });
}
```
`ops.js` `supplierTaskView` 교체 (시그니처+반환 확장 — 보안 경계 유지):
```js
// 서플라이어 태스크 뷰: 고객 신원·판매가·Order ID 제외 (PR ID로만 식별)
// visualBrief: 검수 승인 레퍼런스 + 직전 리비전 핀만 — pending/rejected 절대 미포함
export function supplierTaskView(pr, order, style, intake = null, revisionReview = null) {
  return {
    id: pr.id,
    type: pr.type,
    dueDate: pr.dueDate,
    batchValidUntil: pr.batchValidUntil ?? null,
    brief: pr.brief,
    status: pr.status,
    requiredDate: order?.requiredDate ?? null,
    styleRef: style?.id ?? null,
    styleEstWeightG: style?.estWeightG ?? null,
    metal: pr.metal ?? null,
    measurements: pr.measurements ?? null,
    references: (intake?.referenceMedia || [])
      .filter((m) => m.status === "approved")
      .map(({ id, kind, src, annotations }) => ({ id, kind, src, annotations })),
    revision: revisionReview
      ? { version: revisionReview.version, fileUrl: revisionReview.fileUrl, annotations: revisionReview.annotations || [] }
      : null,
  };
}
```
주의: 이 시점에 `cadReviews.annotations`는 아직 없음 — Task 4에서 추가되므로 Task 3·4 테스트는 Task 4 완료 후 함께 green이 된다. Step 4의 기대 결과 참조.

- [ ] **Step 4: 부분 통과 확인** — Run: `npx vitest run src/lib/__tests__/visualStore.test.js` / Expected: 앞 3개 신규 테스트 PASS, `minorRevision 주석…` 테스트만 FAIL (annotations 미구현). 기존 스위트(`npx vitest run`)는 전체 통과 유지.
- [ ] **Step 5: Commit** — `git commit -am "feat(visual): 레퍼런스 접수·검수 + 벤더 비주얼 브리프 (승인분만 노출)"`

---

### Task 4: 구조화 CAD 피드백 + 무료 수정 한도/수수료

**Files:**
- Modify: `src/lib/store.js` (`addCadVersion`, `decideCad`, 신규 `freeRevisionsLeft`, `portalView`)
- Test: `src/lib/__tests__/visualStore.test.js` (추가)

- [ ] **Step 1: 실패하는 테스트 추가**

```js
import { freeRevisionsLeft, portalView, getSettings } from "../store.js";

describe("visual store — 구조화 피드백과 수정 한도", () => {
  it("주석은 검증 후 버전 레코드에 불변 저장", () => {
    const r1 = addCadVersion("DM-000002", { fileUrl: "/v1.png", supplierId: "u-supplier1" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [
      { pinId: 1, x: 20, y: 20, part: "chain", chipKey: "thinner", value: 1.2 },
      { pinId: 2, x: 200, y: 20, part: "chain", chipKey: "thinner", value: 1.2 }, // 좌표 무효 → 드랍
    ] }, "customer");
    expect(r1.annotations.length).toBe(1);
    expect(r1.feeAppliedUsd).toBe(0); // 1회차 무료
  });

  it("무료 한도 초과 시 accepted 견적 잔금에 designChangeFeeUsd 가산", () => {
    // DM-000002는 시드에 accepted 견적(잔금 577) 보유
    const fee = getSettings().designChangeFeeUsd;
    const r1 = addCadVersion("DM-000002", { fileUrl: "/v1.png", supplierId: "u-supplier1" });
    decideCad(r1.id, { decision: "minorRevision", annotations: [] }, "customer");
    expect(freeRevisionsLeft("DM-000002")).toBe(0);
    const r2 = addCadVersion("DM-000002", { fileUrl: "/v2.png", supplierId: "u-supplier1" });
    decideCad(r2.id, { decision: "minorRevision", annotations: [] }, "customer");
    expect(r2.feeAppliedUsd).toBe(fee);
    const v = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(v.quote.balanceUsd).toBe(577 + fee);
    expect(v.freeRevisionsLeft).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/visualStore.test.js` / Expected: FAIL (`freeRevisionsLeft is not a function`)

- [ ] **Step 3: 구현**

`addCadVersion`의 review 객체에 두 필드 추가 (`feedback: [],` 뒤):
```js
    annotations: [], media: [],
```
`decideCad` 교체:
```js
export function decideCad(reviewId, { decision, feedback, annotations, confirmedMeasurements }, actor) {
  const r = db().cadReviews.find((x) => x.id === reviewId);
  r.decision = decision;
  r.feedback = (feedback || []).map((f) => maskContacts(f)).filter(Boolean);
  r.annotations = (annotations || []).filter((a) => validateAnnotation(a, db().chipCatalog));
  r.confirmedMeasurements = confirmedMeasurements || "";
  r.decidedAt = now();
  r.feeAppliedUsd = 0;
  audit(actor, "cad", reviewId, "decision", null, decision);
  if (decision === "minorRevision") {
    // 무료 한도(freeMinorRevisions) 소진 후엔 디자인비를 잔금에 가산 — 무한 수정 루프 방지
    const prior = db().cadReviews.filter((c) => c.orderId === r.orderId && c.id !== r.id && c.decision === "minorRevision").length;
    if (prior >= db().settings.freeMinorRevisions) {
      const q = db().quotes.find((x) => x.orderId === r.orderId && x.status === "accepted");
      if (q) {
        const fee = db().settings.designChangeFeeUsd;
        audit(actor, "quote", q.id, "balanceUsd", String(q.balanceUsd), String(q.balanceUsd + fee));
        q.balanceUsd += fee;
        q.totalUsd += fee;
        r.feeAppliedUsd = fee;
      }
    }
  }
  if (decision === "approved") {
    upsertMilestone(r.orderId, "cadApproved", { status: "done", publishToClient: true, clientUpdate: `CAD V${r.version} approved` });
    upsertMilestone(r.orderId, "productionStarted", { status: "inProgress", publishToClient: true });
    updateOpsOrder(r.orderId, { status: "PRODUCTION" }, actor);
  }
  persist();
  return r;
}
```
`freeRevisionsLeft` 신규 (decideCad 아래):
```js
export function freeRevisionsLeft(orderId) {
  const used = db().cadReviews.filter((c) => c.orderId === orderId && c.decision === "minorRevision").length;
  return Math.max(0, db().settings.freeMinorRevisions - used);
}
```
`portalView` 반환 객체에 추가 (`actions:` 라인 위):
```js
    freeRevisionsLeft: freeRevisionsLeft(orderId),
    designChangeFeeUsd: db().settings.designChangeFeeUsd,
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run` / Expected: Task 3의 revision 테스트 포함 전체 통과 (기존 opsStore CAD 테스트의 feedback 문자열 경로도 유지 확인)
- [ ] **Step 5: Commit** — `git commit -am "feat(visual): 구조화 CAD 주석 + 무료 수정 한도/디자인비 가산"`

---

### Task 5: CAD 슬롯형 제출

**Files:**
- Modify: `src/lib/ops.js` (CAD_SLOTS), `src/lib/store.js` (`addCadVersion`, `submitCadForPr`)
- Test: `src/lib/__tests__/visualStore.test.js` (추가)

- [ ] **Step 1: 실패하는 테스트 추가**

```js
import { submitCadForPr, listCadReviews } from "../store.js";

describe("visual store — CAD 슬롯 제출", () => {
  it("슬롯 배열 제출 → media 보존, fileUrl은 첫 슬롯", () => {
    const pr = createProcurement("DM-000002", { type: "cad", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    submitCadForPr(pr.id, [
      { slot: "render360", kind: "video", src: "/r360.mp4" },
      { slot: "side", kind: "image", src: "/side.png" },
    ]);
    const r = listCadReviews("DM-000002")[0];
    expect(r.media.length).toBe(2);
    expect(r.media[0].slot).toBe("render360");
    expect(r.fileUrl).toBe("/r360.mp4");
  });

  it("레거시 문자열 제출도 동작", () => {
    const pr = createProcurement("DM-000002", { type: "cad", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    submitCadForPr(pr.id, "/single.png");
    expect(listCadReviews("DM-000002")[0].fileUrl).toBe("/single.png");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/visualStore.test.js` / Expected: FAIL (media undefined)

- [ ] **Step 3: 구현**

`ops.js` `PR_TYPES` 아래에:
```js
// 슬롯 구조가 "어떤 각도를 찍어야 하는지"를 언어 설명 없이 강제한다
export const CAD_SLOTS = ["render360", "side", "wear"];
```
`store.js` `addCadVersion` 시그니처/필드 교체:
```js
export function addCadVersion(orderId, { fileUrl, media, supplierId }) {
  const version = listCadReviews(orderId).length + 1;
  const review = {
    id: nextSeqId("CADR"), orderId, version,
    fileUrl: fileUrl || media?.[0]?.src || "",
    media: media || [],
    supplierUploadedAt: now(), internalReview: "", sentAt: null,
    decision: null, feedback: [], annotations: [], confirmedMeasurements: "", evidence: "", decidedAt: null,
  };
```
(이후 라인 동일 — `upsertMilestone`의 `link: fileUrl`은 `link: review.fileUrl`로 교체)

`submitCadForPr` 교체:
```js
// 서플라이어가 PR ID로 CAD 제출 — 문자열(레거시) 또는 슬롯 배열 [{slot, kind, src}]
export function submitCadForPr(prId, payload) {
  const pr = getProcurement(prId);
  const args = typeof payload === "string" ? { fileUrl: payload } : { media: payload };
  const review = addCadVersion(pr.orderId, { ...args, supplierId: pr.supplierId });
  pr.status = "submitted";
  persist();
  return review;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run` / Expected: 전체 통과
- [ ] **Step 5: Commit** — `git commit -am "feat(visual): CAD 슬롯형 제출 (render360/side/wear)"`

---

### Task 6: 최종 실물 컨펌

**Files:**
- Modify: `src/lib/store.js` (`submitQcForPr`, 신규 `confirmFinal`, `portalView`)
- Test: `src/lib/__tests__/visualStore.test.js` (추가)

- [ ] **Step 1: 실패하는 테스트 추가**

```js
import { submitQcForPr, confirmFinal, getOpsOrder, listCustomerActions, updateOpsOrder } from "../store.js";

describe("visual store — 최종 실물 컨펌", () => {
  it("QC 제출 → finalConfirmation 액션 생성(영상 링크), 컨펌 → BALANCE + 증거 보존", () => {
    updateOpsOrder("DM-000002", { status: "PRODUCTION" });
    const pr = createProcurement("DM-000002", { type: "qc", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    submitQcForPr(pr.id, { video: "/final.mp4", cert: "/igi.png", actualWeightG: 4.3 });
    expect(getOpsOrder("DM-000002").status).toBe("QC");
    const action = listCustomerActions("DM-000002", true).find((a) => a.type === "finalConfirmation");
    expect(action.link).toBe("/final.mp4");
    confirmFinal("DM-000002", "customer");
    expect(getOpsOrder("DM-000002").status).toBe("BALANCE");
    const closed = listCustomerActions("DM-000002").find((a) => a.type === "finalConfirmation");
    expect(closed.status).toBe("done");
    expect(closed.respondedAt).toBeTruthy(); // 컨펌 증거 (타임스탬프)
    const v = portalView("DM-000002", { queryCode: "H3WT-8RVK" });
    expect(v.finalAction).toBeNull(); // 컨펌 후 open 액션 없음
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/visualStore.test.js` / Expected: FAIL (`confirmFinal is not a function`)

- [ ] **Step 3: 구현**

`submitQcForPr`에 추가 (`audit(...)` 라인 앞):
```js
  // 체크포인트 ③: 완성품 영상 → 고객 최종 컨펌 액션 (증거 보존)
  createCustomerAction(pr.orderId, { type: "finalConfirmation", prompt: "finalQc", link: video || "" });
  const o = getOpsOrder(pr.orderId);
  if (o.status === "PRODUCTION") updateOpsOrder(o.id, { status: "QC" }, pr.supplierId);
```
`confirmFinal` 신규 (`respondCustomerAction` 아래):
```js
// 최종 실물 컨펌 — "이 영상의 실물이 배송됩니다"에 대한 고객 동의. 분쟁 방어 증거.
export function confirmFinal(orderId, actor) {
  const a = db().customerActions.find((x) => x.orderId === orderId && x.type === "finalConfirmation" && x.status === "open");
  if (!a) return null;
  respondCustomerAction(a.id, "confirmed", actor);
  updateOpsOrder(orderId, { status: "BALANCE" }, actor);
  return a;
}
```
`portalView` 반환에 추가 (`freeRevisionsLeft` 라인 아래):
```js
    finalAction: listCustomerActions(orderId, true).find((a) => a.type === "finalConfirmation") || null,
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run` / Expected: 전체 통과
- [ ] **Step 5: Commit** — `git commit -am "feat(visual): 최종 실물 컨펌 플로우 (QC 영상 → confirmFinal → BALANCE)"`

---

### Task 7: opsStrings `visual` 네임스페이스 (4개 언어)

**Files:**
- Modify: `src/opsStrings.js` — en/ko/zh/es 각 locale 객체에 `visual` 키 추가 (`opsA` 키 앞)

- [ ] **Step 1: en에 추가**

```js
  visual: {
    parts: { band: "Band", prong: "Prongs", stone: "Center stone", halo: "Halo", gallery: "Gallery", chain: "Chain", clasp: "Clasp", surface: "Surface" },
    refTitle: "Reference photos (optional)",
    refHint: "Show us what you like. Pin a spot and pick a tag — our workshop sees the same pins in their own language. No text needed.",
    refStatus: { pending: "Under review", approved: "Approved", rejected: "Not usable" },
    pinHint: "Click the image to drop a pin, then choose a tag.",
    addValue: "Target (mm)", removePin: "Remove",
    checkpoint: { stone: "Choose your diamond", design: "Approve the design", final: "Confirm the finished piece" },
    nowAction: "Your turn", upcoming: "Upcoming", doneTag: "Done",
    compareMine: "My style & reference", compareVendor: "Workshop proposal",
    approveCta: "Approve — start production", reviseCta: "Request changes (drop pins)", sendRevision: "Send change request",
    revisionsLeft: (n) => `${n} free revision${n === 1 ? "" : "s"} left`,
    feeNote: (f) => `Further revisions add a $${f} design fee`,
    finalTitle: "Final piece — photos & video",
    finalNotice: "The item in this video is the exact piece that will be shipped to you.",
    finalConfirm: "Confirm — ship my piece", finalConfirmed: "Confirmed — preparing shipment",
    slots: { render360: "360° render", side: "Side view", wear: "On-body / scale" },
    refReviewTitle: "Reference review", approve: "Approve", reject: "Reject",
    chipTitle: "Annotation chips (tap to enable/disable)",
  },
```

- [ ] **Step 2: ko에 추가**

```js
  visual: {
    parts: { band: "밴드", prong: "프롱", stone: "센터스톤", halo: "헤일로", gallery: "갤러리", chain: "체인", clasp: "클래스프", surface: "표면" },
    refTitle: "레퍼런스 사진 (선택)",
    refHint: "원하는 느낌을 보여주세요. 사진에 핀을 찍고 태그를 고르면 공방은 같은 핀을 자기 언어로 봅니다 — 글이 필요 없습니다.",
    refStatus: { pending: "검수중", approved: "승인됨", rejected: "사용 불가" },
    pinHint: "이미지를 클릭해 핀을 찍고 태그를 선택하세요.",
    addValue: "목표 (mm)", removePin: "삭제",
    checkpoint: { stone: "다이아몬드 선택", design: "디자인 승인", final: "완성품 최종 컨펌" },
    nowAction: "지금 할 일", upcoming: "다음 단계", doneTag: "완료",
    compareMine: "내 스타일 · 레퍼런스", compareVendor: "공방 제안",
    approveCta: "승인 — 제작 시작", reviseCta: "수정 요청 (핀 찍기)", sendRevision: "수정 요청 보내기",
    revisionsLeft: (n) => `무료 수정 ${n}회 남음`,
    feeNote: (f) => `추가 수정부터 디자인비 $${f} 부과`,
    finalTitle: "완성품 사진·영상",
    finalNotice: "이 영상 속 실물이 그대로 배송됩니다.",
    finalConfirm: "컨펌 — 배송 시작", finalConfirmed: "컨펌 완료 — 배송 준비중",
    slots: { render360: "360° 렌더링", side: "측면", wear: "착용/비율" },
    refReviewTitle: "레퍼런스 검수", approve: "승인", reject: "반려",
    chipTitle: "주석 칩 관리 (탭하여 활성/비활성)",
  },
```

- [ ] **Step 3: zh에 추가**

```js
  visual: {
    parts: { band: "戒臂", prong: "镶爪", stone: "主石", halo: "光环", gallery: "底座", chain: "链条", clasp: "扣环", surface: "表面" },
    refTitle: "参考图（可选）",
    refHint: "把喜欢的感觉拍给我们。在图上钉一个点并选择标签 — 工坊会以自己的语言看到同样的标记，无需文字。",
    refStatus: { pending: "审核中", approved: "已通过", rejected: "不可用" },
    pinHint: "点击图片放置图钉，然后选择标签。",
    addValue: "目标 (mm)", removePin: "删除",
    checkpoint: { stone: "挑选钻石", design: "确认设计", final: "确认成品" },
    nowAction: "待您操作", upcoming: "后续步骤", doneTag: "已完成",
    compareMine: "我的款式与参考", compareVendor: "工坊方案",
    approveCta: "通过 — 开始制作", reviseCta: "请求修改（标记图钉）", sendRevision: "发送修改请求",
    revisionsLeft: (n) => `剩余免费修改 ${n} 次`,
    feeNote: (f) => `此后每次修改收取 $${f} 设计费`,
    finalTitle: "成品照片·视频",
    finalNotice: "视频中的实物即为将要发货的成品。",
    finalConfirm: "确认 — 安排发货", finalConfirmed: "已确认 — 备货中",
    slots: { render360: "360° 渲染", side: "侧面", wear: "佩戴/比例" },
    refReviewTitle: "参考图审核", approve: "通过", reject: "驳回",
    chipTitle: "标注标签管理（点按启用/停用）",
  },
```

- [ ] **Step 4: es에 추가**

```js
  visual: {
    parts: { band: "Banda", prong: "Garras", stone: "Piedra central", halo: "Halo", gallery: "Galería", chain: "Cadena", clasp: "Broche", surface: "Superficie" },
    refTitle: "Fotos de referencia (opcional)",
    refHint: "Muéstranos lo que te gusta. Marca un punto y elige una etiqueta — el taller ve los mismos pines en su idioma. Sin texto.",
    refStatus: { pending: "En revisión", approved: "Aprobada", rejected: "No utilizable" },
    pinHint: "Haz clic en la imagen para poner un pin y elige una etiqueta.",
    addValue: "Objetivo (mm)", removePin: "Quitar",
    checkpoint: { stone: "Elige tu diamante", design: "Aprueba el diseño", final: "Confirma la pieza terminada" },
    nowAction: "Tu turno", upcoming: "Próximos pasos", doneTag: "Listo",
    compareMine: "Mi estilo y referencia", compareVendor: "Propuesta del taller",
    approveCta: "Aprobar — iniciar producción", reviseCta: "Pedir cambios (poner pines)", sendRevision: "Enviar solicitud de cambios",
    revisionsLeft: (n) => `${n} revisión(es) gratis restante(s)`,
    feeNote: (f) => `Las siguientes revisiones añaden $${f} de tarifa de diseño`,
    finalTitle: "Pieza final — fotos y video",
    finalNotice: "La pieza de este video es exactamente la que se enviará.",
    finalConfirm: "Confirmar — enviar mi pieza", finalConfirmed: "Confirmado — preparando envío",
    slots: { render360: "Render 360°", side: "Vista lateral", wear: "Puesto / escala" },
    refReviewTitle: "Revisión de referencias", approve: "Aprobar", reject: "Rechazar",
    chipTitle: "Etiquetas de anotación (toca para activar/desactivar)",
  },
```

- [ ] **Step 5: 빌드 확인** — Run: `npm run build` / Expected: 성공 (문법 오류 없음)
- [ ] **Step 6: Commit** — `git commit -am "feat(visual): visual 네임스페이스 문자열 4개 언어"`

---

### Task 8: `<PinAnnotator>` 컴포넌트 + CSS

**Files:**
- Create: `src/components/PinAnnotator.jsx`
- Modify: `src/platform.css` (말미 append)

- [ ] **Step 1: 컴포넌트 작성**

```jsx
// src/components/PinAnnotator.jsx
import { useState } from "react";
import { useLocale } from "../i18n.jsx";
import { getDB, listChips } from "../lib/store.js";
import { CHIP_PARTS, formatAnnotation } from "../lib/chips.js";
import { withBase } from "./ui.jsx";

// 핀+칩 주석 — 의도 입력과 수정 요청이 같은 문법을 쓴다.
// 자유 텍스트 입력 없음: part/chipKey/value(mm)만. mp4에는 핀을 찍지 않는다(이미지 전용).
export default function PinAnnotator({ src, annotations, onChange, readOnly = false }) {
  const { p, locale } = useLocale();
  const t = p.visual;
  const [active, setActive] = useState(null);
  const catalog = getDB().chipCatalog;
  const isVideo = src.endsWith(".mp4");

  function addPin(e) {
    if (readOnly || isVideo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const pinId = (annotations[annotations.length - 1]?.pinId || 0) + 1;
    onChange([...annotations, { pinId, x, y, part: "band", chipKey: "", value: null }]);
    setActive(pinId);
  }
  const update = (pinId, patch) => onChange(annotations.map((a) => (a.pinId === pinId ? { ...a, ...patch } : a)));
  const remove = (pinId) => { onChange(annotations.filter((a) => a.pinId !== pinId)); setActive(null); };

  return (
    <div className="form-stack">
      <div className={`pin-canvas ${readOnly || isVideo ? "" : "is-editable"}`} onClick={addPin}>
        {isVideo
          ? <video src={withBase(src)} muted loop autoPlay playsInline />
          : <img src={withBase(src)} alt="" />}
        {annotations.map((a) => (
          <button type="button" key={a.pinId} className={`pin-dot ${active === a.pinId ? "is-active" : ""}`}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            onClick={(e) => { e.stopPropagation(); if (!readOnly) setActive(a.pinId); }}>
            {a.pinId}
          </button>
        ))}
      </div>
      {!readOnly && !isVideo && <p className="form-hint">{t.pinHint}</p>}
      {annotations.map((a) => {
        const chip = catalog.find((c) => c.key === a.chipKey);
        if (readOnly || active !== a.pinId) {
          return <p key={a.pinId} className="form-hint">📍{a.pinId} · {formatAnnotation(a, catalog, locale, t.parts)}</p>;
        }
        return (
          <div key={a.pinId} className="pin-editor form-stack">
            <div className="row-actions">
              <strong>📍{a.pinId}</strong>
              <select value={a.part} onChange={(e) => update(a.pinId, { part: e.target.value, chipKey: "", value: null })}>
                {CHIP_PARTS.map((pt) => <option key={pt} value={pt}>{t.parts[pt]}</option>)}
              </select>
              <button type="button" className="chip" onClick={() => remove(a.pinId)}>✕ {t.removePin}</button>
            </div>
            <div className="row-actions" style={{ flexWrap: "wrap" }}>
              {listChips({ part: a.part }).map((c) => (
                <button type="button" key={c.key} className={`chip ${a.chipKey === c.key ? "is-active" : ""}`}
                  onClick={() => update(a.pinId, { chipKey: c.key, value: null })}>
                  {c.labels[locale] ?? c.labels.en}
                </button>
              ))}
            </div>
            {chip?.valueType === "mm" && (
              <label className="field"><span>{t.addValue}</span>
                <input type="number" step="0.1" value={a.value ?? ""}
                  onChange={(e) => update(a.pinId, { value: Number(e.target.value) || null })} /></label>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: CSS append** (`src/platform.css` 말미)

```css
/* ---------- 비주얼 커뮤니케이션 레이어 (핀 주석 / 체크포인트 / 비교) ---------- */
.pin-canvas { position: relative; border-radius: 10px; overflow: hidden; background: var(--bg-2); }
.pin-canvas img, .pin-canvas video { width: 100%; display: block; }
.pin-canvas.is-editable { cursor: crosshair; }
.pin-dot {
  position: absolute; transform: translate(-50%, -50%); width: 22px; height: 22px; border-radius: 50%;
  background: #b3402f; color: #fff; border: 2px solid #fff; font-size: 11px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
}
.pin-dot.is-active { background: var(--gold, #d6c5a0); color: #111; }
.pin-editor { border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.checkpoint.upcoming { opacity: 0.55; }
.checkpoint.done > .proposal-head h3 { color: var(--gold, #d6c5a0); }
.split-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 720px) { .split-compare { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: 빌드 확인** — Run: `npm run build` / Expected: 성공
- [ ] **Step 4: Commit** — `git commit -am "feat(visual): PinAnnotator 컴포넌트 (편집/읽기전용, % 좌표)"`

---

### Task 9: IntakeForm — 레퍼런스 + 핀 주석 섹션

**Files:**
- Modify: `src/pages/IntakeForm.jsx`

- [ ] **Step 1: 구현** — 변경 4곳:

(a) import 추가:
```jsx
import { MediaPicker } from "../components/ui.jsx";
import PinAnnotator from "../components/PinAnnotator.jsx";
```
(b) state 추가 (`const [done, setDone]` 아래):
```jsx
  const [refs, setRefs] = useState([]); // [{kind, src, annotations[]}]
  const [annotIdx, setAnnotIdx] = useState(0);
```
(c) `submit()`의 payload에 추가:
```jsx
      referenceMedia: refs,
```
(d) 약관 패널(`<div className="panel" style={{ background: "var(--bg-2)" }}>`) **앞**에 섹션 삽입:
```jsx
        {/* 레퍼런스 + 핀 주석 — 공방은 같은 핀을 중국어로 본다 */}
        <h3 style={{ margin: "10px 0 0" }}>{p.visual.refTitle}</h3>
        <p className="form-hint">{p.visual.refHint}</p>
        <MediaPicker value={refs} onChange={(v) => {
          setRefs(v.map((m) => refs.find((r) => r.src === m.src) || { ...m, annotations: [] }));
          setAnnotIdx(0);
        }} />
        {refs.length > 1 && (
          <div className="row-actions">
            {refs.map((m, i) => (
              <button type="button" key={m.src} className={`chip ${i === annotIdx ? "is-active" : ""}`} onClick={() => setAnnotIdx(i)}>#{i + 1}</button>
            ))}
          </div>
        )}
        {refs[annotIdx] && (
          <PinAnnotator src={refs[annotIdx].src} annotations={refs[annotIdx].annotations || []}
            onChange={(ann) => setRefs(refs.map((m, i) => (i === annotIdx ? { ...m, annotations: ann } : m)))} />
        )}
```

- [ ] **Step 2: 빌드 + 수동 확인** — Run: `npm run build && npm run dev` / `/custom/new`에서: 샘플 이미지 선택 → 핀 찍기 → 부위/칩 선택 → 제출 → 포털 진입 확인. 어드민 `/admin/ops/DM-0000XX`에서 레퍼런스가 pending으로 보이는지 확인(검수 UI는 Task 12).
- [ ] **Step 3: Commit** — `git commit -am "feat(visual): 인테이크 레퍼런스 업로드 + 핀 주석"`

---

### Task 10: ClientPortal — 타임라인 체크포인트 구조

**Files:**
- Modify: `src/pages/ClientPortal.jsx` (CadCard 교체 + 본문 재구성)

- [ ] **Step 1: import 교체/추가**

```jsx
import {
  acceptQuote, confirmFinal, decideCad, listCustomerActions, portalView, respondCustomerAction, selectCandidate,
} from "../lib/store.js";
import PinAnnotator from "../components/PinAnnotator.jsx";
```

- [ ] **Step 2: `CadCard`를 `DesignCard`로 교체** (기존 CadCard 함수 전체 삭제 후):

```jsx
// 체크포인트 ② 디자인 — 비교 뷰 + 핀 수정요청. 자유 텍스트 입력 없음.
function DesignCard({ cad, mineMedia, orderId, actor, revisionsLeft, feeUsd }) {
  const { p } = useLocale();
  const t = p.portal;
  const t2 = p.visual;
  const [revising, setRevising] = useState(false);
  const [ann, setAnn] = useState([]);
  const [measure, setMeasure] = useState("");

  function send(decision) {
    decideCad(cad.id, { decision, annotations: decision === "minorRevision" ? ann : [], confirmedMeasurements: measure }, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "cadReview");
    if (ca) respondCustomerAction(ca.id, decision, actor);
    setRevising(false); setAnn([]);
  }
  const annComplete = ann.length > 0 && ann.every((a) => a.chipKey);

  return (
    <>
      <div className="split-compare">
        <div>
          <p className="label">{t2.compareMine}</p>
          <MediaThumb media={mineMedia} ratio="4 / 3" alt={t2.compareMine} />
        </div>
        <div>
          <p className="label">{t2.compareVendor} — {t.cadVersion(cad.version)}</p>
          {revising
            ? <PinAnnotator src={cad.fileUrl} annotations={ann} onChange={setAnn} />
            : <MediaThumb media={{ kind: cad.fileUrl.endsWith(".mp4") ? "video" : "image", src: cad.fileUrl }} ratio="4 / 3" alt={t.cadTitle} />}
        </div>
      </div>
      {cad.media?.length > 1 && (
        <div className="card-grid cols-3" style={{ marginTop: 10 }}>
          {cad.media.map((m) => (
            <div key={m.slot}>
              <p className="label">{t2.slots[m.slot] || m.slot}</p>
              <MediaThumb media={m} alt={m.slot} />
            </div>
          ))}
        </div>
      )}
      {!cad.decision && (
        <div className="form-stack" style={{ marginTop: 14 }}>
          <label className="field"><span>{t.cadMeasure}</span>
            <input value={measure} onChange={(e) => setMeasure(e.target.value)} /></label>
          <p className="form-hint">{revisionsLeft > 0 ? t2.revisionsLeft(revisionsLeft) : t2.feeNote(feeUsd)}</p>
          <div className="row-actions">
            <button className="button primary small" onClick={() => send("approved")}>{t2.approveCta}</button>
            {!revising
              ? <button className="button secondary small" onClick={() => setRevising(true)}>{t2.reviseCta}</button>
              : <button className="button secondary small" disabled={!annComplete} onClick={() => send("minorRevision")}>{t2.sendRevision}</button>}
          </div>
        </div>
      )}
      {cad.decision === "minorRevision" && <p className="form-hint" style={{ marginTop: 10 }}>{t.cadDecided.minorRevision}</p>}
    </>
  );
}

// 타임라인 체크포인트 래퍼 — done은 접고, active만 펼친다
function Checkpoint({ index, title, state, summary, children }) {
  const { p } = useLocale();
  const t2 = p.visual;
  const badge = state === "done" ? t2.doneTag : state === "active" ? t2.nowAction : t2.upcoming;
  return (
    <div className={`panel checkpoint ${state}`}>
      <div className="proposal-head">
        <h3 style={{ margin: 0 }}>{state === "done" ? "✓" : index} · {title}</h3>
        <span className={`status-badge ${state === "active" ? "mst-waitingClient" : state === "done" ? "mst-done" : "mst-pending"}`}>{badge}</span>
      </div>
      {state === "done" && summary && <p className="form-hint">{summary}</p>}
      {state === "active" && children}
    </div>
  );
}
```

- [ ] **Step 3: 본문 재구성** — `export default function ClientPortal()`에서:

(a) 구조분해에 신규 필드 추가:
```jsx
  const { order, intake, style, candidates, selected, quote, milestones, cad, actions, freeRevisionsLeft, designChangeFeeUsd, finalAction } = view;
```
(b) 체크포인트 상태 계산 (`const anySelected = ...` 아래):
```jsx
  const stoneState = order.selectedDiamondId || anySelected ? "done"
    : order.status === "STONE_SELECTION" ? "active" : "upcoming";
  const designState = cad?.decision === "approved" ? "done" : cad && !cad.decision ? "active" : "upcoming";
  const finalState = finalAction ? "active"
    : ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status) ? "done" : "upcoming";
  const approvedRef = intake?.referenceMedia?.find((m) => m.status === "approved");
  const mineMedia = approvedRef
    ? { kind: approvedRef.kind, src: approvedRef.src }
    : style ? { kind: "image", src: style.coverImage } : null;
  const showStone = intake?.productLine === "solitaire";
```
(c) 기존 "다이아 후보" 패널을 Checkpoint로 감싸기 — `{candidates.length > 0 && (<div className="panel">…` 를 다음으로 교체 (내부 카드 그리드 JSX는 그대로 이동):
```jsx
      {showStone && (
        <Checkpoint index={1} title={p.visual.checkpoint.stone} state={stoneState}
          summary={selected && `${p.shapes[selected.shape] || selected.shape} ${selected.carat?.toFixed(2)}ct · ${selected.igiNo}`}>
          {candidates.length > 0 && (
            <>
              <p className="form-hint" style={{ marginBottom: 14 }}>{t.batchNote}</p>
              <div className="card-grid cols-3">
                {/* ←← 기존 candidates.map(...) 카드 그리드 그대로 */}
              </div>
            </>
          )}
        </Checkpoint>
      )}
```
(d) 기존 `{cad && <CadCard …/>}` 를 교체:
```jsx
      <Checkpoint index={2} title={p.visual.checkpoint.design} state={designState}
        summary={cad?.decision === "approved" ? `${t.cadVersion(cad.version)} ✓` : null}>
        {cad && <DesignCard cad={cad} mineMedia={mineMedia} orderId={orderId} actor={actor}
          revisionsLeft={freeRevisionsLeft} feeUsd={designChangeFeeUsd} />}
      </Checkpoint>
```
(e) 그 아래 최종 컨펌 체크포인트 추가:
```jsx
      <Checkpoint index={3} title={p.visual.checkpoint.final} state={finalState}
        summary={finalState === "done" ? p.visual.finalConfirmed : null}>
        {finalAction && (
          <div className="form-stack">
            <h3 style={{ margin: 0 }}>{p.visual.finalTitle}</h3>
            {finalAction.link && (
              <MediaThumb media={{ kind: finalAction.link.endsWith(".mp4") ? "video" : "image", src: finalAction.link }} ratio="16 / 9" alt={p.visual.finalTitle} />
            )}
            <p className="warn-note">{p.visual.finalNotice}</p>
            <button className="button primary" onClick={() => confirmFinal(orderId, actor)}>{p.visual.finalConfirm}</button>
          </div>
        )}
      </Checkpoint>
```
견적 패널·마일스톤 테이블은 기존 위치 유지 (견적은 체크포인트 1과 2 사이).

- [ ] **Step 4: 빌드 + 수동 확인** — `npm run build && npm run dev`:
  - `/track/DM-000001?code=QX7K-M9P2` — ① active(후보 2개), ②③ upcoming
  - 스톤 선택 → ① done 접힘
  - `/track/DM-000002?code=H3WT-8RVK` — ② active, 핀 수정요청 1회(무료) → 카운터 0, 두 번째부터 feeNote 표시
  - 언어 전환(KO↔EN)에서 모든 신규 라벨 렌더 확인
- [ ] **Step 5: Commit** — `git commit -am "feat(visual): 클라이언트 포털 타임라인 체크포인트 (스톤/디자인/최종)"`

---

### Task 11: SupplierTask — 비주얼 브리프 + CAD 슬롯 제출

**Files:**
- Modify: `src/pages/supplier/SupplierTask.jsx`

- [ ] **Step 1: import 추가/수정**

```jsx
import { BENCHMARK_SHAPES, CAD_SLOTS, supplierTaskView } from "../../lib/ops.js";
import { getIntake, getOpsOrder, getOpsStyle, getProcurement, listCadReviews, submitCadForPr, submitCandidates, submitQcForPr, submitWeightLabor } from "../../lib/store.js";
import PinAnnotator from "../../components/PinAnnotator.jsx";
```

- [ ] **Step 2: 뷰 생성부 교체** (`const view = supplierTaskView(...)` 라인):

```jsx
  const intake = order ? getIntake(order.intakeId) : null;
  const revisionReview = pr.type === "cad" && order
    ? listCadReviews(order.id).find((c) => c.decision === "minorRevision") || null
    : null;
  const view = supplierTaskView(pr, order, order?.styleId ? getOpsStyle(order.styleId) : null, intake, revisionReview);
```
state에 슬롯 추가 (`const [qc, setQc]` 아래):
```jsx
  const [slots, setSlots] = useState({ render360: [], side: [], wear: [] });
```

- [ ] **Step 3: 브리프 패널 아래 비주얼 브리프 삽입** (`</div>` 직후, 첫 번째 panel 다음):

```jsx
      {(view.references.length > 0 || view.revision) && (
        <div className="panel form-stack">
          <h3>{p.visual.refTitle}</h3>
          {view.references.map((r) => (
            <PinAnnotator key={r.id} src={r.src} annotations={r.annotations} readOnly />
          ))}
          {view.revision && (
            <>
              <h3>CAD V{view.revision.version} — {p.portal.cadDecided.minorRevision}</h3>
              <PinAnnotator src={view.revision.fileUrl} annotations={view.revision.annotations} readOnly />
            </>
          )}
        </div>
      )}
```

- [ ] **Step 4: CAD 폼을 슬롯형으로 교체** (`pr.type === "cad" ?` 분기 전체):

```jsx
      ) : pr.type === "cad" ? (
        <form className="panel form-stack" onSubmit={(e) => {
          e.preventDefault();
          const cadMedia = CAD_SLOTS.filter((s) => slots[s][0]).map((s) => ({ slot: s, ...slots[s][0] }));
          if (cadMedia.length > 0) { submitCadForPr(prId, cadMedia); navigate("/supplier"); }
        }}>
          <h3>{t.cadTitle}</h3>
          <p className="form-hint">{t.cadFile}</p>
          <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", alignItems: "start" }}>
            {CAD_SLOTS.map((s) => (
              <div key={s} className="form-stack">
                <p className="label">{p.visual.slots[s]}</p>
                <MediaPicker value={slots[s]} onChange={(v) => setSlots({ ...slots, [s]: v.slice(-1) })} />
              </div>
            ))}
          </div>
          <button className="button primary" type="submit" disabled={!slots.render360[0]}>{t.submit}</button>
        </form>
```
(MediaPicker import는 기존 라인에 이미 있음 — `EmptyNote, MediaPicker`)

- [ ] **Step 5: 빌드 + 수동 확인** — supplier@demo.com 로그인 → 언어 中文 전환 → 태스크에서 핀이 "戒臂 · 更细 → 1.6mm"처럼 보이는지, CAD 슬롯 3개 제출 동작 확인.
- [ ] **Step 6: Commit** — `git commit -am "feat(visual): 서플라이어 비주얼 브리프(읽기전용 핀) + CAD 슬롯 제출"`

---

### Task 12: 어드민 — 레퍼런스 검수 큐 + 칩 카탈로그 관리

**Files:**
- Modify: `src/pages/admin/AdminOpsOrder.jsx`
- Modify: `src/pages/admin/AdminSettings.jsx`

- [ ] **Step 1: AdminOpsOrder import 추가**

```jsx
import { reviewReferenceMedia } from "../../lib/store.js"; // 기존 store import 라인에 병합
import { formatAnnotation } from "../../lib/chips.js";
```

- [ ] **Step 2: 인테이크 패널 뒤에 레퍼런스 검수 큐 삽입** (상태/노트 panel의 닫는 `</div>` 직후):

```jsx
      {/* 레퍼런스 검수 — 승인분만 벤더 브리프로 나간다 */}
      {intake?.referenceMedia?.length > 0 && (
        <div className="panel form-stack">
          <h3>{p.visual.refReviewTitle}</h3>
          <div className="card-grid cols-3">
            {intake.referenceMedia.map((m) => (
              <div key={m.id} className="item-card">
                <MediaThumb media={m} alt={m.id} />
                <div className="card-body">
                  <p className="spec">{m.id} · {p.visual.refStatus[m.status]}</p>
                  {m.annotations?.map((a) => (
                    <p key={a.pinId} className="form-hint">📍{a.pinId} {formatAnnotation(a, getDB().chipCatalog, locale, p.visual.parts)}</p>
                  ))}
                  {m.status === "pending" && (
                    <div className="row-actions">
                      <button className="button primary small" onClick={() => reviewReferenceMedia(intake.id, m.id, "approved")}>{p.visual.approve}</button>
                      <button className="button secondary small" onClick={() => reviewReferenceMedia(intake.id, m.id, "rejected")}>{p.visual.reject}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 3: CAD 리뷰 이력에 주석/수수료 표시** — 기존 `{c.feedback.length > 0 && …}` 라인 아래 추가:

```jsx
              {c.annotations?.length > 0 && c.annotations.map((a) => (
                <span key={a.pinId}> · 📍{a.pinId} {formatAnnotation(a, getDB().chipCatalog, locale, p.visual.parts)}</span>
              ))}
              {c.feeAppliedUsd > 0 && <span> · fee {usd(c.feeAppliedUsd)}</span>}
```

- [ ] **Step 4: AdminSettings 칩 패널** — import에 `getDB, saveChip` 추가, 데모 리셋 패널 앞에 삽입:

```jsx
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.visual.chipTitle}</h3>
        {getDB().chipCatalog.map((c) => (
          <div className="row-actions" key={c.key}>
            <button className={`chip ${c.active !== false ? "is-active" : ""}`}
              onClick={() => saveChip({ key: c.key, active: c.active === false })}>
              {c.labels.ko} / {c.labels.zh}
            </button>
            <span className="form-hint">{c.key} · {(c.parts || ["all"]).join(",")} · {c.valueType}</span>
          </div>
        ))}
      </div>
```

- [ ] **Step 5: 빌드 + 수동 확인** — `/admin/ops/DM-000001`에서 REF-000002 승인/반려 토글, CAD 이력 주석 표시, `/admin/settings`에서 칩 비활성화 → 포털 칩 팔레트에서 사라지는지 확인.
- [ ] **Step 6: Commit** — `git commit -am "feat(visual): 어드민 레퍼런스 검수 큐 + 칩 카탈로그 관리"`

---

### Task 13: 최종 검증

- [ ] **Step 1: 전체 테스트** — Run: `npx vitest run` / Expected: 기존 5개 스위트 + chips + visualStore 전체 PASS
- [ ] **Step 2: 프로덕션 빌드** — Run: `npm run build` / Expected: 성공
- [ ] **Step 3: E2E 수동 시나리오** (dev 서버):
  1. 고객(ko): `/custom/new` 레퍼런스+핀 제출 → Order ID 발급
  2. 어드민: 레퍼런스 승인 → CAD PR 생성(supplier1)
  3. 벤더(zh): 브리프에서 핀을 중국어로 확인 → CAD 슬롯 제출
  4. 고객: 비교 뷰에서 핀 수정요청(무료 1회) → 벤더 V2 제출 → 승인
  5. 벤더: QC 제출 → 고객: 최종 컨펌 → 주문 BALANCE 확인
- [ ] **Step 4: 스펙 대비 누락 점검** — 스펙 §2~§5의 각 항목이 구현됐는지 체크 (chipCatalog/PinAnnotator/MediaCheckpoint(=Checkpoint)/CompareView(=split-compare)/슬롯/가드레일 5종)
- [ ] **Step 5: 커밋 잔여분 정리** — `git status`로 미커밋 변경 없는지 확인
