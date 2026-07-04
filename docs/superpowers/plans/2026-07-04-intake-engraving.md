# 인테이크 각인(Engraving) 문구 지원 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인테이크 위저드 review 스텝(Size & Fit)에서 각인 문구를 선택 입력으로 받아, 페이로드→어드민 라이브 주문 상세→고객 포털 브리프까지 흘려보낸다.

**Architecture:** `form.engraving` 한 필드를 `baseForm`에 추가하면 드래프트·`buildIntakePayload`(`...form` spread)·서버 `formPayload`(jsonb)·로컬 스토어까지 기존 spread 경로로 자동 전파된다. 서버 코드/스키마 무변경. UI는 review의 Size & Fit 그리드에 입력 1개, 표시면은 어드민·포털에 각 1행.

**Tech Stack:** React (Vite), vitest, opsStrings.js 4개 언어 스트링.

**Spec:** `docs/superpowers/specs/2026-07-04-intake-engraving-design.md`

## Global Constraints

- 스트링은 항상 4개 언어(en/ko/zh/es) 동시 추가 — `opsStrings.js`의 `intake.gflow` 아래. 한 언어라도 누락 금지.
- 입력 제한은 `maxLength={30}`과 trim뿐 — 문자종 하드 밸리데이션 없음 (RFQ 흐름, 제안 단계에서 오퍼레이터가 조율).
- 서버(`server/`, `api/`) 코드·스키마 무변경.
- `engravingLbl`은 "(선택)" 접미사 없는 평문 — 어드민·포털 행 라벨로 재사용되기 때문. 선택 표시는 `engravingHints`가 담당.
- 커밋 메시지는 저장소 관례(한국어 요약, `feat:`/`test:` 프리픽스) + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 푸터.
- 테스트 실행은 클라이언트 스위트: `npx vitest run <파일>` (전체는 `npm test`).

---

### Task 1: buildIntakePayload — engraving trim 정규화 (TDD)

**Files:**
- Modify: `src/lib/intakePayload.js:62-78` (`buildIntakePayload`)
- Test: `src/lib/__tests__/intakePayload.test.js`

**Interfaces:**
- Consumes: 기존 `buildIntakePayload(form, refs, user)` — form은 `ringForm()` 헬퍼 참고.
- Produces: `payload.engraving: string` — 항상 존재(trim됨, 미입력이면 `""`). Task 3의 IntakeForm과 Task 4의 표시면이 이 키에 의존.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/intakePayload.test.js`의 `describe("buildIntakePayload — createIntake 호환", ...)` 블록 안, 마지막 `it` 다음에 추가:

```js
  it("각인 문구는 trim되어 실리고, 미입력이면 빈 문자열로 정규화된다", () => {
    const withEngraving = buildIntakePayload(
      ringForm({ name: "G", contact: "g@x.com", engraving: "  J ♥ M 2026.07.04  " }),
      [],
      null,
    );
    expect(withEngraving.engraving).toBe("J ♥ M 2026.07.04");
    // 구버전 드래프트 등 engraving 키가 아예 없는 폼도 안전
    const without = buildIntakePayload(ringForm({ name: "G", contact: "g@x.com" }), [], null);
    expect(without.engraving).toBe("");
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/__tests__/intakePayload.test.js`
Expected: FAIL — `expected '  J ♥ M 2026.07.04  ' to be 'J ♥ M 2026.07.04'` (spread가 원문을 그대로 통과시킴)

- [ ] **Step 3: 최소 구현**

`src/lib/intakePayload.js`의 `buildIntakePayload` return 객체에 정규화 1줄 추가 (`...contactDetails` 다음):

```js
  return {
    ...form,
    ...contactDetails,
    engraving: (form.engraving || "").trim(),
    stonePrefs: solitaire ? { ...form.stonePrefs, carat: Number(form.stonePrefs?.carat) || null } : null,
    multiSpec,
    referenceMedia: sanitizeReferenceMedia(refs),
  };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/intakePayload.test.js`
Expected: PASS (기존 케이스 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/intakePayload.js src/lib/__tests__/intakePayload.test.js
git commit -m "test+feat: 인테이크 페이로드에 각인 문구(trim) 정규화

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: i18n — opsStrings.js gflow에 4개 언어 각인 키

**Files:**
- Modify: `src/opsStrings.js` — 4개 로케일의 `intake.gflow` 블록 (en ~81행, ko ~471행, zh ~861행, es ~1251행의 `sizeFit:` 줄 바로 다음)

**Interfaces:**
- Produces: `opsStrings[loc].intake.gflow.engravingLbl: string`, `.engravingPh: string`, `.engravingHints: { ring, necklace, earrings, bangle }` — Task 3(위저드 `g.*`)과 Task 4(포털 `intakeText.gflow.*`)가 사용.

- [ ] **Step 1: 4개 로케일에 키 추가**

각 로케일의 `gflow` 블록에서 `sizeFit:` 줄 바로 다음에 삽입. **en** (`sizeFit: "Size & fit",` 다음):

```js
      engravingLbl: "Engraving",
      engravingPh: "e.g. J ♥ M 2026.07.04",
      engravingHints: {
        ring: "Optional — engraved inside the band · up to 30 characters",
        bangle: "Optional — engraved inside the band · up to 30 characters",
        necklace: "Optional — engraved on the back of the pendant · up to 30 characters",
        earrings: "Optional — feasibility depends on the design; we confirm it at the proposal stage",
      },
```

**ko** (`sizeFit: "사이즈 & 핏",` 다음):

```js
      engravingLbl: "각인 문구",
      engravingPh: "예: J ♥ M 2026.07.04",
      engravingHints: {
        ring: "선택 사항 — 밴드 안쪽에 새겨드려요 · 최대 30자",
        bangle: "선택 사항 — 밴드 안쪽에 새겨드려요 · 최대 30자",
        necklace: "선택 사항 — 펜던트 뒷면에 새겨드려요 · 최대 30자",
        earrings: "선택 사항 — 디자인에 따라 가능 여부가 달라요, 제안 단계에서 확정해 드려요",
      },
```

**zh** (`sizeFit: "尺寸与佩戴",` 다음):

```js
      engravingLbl: "刻字",
      engravingPh: "例：J ♥ M 2026.07.04",
      engravingHints: {
        ring: "可选 — 刻在戒臂内侧 · 最多 30 个字符",
        bangle: "可选 — 刻在手镯内侧 · 最多 30 个字符",
        necklace: "可选 — 刻在吊坠背面 · 最多 30 个字符",
        earrings: "可选 — 取决于具体设计，可行性将在方案阶段确认",
      },
```

**es** (`sizeFit: "Talla y ajuste",` 다음):

```js
      engravingLbl: "Grabado",
      engravingPh: "p. ej. J ♥ M 2026.07.04",
      engravingHints: {
        ring: "Opcional — grabado en el interior de la banda · hasta 30 caracteres",
        bangle: "Opcional — grabado en el interior de la banda · hasta 30 caracteres",
        necklace: "Opcional — grabado en el reverso del colgante · hasta 30 caracteres",
        earrings: "Opcional — depende del diseño; lo confirmamos en la etapa de propuesta",
      },
```

용어 근거: 기존 `platformStrings.js`가 ko "각인", zh "刻字", es "Grabado"를 이미 쓴다 — 동일 용어 유지.

- [ ] **Step 2: 4개 로케일 키 존재 검증**

Run:
```bash
node --input-type=module -e "
import { opsStrings } from './src/opsStrings.js';
for (const loc of ['en','ko','zh','es']) {
  const g = opsStrings[loc].intake.gflow;
  for (const k of ['ring','necklace','earrings','bangle']) {
    if (!g.engravingLbl || !g.engravingPh || !g.engravingHints?.[k]) throw new Error(loc + ':' + k);
  }
}
console.log('OK: 4 locales × engraving keys');
"
```
Expected: `OK: 4 locales × engraving keys` (`opsStrings`는 named export — opsStrings.js:1564 확인됨)

- [ ] **Step 3: 커밋**

```bash
git add src/opsStrings.js
git commit -m "feat: 각인 문구 4개 언어 스트링 (gflow engravingLbl/Ph/Hints)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: IntakeForm — baseForm 필드 + review Size & Fit 입력

**Files:**
- Modify: `src/pages/IntakeForm.jsx` — `baseForm`(~138행) + review의 `#gflow-size-fit` 그리드(~630행 `requiredDate` 필드 다음)

**Interfaces:**
- Consumes: Task 2의 `g.engravingLbl` / `g.engravingPh` / `g.engravingHints[cat]` (`g = t.gflow`), 기존 `setF` 헬퍼, `cat = form.category`.
- Produces: `form.engraving` — Task 1의 `buildIntakePayload`가 trim해서 페이로드에 싣는다.

- [ ] **Step 1: baseForm에 engraving 추가**

`src/pages/IntakeForm.jsx`의 `baseForm`에서 `inspirationNotes: "",` 줄 다음에:

```js
    inspirationNotes: "",
    engraving: "",
    requiredDate: "", termsAccepted: false,
```

드래프트 복원은 `{ ...baseForm, ...draft.form }` 스프레드라 자동이다 — 구버전 드래프트(키 없음)는 `""`로 시작한다.

- [ ] **Step 2: review Size & Fit 그리드에 입력 추가**

`#gflow-size-fit` 섹션의 `filter-grid review-contact-grid` 안, `requiredDate`의 `</label>` 닫힌 직후(그리드의 마지막 필드로)에 추가:

```jsx
              <label className="field"><span>{g.engravingLbl}</span>
                <input
                  value={form.engraving}
                  maxLength={30}
                  placeholder={g.engravingPh}
                  onChange={(e) => setF({ engraving: e.target.value })}
                />
                <small className="form-hint" style={{ margin: 0 }}>{g.engravingHints[cat]}</small>
              </label>
```

주의: 힌트는 `<span>`이 아닌 `<small>` — `.review-contact-grid .field > span`이 라벨 텍스트 스타일을 직계 span에 입히기 때문(platform.css:2954).

- [ ] **Step 3: 렌더 확인 (빌드 + 기존 테스트)**

Run: `npm run build && npx vitest run src/lib/__tests__/intakePayload.test.js`
Expected: 빌드 성공, 테스트 PASS. (브라우저 확인은 Task 5에서 일괄.)

- [ ] **Step 4: 커밋**

```bash
git add src/pages/IntakeForm.jsx
git commit -m "feat: 위저드 review Size & Fit에 각인 문구 입력 (전 카테고리, 카테고리별 힌트)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 표시면 — 어드민 라이브 주문 상세 + 고객 포털 브리프

**Files:**
- Modify: `src/pages/admin/AdminLiveOrders.jsx:534-547` (`intakeRows` useMemo)
- Modify: `src/pages/ClientPortal.jsx:259-282` (`buildOrderBriefRows`)

**Interfaces:**
- Consumes: 서버 주문의 `order.intake.formPayload.engraving` (Task 1이 페이로드에 실음), 로컬 스토어 `intake.engraving`, Task 2의 `intakeText.gflow.engravingLbl`.

- [ ] **Step 1: 어드민 intakeRows에 행 추가**

`AdminLiveOrders.jsx`의 `intakeRows` 배열에서 `["Fit", ...]` 행 다음에 추가 (기존 행들이 "Stone"/"Fit" 영문 리터럴이므로 동일하게):

```js
      ["Engraving", (fp.engraving || "").trim()],
```

값이 비면 기존 `.filter(([, v]) => v && v !== "—")`가 걸러낸다 — 조건문 불필요.

- [ ] **Step 2: 포털 buildOrderBriefRows에 행 추가**

`ClientPortal.jsx`의 `buildOrderBriefRows` rows 배열에서 카테고리 조건부 행들 다음, `{ label: copy.stone, ... }` 직전에 추가:

```js
    { label: intakeText.gflow?.engravingLbl || "Engraving", value: (intake?.engraving || "").trim() },
```

값이 비면 기존 `rows.filter((row) => row.value)`가 걸러낸다.

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공, 경고/에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/pages/admin/AdminLiveOrders.jsx src/pages/ClientPortal.jsx
git commit -m "feat: 각인 문구 표시 — 어드민 라이브 주문 상세 · 고객 포털 브리프

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 엔드투엔드 검증 (브라우저)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 + 빌드**

Run: `npm test && npm run build`
Expected: 전부 PASS, 빌드 성공

- [ ] **Step 2: 위저드 완주 — 각인 입력 → 제출**

`npm run dev` 실행 후 브라우저(Playwright MCP 가능)로:
1. `/custom/new` 진입 → 카테고리 Ring → 아무 디자인 → 메탈 → 셰입 → 캐럿 → 인스피레이션 SKIP → 연락처(게스트: 이름 `Test`, 이메일 `test@example.com`)
2. review에서 Ring Size `6` 선택, **각인 문구에 `J ♥ M 2026.07.04` 입력** — 필드 라벨 "각인 문구"(ko) / "Engraving"(en), 힌트에 "밴드 안쪽 · 최대 30자" 노출 확인
3. 카테고리별 힌트 스팟체크: 뒤로 가서 카테고리를 Necklace로 바꾸면 힌트가 "펜던트 뒷면"으로 바뀌는지 (입력값은 유지되어야 함 — form 최상위 필드라 카테고리 전환에 리셋되지 않음)
4. 약관 동의 → 제출 성공

- [ ] **Step 3: 포털에서 재확인**

접수 완료 화면의 포털 버튼 클릭 → 주문 브리프에 "각인 문구 · J ♥ M 2026.07.04" 행 노출 확인. 각인 없이 한 번 더 제출하면 해당 행이 아예 없는지 확인.

- [ ] **Step 4: 어드민 행 (로컬 서버 있을 때만)**

로컬에서 `npm run api`+`.env.beloved` 구성이 살아 있으면: 어드민 콘솔 라이브 주문 상세에서 "Engraving" 행 확인. 서버 미가동이면 스킵 — 서버는 formPayload(jsonb)를 통짜 저장하므로 Task 1의 페이로드 테스트가 경로를 커버한다.

- [ ] **Step 5: 콘솔 에러 0 확인 후 종료**

브라우저 콘솔에 에러 없음 확인. 끝.
