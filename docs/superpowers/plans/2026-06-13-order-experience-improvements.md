# 주문 경험 개선 3종 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인테이크 3단계 위저드(②), 벤더 폴백 후보를 풀에서 선택(③), 고객 다중선택 스톤 흐름(④)을 추가해 주문 경험을 직관화한다. 디파짓 결제는 범위 외(수동 유지).

**Architecture:** 세 기능은 독립적. ③은 후보 스냅샷 헬퍼 추출 + 벤더 태스크 UI, ②는 IntakeForm 단계 분할(스토어 무변경), ④는 스톤 선택 시맨틱 재설계(찜→일괄확인→락)로 store의 selectCandidate/submitStockConfirm/lockCandidate 흐름을 바꾸고 ClientPortal UI를 재구성한다. 격리 워크트리 `worktree-pool-shells-verify`에서 진행.

**Tech Stack:** React 19, react-router-dom v7, vitest(node — 로직/스토어 테스트, 페이지는 빌드+브라우저 검증), localStorage mock store, `useLocale()`.

**스펙:** `docs/superpowers/specs/2026-06-13-order-experience-improvements-design.md`

**구현 순서:** Phase A (③) → Phase B (②) → Phase C (④). 각 Phase 종료 시 전체 테스트 그린 + 커밋.

> 워크트리 격리 상태라 main(병행 세션)과 분리됨. 그래도 커밋은 해당 Phase 파일만 stage하고 `git diff --cached --stat`로 확인.

---

## Phase A — ③ 벤더 폴백 후보를 풀에서 선택

### Task A1: `poolStoneToCandidate` 추출 + `submitPoolCandidates` (store)

**Files:** Modify `src/lib/store.js`; Test `src/lib/__tests__/pool.test.js`

- [ ] **Step 1: 실패 테스트 추가**

`src/lib/__tests__/pool.test.js` import에 `submitPoolCandidates, getProcurement, createProcurement` 추가(이미 있는 것은 제외), 파일 끝에:

```js
describe("submitPoolCandidates — 풀에서 폴백 후보 제출", () => {
  it("선택한 풀 스톤이 후보로 생성(poolDiamondId·자동가·published) + pr submitted", () => {
    // 풀에 없는 셰이프로 인테이크 → diamondCandidates 폴백 PR 발행
    const { order } = createIntake({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "", metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: { shape: "heart", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" }, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] });
    const pr = listProcurements({ orderId: order.id }).find((p) => p.type === "diamondCandidates");
    expect(pr).toBeTruthy();
    // 벤더(pr.supplierId=u-supplier1) 풀의 round 스톤들을 후보로 제출
    const poolIds = ["POOL-000001", "POOL-000002"];
    const created = submitPoolCandidates(pr.id, poolIds);
    expect(created.length).toBe(2);
    expect(created.every((c) => c.poolDiamondId && c.prId === pr.id && c.supplierId === pr.supplierId)).toBe(true);
    expect(created.some((c) => c.published && c.customerPriceUsd > 0)).toBe(true);
    expect(getProcurement(pr.id).status).toBe("submitted");
    // 후보가 주문에 실제로 들어갔는지
    expect(listCandidates({ orderId: order.id }).filter((c) => c.poolDiamondId).length).toBe(2);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/__tests__/pool.test.js` → FAIL (`submitPoolCandidates is not a function`)

- [ ] **Step 3: 구현** — `src/lib/store.js`

`autoMatchFromPool` 바로 위에 공유 헬퍼 추가:

```js
// 풀 스톤 → 주문 후보 스냅샷 (autoMatchFromPool·submitPoolCandidates 공용)
function poolStoneToCandidate(pool, orderId, seq, prId = null) {
  const image = (pool.media || []).find((m) => m.kind === "image")?.src || "";
  const video = (pool.media || []).find((m) => m.kind === "video")?.src || "";
  const c = {
    id: `DIA-${orderId}-${String(seq).padStart(2, "0")}`,
    orderId, prId, poolDiamondId: pool.id,
    igiNo: pool.igiNo, shape: pool.shape, carat: pool.carat, color: pool.color, clarity: pool.clarity,
    growth: pool.growth, lab: pool.lab, proportions: pool.proportions || {}, reportUrl: pool.reportUrl || "",
    image, video, colorTreatment: pool.colorTreatment || "disclosed", availability: "available",
    procurementCostUsd: pool.procurementCostUsd, supplierId: pool.supplierId,
    internalReview: null, internalNotes: "", published: false, customerPriceUsd: null,
    clientSelection: "none", stockConfirmed: false, locked: false, createdAt: now(),
  };
  const bench = benchmarkFor(c.shape, c.carat);
  if (isCandidateComplete(c) && bench) {
    c.customerPriceUsd = candidateAutoPrice(bench.unitUsdPerCt, c.carat, db().settings.opsMultiplier);
    c.published = true;
    audit("auto", "diamond", c.id, "published", "false", "true");
  }
  return c;
}
```

`autoMatchFromPool` 본문을 헬퍼 사용으로 교체:

```js
function autoMatchFromPool(order, intake) {
  const matches = matchPoolForOrder(intake.stonePrefs);
  const existing = listCandidates({ orderId: order.id }).length;
  const created = matches.map((pool, i) => poolStoneToCandidate(pool, order.id, existing + i + 1, null));
  db().diamondCands.push(...created);
  return created;
}
```

풀 CRUD 섹션 끝(`setPoolAvailability` 뒤)에 추가:

```js
// 벤더가 폴백 diamondCandidates 태스크에서 자기 풀 스톤을 골라 후보로 제출
export function submitPoolCandidates(prId, poolIds) {
  const pr = getProcurement(prId);
  const existing = listCandidates({ orderId: pr.orderId }).length;
  const created = (poolIds || [])
    .map((id) => getPoolDiamond(id))
    .filter(Boolean)
    .map((pool, i) => poolStoneToCandidate(pool, pr.orderId, existing + i + 1, prId));
  db().diamondCands.push(...created);
  pr.status = "submitted";
  audit(pr.supplierId, "procurement", prId, "candidates", null, String(created.length));
  persist();
  return created;
}
```

> 주의: `submitCandidates`(수기)에도 후보에 `stockConfirmed: false`를 추가해야 ④와 필드 일관(아래 Phase C Task C1 Step 3에서 처리 — 여기선 poolStoneToCandidate에만 추가됨). Phase A 단독 그린에는 영향 없음.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/__tests__/pool.test.js` → PASS. 이어서 `npx vitest run` 전체 그린(autoMatchFromPool 회귀 없음).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/store.js src/lib/__tests__/pool.test.js
git diff --cached --stat
git commit -m "feat(order): 풀 스톤→후보 헬퍼 추출 + submitPoolCandidates(폴백 풀 선택)"
```

### Task A2: SupplierTask "내 풀에서 선택" UI + i18n

**Files:** Modify `src/pages/supplier/SupplierTask.jsx`, `src/opsStrings.js`

- [ ] **Step 1: i18n 추가** — `src/opsStrings.js` 각 로케일 `supplierP`의 `candTitle` 줄 뒤에 추가:
  - en: `fromPool: "Pick from my pool", poolSubmit: "Submit selected", poolEmpty: "No available stones in your pool.",`
  - ko: `fromPool: "내 풀에서 선택", poolSubmit: "선택 항목 제출", poolEmpty: "풀에 사용 가능한 스톤이 없습니다.",`
  - zh: `fromPool: "从我的钻石池选择", poolSubmit: "提交所选", poolEmpty: "钻石池中暂无可用钻石。",`
  - es: `fromPool: "Elegir de mi pool", poolSubmit: "Enviar selección", poolEmpty: "No hay piedras disponibles en tu pool.",`

- [ ] **Step 2: SupplierTask import + 풀 선택 UI**

`src/pages/supplier/SupplierTask.jsx` import에 `listPoolDiamonds, submitPoolCandidates, usd` 추가(store에서 listPoolDiamonds/submitPoolCandidates, ui에서 usd):

```jsx
import { listPoolDiamonds, submitPoolCandidates } from "../../lib/store.js"; // 기존 store import에 합류
import { MediaThumb, EmptyNote, usd } from "../../components/ui.jsx"; // usd 추가
```

컴포넌트 본문 상단(다른 useState 근처)에 추가:

```jsx
  const [poolPick, setPoolPick] = useState(() => new Set());
  const togglePool = (id) => setPoolPick((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
```

`diamondCandidates` 분기에서 `<h3>{t.candTitle}</h3>` 바로 다음(수기 폼 위)에 풀 선택 블록 삽입:

```jsx
          {(() => {
            const poolStones = listPoolDiamonds({ supplierId: user.id }).filter((s) => s.availability === "available");
            return (
              <div className="panel" style={{ background: "var(--bg-2)", marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 10px" }}>{t.fromPool}</h4>
                {poolStones.length === 0 ? <p className="form-hint">{t.poolEmpty}</p> : (
                  <>
                    <table className="data-table">
                      <tbody>
                        {poolStones.map((s) => (
                          <tr key={s.id}>
                            <td><input type="checkbox" checked={poolPick.has(s.id)} onChange={() => togglePool(s.id)} /></td>
                            <td>{p.shapes[s.shape]} {Number(s.carat).toFixed(2)}ct</td>
                            <td>{s.color} · {s.clarity} · {s.growth}</td>
                            <td>{s.certOrg} {s.igiNo}</td>
                            <td>{usd(s.procurementCostUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" className="button primary small" style={{ marginTop: 12 }} disabled={poolPick.size === 0}
                      onClick={() => { submitPoolCandidates(prId, [...poolPick]); navigate("/supplier"); }}>
                      {t.poolSubmit} ({poolPick.size})
                    </button>
                  </>
                )}
              </div>
            );
          })()}
```

(기존 수기 입력 폼은 그 아래 그대로 유지.)

- [ ] **Step 3: 빌드** — `npm run build` → 성공.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/supplier/SupplierTask.jsx src/opsStrings.js
git diff --cached --stat
git commit -m "feat(order): 벤더 폴백 태스크에 '내 풀에서 선택' 추가"
```

---

## Phase B — ② 인테이크 단계형 위저드

### Task B1: IntakeForm 3단계 분할 + 검증 + i18n

**Files:** Modify `src/pages/IntakeForm.jsx`, `src/opsStrings.js`

- [ ] **Step 1: i18n 추가** — `src/opsStrings.js` 각 로케일 `intake`의 `title` 줄 뒤에 추가:
  - en: `wizardSteps: ["Product", "Center stone", "References"], next: "Next", back: "Back",`
  - ko: `wizardSteps: ["제품", "센터스톤", "레퍼런스"], next: "다음", back: "뒤로",`
  - zh: `wizardSteps: ["产品", "主石", "参考图"], next: "下一步", back: "上一步",`
  - es: `wizardSteps: ["Producto", "Piedra central", "Referencias"], next: "Siguiente", back: "Atrás",`

- [ ] **Step 2: IntakeForm 위저드화**

`src/pages/IntakeForm.jsx`에서:

1) `const [done, setDone] = useState(null);` 근처에 `const [step, setStep] = useState(0);` 추가.

2) 단계 검증 헬퍼 추가(컴포넌트 내부, return 위):

```jsx
  function validateStep(s) {
    if (s === 0) {
      if (!form.country.trim()) return false;
      if (cat === "ring" && !(form.conditional.ringSize || "").trim()) return false;
      if (cat === "necklace" && !(form.conditional.chainStyle || "").trim()) return false;
      if (cat === "bangle" && !(form.conditional.wristSize || "").trim()) return false;
      if (cat === "earrings" && !(form.conditional.earringDetails || "").trim()) return false;
      return true;
    }
    return true; // step1(센터스톤)은 기본값 있음, step2는 제출에서 검증
  }
  const [stepError, setStepError] = useState(false);
  function goNext() { if (validateStep(step)) { setStepError(false); setStep((s) => s + 1); } else setStepError(true); }
```

3) 폼 구조를 단계별로 감싼다. 기존 `<form className="panel form-stack" onSubmit={submit}>` 내부를:
- 상단에 stepper 추가:
```jsx
        <ol className="stepper">
          {t.wizardSteps.map((label, i) => (
            <li key={label} className={i === step ? "current" : i < step ? "done" : ""}><span className="dot" />{label}</li>
          ))}
        </ol>
```
- **Step 0 블록** (`{step === 0 && (<>...</>)}`): 기존 상단 filter-grid에서 **name·contact를 제외한** 제품 필드(productLine·category·style·metal·budget·requiredDate·country) + 카테고리 조건부 필드(ring/necklace/bangle/earrings) 묶음.
- **Step 1 블록** (`{step === 1 && (<>...</>)}`): 솔리테어 센터스톤 8필드 + `bigStone` 경고 + `.stone-edu-inline`(인라인 교육패널). 멀티면 multiSpec 블록.
- **Step 2 블록** (`{step === 2 && (<>...</>)}`): 레퍼런스(MediaPicker+PinAnnotator) + **name·contact** + termsBlocks + terms 체크 + 제출 버튼 + ftc.
- 네비게이션 푸터(제출 버튼을 step2에만):
```jsx
        <div className="wizard-nav">
          {step > 0 ? <button type="button" className="button secondary" onClick={() => setStep((s) => s - 1)}>{t.back}</button> : <span />}
          {step < 2
            ? <button type="button" className="button primary" onClick={goNext}>{t.next}</button>
            : <button className="button primary" type="submit" disabled={!form.termsAccepted}>{t.submit}</button>}
        </div>
        {stepError && <p className="form-error">{p.common?.required || "필수 항목을 입력하세요."}</p>}
```

4) `submit(e)`는 그대로(제출 시 최종 검증은 HTML required + termsAccepted). 사이드 교육패널(`.stone-edu-aside`)은 step===1일 때만 의미 있으므로, `intake-layout has-edu`는 `solitaire && step === 1`일 때만 적용:
```jsx
    <div className="page page-narrow" style={{ maxWidth: solitaire && step === 1 ? 1020 : 680 }}>
    ...
      <div className={`intake-layout ${solitaire && step === 1 ? "has-edu" : ""}`}>
      ...
      {solitaire && step === 1 && (<aside className="stone-edu-aside"><StoneEduPanel field={eduField} prefs={form.stonePrefs} /></aside>)}
```

> 구현 시 기존 JSX 섹션을 단계 블록으로 옮기는 작업. name/contact input을 step0 grid에서 빼서 step2로 이동하는 것에 유의(현재 filter-grid 첫 두 필드).

- [ ] **Step 3: 빌드** — `npm run build` → 성공.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/IntakeForm.jsx src/opsStrings.js
git diff --cached --stat
git commit -m "feat(order): 인테이크 3단계 위저드(제품→센터스톤→레퍼런스)"
```

---

## Phase C — ④ 고객 다중선택 스톤 흐름

### Task C1: store 선택 시맨틱 재설계 + stockConfirmed 필드

**Files:** Modify `src/lib/store.js`, `src/lib/ops.js`; Test `src/lib/__tests__/pool.test.js`

- [ ] **Step 1: 실패 테스트 추가** — `src/lib/__tests__/pool.test.js` import에 `toggleShortlist, requestStockConfirm, submitStockConfirm, lockSelectedCandidate, getProcurement` 추가, 끝에:

```js
describe("④ 다중선택 — 찜→일괄확인→하나 락", () => {
  const prefs = { shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "" };
  const mk = () => createIntake({ name: "T", contact: "t@t.com", productLine: "solitaire", category: "ring", styleId: "RING-001", metal: "18kw", conditional: { ringSize: "6" }, stonePrefs: prefs, requiredDate: "", country: "USA", termsAccepted: true, referenceMedia: [] }).order;

  it("여러 후보 찜(토글) → 재고확인 요청 → 찜 수만큼 stockConfirm PR", () => {
    const order = mk();
    const cands = listCandidates({ orderId: order.id });
    expect(cands.length).toBeGreaterThanOrEqual(3);
    toggleShortlist(cands[0].id, "customer");
    toggleShortlist(cands[1].id, "customer");
    expect(getCandidate(cands[0].id).clientSelection).toBe("selected");
    toggleShortlist(cands[1].id, "customer"); // 토글 해제
    expect(getCandidate(cands[1].id).clientSelection).toBe("none");
    toggleShortlist(cands[1].id, "customer"); // 다시 찜
    requestStockConfirm(order.id, "customer");
    const scs = listProcurements({ orderId: order.id }).filter((p) => p.type === "stockConfirm" && p.status === "open");
    expect(scs.length).toBe(2);
  });

  it("재고확인 '있음'은 락 안 함(stockConfirmed만), '품절'은 drop", () => {
    const order = mk();
    const cands = listCandidates({ orderId: order.id });
    toggleShortlist(cands[0].id, "customer");
    toggleShortlist(cands[1].id, "customer");
    requestStockConfirm(order.id, "customer");
    const prFor = (diaId) => listProcurements({ orderId: order.id }).find((p) => p.type === "stockConfirm" && p.diamondId === diaId);
    submitStockConfirm(prFor(cands[0].id).id, true);
    submitStockConfirm(prFor(cands[1].id).id, false);
    expect(getCandidate(cands[0].id).stockConfirmed).toBe(true);
    expect(getCandidate(cands[0].id).locked).toBeFalsy();
    expect(getOpsOrder(order.id).selectedDiamondId).toBeNull();
    expect(getCandidate(cands[1].id).availability).toBe("sold");
    expect(getCandidate(cands[1].id).clientSelection).toBe("none");
  });

  it("확인된 후보만 락 가능, 락 시 형제 찜 초기화 + 풀 sold", () => {
    const order = mk();
    const cands = listCandidates({ orderId: order.id });
    toggleShortlist(cands[0].id, "customer");
    toggleShortlist(cands[1].id, "customer");
    requestStockConfirm(order.id, "customer");
    const prFor = (diaId) => listProcurements({ orderId: order.id }).find((p) => p.type === "stockConfirm" && p.diamondId === diaId);
    expect(() => lockSelectedCandidate(cands[0].id, "customer")).toThrow(); // 아직 미확인
    submitStockConfirm(prFor(cands[0].id).id, true);
    submitStockConfirm(prFor(cands[1].id).id, true);
    lockSelectedCandidate(cands[0].id, "customer");
    expect(getCandidate(cands[0].id).locked).toBe(true);
    expect(getOpsOrder(order.id).status).toBe("QUOTATION");
    expect(getCandidate(cands[1].id).clientSelection).toBe("none"); // 형제 초기화
    expect(getPoolDiamond(cands[0].poolDiamondId).availability).toBe("sold");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/__tests__/pool.test.js` → FAIL (함수 없음)

- [ ] **Step 3: ops.js — 공개 필드에 stockConfirmed 추가**

`src/lib/ops.js` `DIAMOND_PUBLIC_FIELDS` 배열에 `"stockConfirmed"` 추가:

```js
const DIAMOND_PUBLIC_FIELDS = [
  "id", "orderId", "igiNo", "shape", "carat", "color", "clarity", "growth", "lab",
  "proportions", "reportUrl", "image", "video", "colorTreatment", "availability",
  "customerPriceUsd", "clientSelection", "stockConfirmed", "published",
];
```

- [ ] **Step 4: store.js — 후보 생성에 stockConfirmed, 선택 함수 재설계**

`submitCandidates`의 생성 객체에 `stockConfirmed: false,` 추가(`clientSelection: "none",` 옆). (poolStoneToCandidate엔 Phase A에서 이미 추가됨.)

`selectCandidate` 함수 전체를 삭제하고 아래 4개로 교체:

```js
// ④ 다중선택: 찜 토글 (PR/락 없음)
export function toggleShortlist(diaId, actor) {
  const c = getCandidate(diaId);
  const order = getOpsOrder(c.orderId);
  if (order.selectedDiamondId) return c; // 이미 락된 주문
  if (c.clientSelection === "selected") {
    c.clientSelection = "none";
    audit(actor, "diamond", diaId, "clientSelection", "selected", "none");
  } else {
    const pr = c.prId ? getProcurement(c.prId) : null;
    const expired = pr?.batchValidUntil && pr.batchValidUntil < today();
    if (!c.published || c.availability !== "available" || expired) throw new Error("notSelectable");
    c.clientSelection = "selected";
    audit(actor, "diamond", diaId, "clientSelection", "none", "selected");
  }
  persist();
  return c;
}

// 찜한 후보들의 벤더에게 재고확인 일괄 발행 (이미 열린 건 건너뜀)
export function requestStockConfirm(orderId, actor) {
  const open = new Set(listProcurements({ orderId }).filter((p) => p.type === "stockConfirm" && p.status === "open").map((p) => p.diamondId));
  listCandidates({ orderId }).filter((c) => c.clientSelection === "selected" && !c.stockConfirmed && !open.has(c.id))
    .forEach((c) => createProcurement(orderId, { type: "stockConfirm", supplierId: c.supplierId, dueDate: plusDays(2), brief: c.igiNo, diamondId: c.id }, actor || "customer"));
  persist();
}

// 확인된 찜 후보 중 하나를 최종 락
export function lockSelectedCandidate(diaId, actor) {
  const c = getCandidate(diaId);
  if (!(c.clientSelection === "selected" && c.stockConfirmed && c.availability === "available")) throw new Error("notLockable");
  audit(actor, "diamond", diaId, "lock", null, "selected");
  lockCandidate(diaId);
  listCandidates({ orderId: c.orderId }).forEach((o) => {
    if (o.id !== diaId && o.clientSelection === "selected") o.clientSelection = "none";
  });
  persist();
  return c;
}
```

`submitStockConfirm` 본문 교체(자동 락 제거):

```js
export function submitStockConfirm(prId, available) {
  const pr = getProcurement(prId);
  const c = getCandidate(pr.diamondId);
  pr.status = "submitted";
  pr.result = { available };
  audit(pr.supplierId, "procurement", prId, "result", null, available ? "inStock" : "soldOut");
  if (available) {
    c.stockConfirmed = true; // 락은 고객이 최종 선택 시 (lockSelectedCandidate)
  } else {
    setCandidateAvailability(c.id, "sold");
    c.clientSelection = "none";
    c.stockConfirmed = false;
    audit(pr.supplierId, "diamond", c.id, "clientSelection", "selected", "none");
  }
  persist();
  return pr;
}
```

- [ ] **Step 5: 통과 확인** — `npx vitest run src/lib/__tests__/pool.test.js` → PASS (새 ④ 테스트). 전체는 아직 실패(다른 테스트가 selectCandidate 사용) — Task C2에서 해결.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/store.js src/lib/ops.js src/lib/__tests__/pool.test.js
git diff --cached --stat
git commit -m "feat(order): 스톤 선택 시맨틱 재설계 — 찜·일괄확인·확정 락 + stockConfirmed"
```

### Task C2: 기존 테스트 마이그레이션 (selectCandidate → 신규 흐름)

**Files:** Modify `src/lib/__tests__/opsStore.test.js`, `visualStore.test.js`, `autoFlow.test.js`

각 파일에서 `selectCandidate` import를 제거하고 `toggleShortlist, requestStockConfirm, lockSelectedCandidate`로 교체, 사용처를 신규 흐름으로 갱신.

- [ ] **Step 1: opsStore.test.js**

import 라인의 `selectCandidate` → `toggleShortlist, requestStockConfirm`. 그리고:

"재선택 시 이전 미완료 재고확인은 닫혀 중복 누적 안 됨" 테스트는 단일선택-스위칭 시맨틱이 사라졌으므로 **다중선택 시맨틱으로 교체**:

```js
  it("찜 → 재고확인 요청 → 같은 후보 재요청 시 중복 PR 안 생김", () => {
    const pr = createProcurement("DM-000001", { type: "diamondCandidates", supplierId: "u-supplier1", dueDate: "d", brief: "" });
    const [a, b] = submitCandidates(pr.id, [
      { igiNo: "X1", shape: "round", carat: 1.5, color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 500, image: "/a.png" },
      { igiNo: "X2", shape: "round", carat: 1.5, color: "D", clarity: "VS1", growth: "CVD", lab: "IGI", procurementCostUsd: 520, image: "/b.png" },
    ]);
    publishCandidate(a.id, 1100); publishCandidate(b.id, 1200);
    toggleShortlist(a.id, "customer");
    requestStockConfirm("DM-000001", "customer");
    requestStockConfirm("DM-000001", "customer"); // 재요청
    const open = listProcurements({ orderId: "DM-000001" }).filter((p) => p.type === "stockConfirm" && p.status === "open");
    expect(open.length).toBe(1);
  });
```

"후보 제출 → 검수 → publish → 고객 선택 → 락 → QUOTATION" 테스트: `selectCandidate(cand.id, "customer"); lockCandidate(cand.id);` 를 신규 흐름으로:

```js
    toggleShortlist(cand.id, "customer");
    requestStockConfirm("DM-000001", "customer");
    const sc = listProcurements({ orderId: "DM-000001" }).find((p) => p.type === "stockConfirm" && p.diamondId === cand.id);
    submitStockConfirm(sc.id, true);
    lockSelectedCandidate(cand.id, "customer");
```
(import에 `submitStockConfirm, lockSelectedCandidate`도 추가.)

"견적 스냅샷 + 수락 + 디파짓 → CAD" 테스트의 `selectCandidate(cand.id,"customer"); lockCandidate(cand.id);`도 동일 신규 흐름으로 교체.

- [ ] **Step 2: visualStore.test.js**

import의 `selectCandidate` → `toggleShortlist, requestStockConfirm, lockSelectedCandidate`.

"신선 배치 → 재고확인 없이 자동 락" 테스트는 **자동 락 최적화가 제거**됐으므로 신규 흐름으로 교체(제목도 변경):

```js
  it("찜 → 재고확인 '있음' → 확정 락 + QUOTATION", () => {
    const c = freshCand();
    toggleShortlist(c.id, "customer");
    requestStockConfirm("DM-000001", "customer");
    const pr = listProcurements({ orderId: "DM-000001" }).find((p) => p.type === "stockConfirm" && p.diamondId === c.id);
    submitStockConfirm(pr.id, true);
    expect(getCandidate(c.id).stockConfirmed).toBe(true);
    expect(getCandidate(c.id).locked).toBeFalsy();
    lockSelectedCandidate(c.id, "customer");
    expect(getCandidate(c.id).locked).toBe(true);
    expect(getOpsOrder("DM-000001").status).toBe("QUOTATION");
  });
```

"만료 임박 배치 → 벤더 재고확인 요청" 테스트: `selectCandidate(c.id)` → `toggleShortlist(c.id,"customer"); requestStockConfirm("DM-000001","customer");`. 나머지 단언(PR diamondId·익명성) 유지.

"만료 임박 → 재고확인 '있음' → 락" 테스트: `selectCandidate` → `toggleShortlist+requestStockConfirm`, 그리고 `submitStockConfirm(pr.id, true)` 다음에 `lockSelectedCandidate(c.id, "customer")` 추가(있음만으론 더 이상 자동 락 안 됨).

"만료 임박 → '품절'" 테스트: `selectCandidate` → `toggleShortlist+requestStockConfirm`, `submitStockConfirm(pr.id, false)` 후 단언(sold·비공개·clientSelection none) 유지.

- [ ] **Step 3: autoFlow.test.js**

import의 `selectCandidate` → `toggleShortlist, requestStockConfirm, lockSelectedCandidate`.

L81·L93 "무효 후보 선택 차단": `selectCandidate(x, "customer")` → `toggleShortlist(x, "customer")` (둘 다 미공개/품절 후보라 `notSelectable` throw 유지).

"풀 체인" 테스트의 선택 구간:
```js
    selectCandidate(cand.id, "customer");
    expect(listProcurements({ orderId: order.id }).some((p) => p.type === "stockConfirm")).toBe(false);
    expect(getCandidate(cand.id).locked).toBe(true);
```
→ 신규 흐름으로 교체:
```js
    toggleShortlist(cand.id, "customer");
    requestStockConfirm(order.id, "customer");
    const sc = listProcurements({ orderId: order.id }).find((p) => p.type === "stockConfirm" && p.diamondId === cand.id);
    submitStockConfirm(sc.id, true);
    lockSelectedCandidate(cand.id, "customer");
    expect(getCandidate(cand.id).locked).toBe(true);
```
(import에 `submitStockConfirm` 이미 있음.)

- [ ] **Step 4: 전체 그린 확인** — `npx vitest run` → 전부 PASS. 실패 시 해당 단언을 신규 시맨틱에 맞게 최소 수정.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/__tests__/opsStore.test.js src/lib/__tests__/visualStore.test.js src/lib/__tests__/autoFlow.test.js
git diff --cached --stat
git commit -m "test(order): 스톤 선택 테스트를 다중선택 흐름으로 마이그레이션"
```

### Task C3: ClientPortal 다중선택 UI + i18n

**Files:** Modify `src/pages/ClientPortal.jsx`, `src/opsStrings.js`

- [ ] **Step 1: i18n** — `src/opsStrings.js` 각 로케일 `portal`의 `select`/`selected` 근처에 추가:
  - en: `shortlist: "Shortlist", shortlisted: "Shortlisted", requestStock: "Request stock check", checking: "Checking…", inStock: "In stock", soldOut: "Sold out", lockThis: "Choose this one",`
  - ko: `shortlist: "찜하기", shortlisted: "찜됨", requestStock: "재고 확인 요청", checking: "확인 중…", inStock: "재고 있음", soldOut: "품절", lockThis: "이걸로 확정",`
  - zh: `shortlist: "加入候选", shortlisted: "已加入", requestStock: "请求库存确认", checking: "确认中…", inStock: "有货", soldOut: "已售罄", lockThis: "选定这颗",`
  - es: `shortlist: "Preseleccionar", shortlisted: "Preseleccionado", requestStock: "Solicitar verificación", checking: "Verificando…", inStock: "Disponible", soldOut: "Agotada", lockThis: "Elegir esta",`

- [ ] **Step 2: ClientPortal import + 핸들러 교체**

import 라인(L5)의 `selectCandidate` → `toggleShortlist, requestStockConfirm, lockSelectedCandidate`.

`pick` 함수(L128) 교체 + 신규 핸들러:

```jsx
  function shortlist(diaId) { toggleShortlist(diaId, actor); }
  function reqStock() { requestStockConfirm(orderId, actor); }
  function lockOne(diaId) { lockSelectedCandidate(diaId, actor); }
```

- [ ] **Step 3: 체크포인트 ① 스톤 카드 UI 재구성**

후보 카드의 선택 버튼 영역(현재 `c.clientSelection === "selected" ... ? {t.selected} : ... pick`)을 다중선택 흐름으로 교체. 후보 그리드 아래 "재고 확인 요청" 버튼 추가. 후보 카드 내부 액션:

```jsx
{order.status === "STONE_SELECTION" && !order.selectedDiamondId && (
  c.availability === "sold" ? <p className="form-hint">{t.soldOut}</p>
  : c.stockConfirmed ? (
      <div className="row-actions" style={{ marginTop: 8 }}>
        <span className="status-badge mst-done">{t.inStock}</span>
        <button className="button primary small" onClick={() => lockOne(c.id)}>{t.lockThis}</button>
      </div>
    )
  : c.clientSelection === "selected" ? (
      <button className="button secondary small" style={{ marginTop: 8 }} onClick={() => shortlist(c.id)}>{t.shortlisted} ✓</button>
    )
  : <button className="button secondary small" style={{ marginTop: 8 }} onClick={() => shortlist(c.id)}>{t.shortlist}</button>
)}
```

스톤 체크포인트의 후보 그리드 바로 다음(닫는 태그 앞)에 일괄 요청 버튼:

```jsx
{order.status === "STONE_SELECTION" && !order.selectedDiamondId &&
  candidates.some((c) => c.clientSelection === "selected" && !c.stockConfirmed) && (
    <button className="button primary" style={{ marginTop: 12 }} onClick={reqStock}>{t.requestStock}</button>
)}
```

"확인 중" 표시: 찜됐고 아직 stockConfirmed 아니며 해당 후보의 stockConfirm PR이 열려 있으면 — 포털 뷰엔 PR 정보가 없으므로, `clientSelection==="selected" && !stockConfirmed` 상태에서 버튼 라벨을 `{t.shortlisted}`로 두고, 요청 후에는 동일 카드가 "있음"으로 바뀌면 충분(확인 중 별도 뱃지는 생략 — YAGNI). 

> 기존 `anySelected`(단일선택 가정) 분기와 `pick` 참조가 남아 있으면 모두 제거/치환.

- [ ] **Step 4: 빌드 + 전체 테스트** — `npm run build` 성공, `npx vitest run` 그린.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/ClientPortal.jsx src/opsStrings.js
git diff --cached --stat
git commit -m "feat(order): 고객 포털 다중선택 — 찜·재고확인 요청·확정 락 UI"
```

### Task C4: 브라우저 검증 (전체 흐름)

**Files:** 없음

- [ ] **Step 1: dev 서버** — 워크트리에서 `npx vite --port 5181 --strictPort` (백그라운드).

- [ ] **Step 2: ② 위저드** — `/custom/new`: 3단계 stepper, Step1 필수(국가·링사이즈) 누락 시 다음 차단, Step2 센터스톤+교육패널, Step3 이름·연락처·약관·제출 → Order ID 발급.

- [ ] **Step 3: ④ 다중선택 (고객)** — 스타일 선택 인테이크 제출 → `/track`: 후보 여러 개 "찜하기" → "재고 확인 요청" → (벤더 확인 후) "재고 있음" 뜬 후보에서 "이걸로 확정" → QUOTATION 전환.

- [ ] **Step 4: ④ 재고확인 (벤더)** — supplier 세션 `/supplier`: 생성된 stockConfirm 태스크들을 열어 있음/품절 응답. 고객 화면에 반영 확인.

- [ ] **Step 5: ③ 폴백 풀선택 (벤더)** — 풀에 없는 셰이프(heart) 인테이크 → 벤더 `diamondCandidates` 태스크에 "내 풀에서 선택" 표시 → 선택 제출 → 고객 후보로 노출.

- [ ] **Step 6: 콘솔 에러 0 확인 + 스크린샷 공유. dev 서버 종료.**

---

## Self-Review 결과

- **스펙 커버리지**: ②(Phase B), ③(Phase A), ④(Phase C) 전부 매핑. stockConfirmed 필드·DIAMOND_PUBLIC_FIELDS·poolStoneToCandidate 추출·테스트 마이그레이션 모두 태스크 존재.
- **플레이스홀더**: 없음. (UI 옮김 작업은 기존 JSX 이동이라 "이동" 지시 + 구조 명시.)
- **타입 일관성**: 신규 함수 `toggleShortlist`/`requestStockConfirm`/`lockSelectedCandidate`/`submitPoolCandidates`/`poolStoneToCandidate`·필드 `stockConfirmed`가 store·ops·ClientPortal·테스트 전반에서 일관. `selectCandidate` 제거 후 잔존 참조 없음(opsStore·visualStore·autoFlow·ClientPortal 전부 교체).
- **위험**: Phase C가 핵심 흐름 시맨틱 변경 — Task C2 테스트 마이그레이션이 크리티컬. 각 Phase 종료 시 전체 그린 게이트.
