# 인테이크 총 캐럿 + 그레이드 Range 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 멀티스톤 디자인에 총 캐럿 선택 스텝을 신설하고, 컬러/클래리티를 브릴리언스식 듀얼 핸들 range 슬라이더로 솔리테어·멀티 모두에 적용하며, 멀티 견적이 총 캐럿 × 멜리 단가에 반응하게 한다.

**Architecture:** 순수 로직(`gradeScale.js`)을 신설해 스케일·클램프·라벨을 한 곳에 두고, `pickers.jsx`에 두 슬라이더 컴포넌트를 추가한 뒤 `IntakeForm.jsx`의 스텝 목록/리뷰 화면을 바꾼다. 페이로드(`intakePayload.js`)·견적(`quoteEstimate.js`)·요약(`ops.js`)이 range를 소비하고, 멜리 단가는 settings 키로 시드/마이그레이션/서버 공개 키에 추가한다.

**Tech Stack:** React 18 + Vite, Vitest, 로컬 스토어(localStorage) + Express/Postgres 서버(설정 write-through).

**Spec:** `docs/superpowers/specs/2026-07-07-intake-total-carat-grade-range-design.md`

## Global Constraints

- 컬러 스케일: `["H","G","F","E","D"]` (왼쪽=낮음), 클래리티: `["SI1","VS2","VS1","VVS2","VVS1","IF-FL"]`.
- range 저장 형식은 `[하한, 상한]` 배열. 표시 라벨은 상급 먼저 (`["F","D"]` → `"D–F"`, en dash).
- 기본값 — 솔리테어 `["F","D"]`/`["VS1","IF-FL"]`, 멀티 `["G","E"]`/`["VS2","VVS1"]`.
- 총 캐럿: ring 0.5–5/0.25/기본1.5, bangle 1–15/0.5/기본5, necklace 2–25/0.5/기본10, earrings 0.5–6/0.25/기본2.
- 멜리 단가 기본 $150/ct (`settings.meleeUsdPerCt`).
- 고객 노출 문구는 EN/KO/ZH/ES 4개 언어 전부 (`src/opsStrings.js`의 `intake.gflow`).
- 기저장 인테이크(단일값 `color:"E"`)는 마이그레이션 없이 표시 계층 호환으로 처리.
- 테스트 러너: `npx vitest run <파일>` (프로젝트 루트에서).

---

### Task 1: gradeScale.js — 스케일 상수 + 순수 헬퍼 (TDD)

**Files:**
- Create: `src/lib/gradeScale.js`
- Test: `src/lib/__tests__/gradeScale.test.js`

**Interfaces:**
- Produces: `COLOR_SCALE`, `CLARITY_SCALE`, `TOTAL_CARAT_RANGES`, `SOLITAIRE_COLOR_DEFAULT`, `SOLITAIRE_CLARITY_DEFAULT`, `MULTI_COLOR_DEFAULT`, `MULTI_CLARITY_DEFAULT`, `clampGradeRange(scale, range, fallback) → [lo,hi]`, `formatGradeRange(range) → string`, `clampTotalCarat(category, value) → number`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/__tests__/gradeScale.test.js`

```js
import { describe, expect, it } from "vitest";
import {
  CLARITY_SCALE, COLOR_SCALE, MULTI_COLOR_DEFAULT, TOTAL_CARAT_RANGES,
  clampGradeRange, clampTotalCarat, formatGradeRange,
} from "../gradeScale.js";

describe("clampGradeRange", () => {
  it("단일 레거시 값 → [v,v]", () => {
    expect(clampGradeRange(COLOR_SCALE, "E", MULTI_COLOR_DEFAULT)).toEqual(["E", "E"]);
  });
  it("역전 입력은 정렬된다", () => {
    expect(clampGradeRange(COLOR_SCALE, ["D", "F"], MULTI_COLOR_DEFAULT)).toEqual(["F", "D"]);
  });
  it("IF/FL 단일값은 IF-FL 눈금으로 병합", () => {
    expect(clampGradeRange(CLARITY_SCALE, "IF", ["VS2", "VVS1"])).toEqual(["IF-FL", "IF-FL"]);
  });
  it("스케일 밖 값만 있으면 폴백", () => {
    expect(clampGradeRange(COLOR_SCALE, ["Z", "Q"], MULTI_COLOR_DEFAULT)).toEqual(MULTI_COLOR_DEFAULT);
  });
  it("null/undefined → 폴백 복사본", () => {
    const out = clampGradeRange(COLOR_SCALE, null, MULTI_COLOR_DEFAULT);
    expect(out).toEqual(MULTI_COLOR_DEFAULT);
    expect(out).not.toBe(MULTI_COLOR_DEFAULT);
  });
  it("한쪽만 유효하면 그 값으로 채운다", () => {
    expect(clampGradeRange(COLOR_SCALE, ["E", "Q"], MULTI_COLOR_DEFAULT)).toEqual(["E", "E"]);
  });
});

describe("formatGradeRange", () => {
  it("상급 먼저 표기 (D–F)", () => expect(formatGradeRange(["F", "D"])).toBe("D–F"));
  it("단일 등급은 한 글자", () => expect(formatGradeRange(["E", "E"])).toBe("E"));
  it("빈 입력은 빈 문자열", () => expect(formatGradeRange(null)).toBe(""));
});

describe("clampTotalCarat", () => {
  it("범위 밖 → 카테고리 기본값", () => {
    expect(clampTotalCarat("ring", 99)).toBe(TOTAL_CARAT_RANGES.ring.default);
    expect(clampTotalCarat("ring", null)).toBe(TOTAL_CARAT_RANGES.ring.default);
  });
  it("정상 문자열 값 통과(숫자화)", () => expect(clampTotalCarat("bangle", "5")).toBe(5));
  it("모르는 카테고리는 ring 기준", () => {
    expect(clampTotalCarat("watch", 2)).toBe(2);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/gradeScale.test.js` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `src/lib/gradeScale.js`

```js
// 다이아 그레이드 스케일 + 총 캐럿 범위 — 인테이크 range 슬라이더의 순수 로직 (React 의존 없음).
// 스케일은 "낮음 → 높음" 순서(슬라이더 왼쪽=낮음), 저장 형식은 [하한, 상한] 그레이드 문자열.
export const COLOR_SCALE = ["H", "G", "F", "E", "D"];
export const CLARITY_SCALE = ["SI1", "VS2", "VS1", "VVS2", "VVS1", "IF-FL"];

export const SOLITAIRE_COLOR_DEFAULT = ["F", "D"];
export const SOLITAIRE_CLARITY_DEFAULT = ["VS1", "IF-FL"];
export const MULTI_COLOR_DEFAULT = ["G", "E"];
export const MULTI_CLARITY_DEFAULT = ["VS2", "VVS1"];

// 카테고리별 총 캐럿 슬라이더 범위 — 멀티스톤(테니스류 포함) 전용
export const TOTAL_CARAT_RANGES = {
  ring: { min: 0.5, max: 5, step: 0.25, default: 1.5 },
  bangle: { min: 1, max: 15, step: 0.5, default: 5 },
  necklace: { min: 2, max: 25, step: 0.5, default: 10 },
  earrings: { min: 0.5, max: 6, step: 0.25, default: 2 },
};

// IF/FL 단일 등급은 스케일에서 한 눈금(IF-FL)으로 묶는다
function normalizeGrade(scale, value) {
  const s = String(value || "").toUpperCase();
  if ((s === "IF" || s === "FL") && scale.includes("IF-FL")) return "IF-FL";
  return scale.includes(s) ? s : "";
}

// 단일값(레거시)·역전·스케일 밖 입력을 [하한, 상한]으로 정규화. 양끝 다 무효면 폴백.
export function clampGradeRange(scale, range, fallback) {
  const arr = Array.isArray(range) ? range : (range ? [range, range] : []);
  let lo = scale.indexOf(normalizeGrade(scale, arr[0]));
  let hi = scale.indexOf(normalizeGrade(scale, arr[1]));
  if (lo < 0 && hi < 0) return [...fallback];
  if (lo < 0) lo = hi;
  if (hi < 0) hi = lo;
  if (lo > hi) [lo, hi] = [hi, lo];
  return [scale[lo], scale[hi]];
}

// 표시 라벨 — 업계 관행대로 상급 먼저 (["F","D"] → "D–F")
export function formatGradeRange(range) {
  if (!Array.isArray(range) || !range[0]) return "";
  return range[0] === range[1] ? range[0] : `${range[1]}–${range[0]}`;
}

// 총 캐럿을 카테고리 범위로 — 범위 밖(구 드래프트·카테고리 변경)은 기본값으로 리셋
export function clampTotalCarat(category, value) {
  const r = TOTAL_CARAT_RANGES[category] || TOTAL_CARAT_RANGES.ring;
  const n = Number(value);
  return Number.isFinite(n) && n >= r.min && n <= r.max ? n : r.default;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/gradeScale.test.js` / Expected: PASS
- [ ] **Step 5: Commit** — `git add src/lib/gradeScale.js src/lib/__tests__/gradeScale.test.js && git commit -m "feat: 그레이드 스케일·총캐럿 순수 로직 (gradeScale.js)"`

---

### Task 2: intakePayload — 멀티 totalCarat/range, 솔리테어 range 직렬화 (TDD)

**Files:**
- Modify: `src/lib/intakePayload.js:61-81` (buildIntakePayload)
- Test: `src/lib/__tests__/intakePayload.test.js`

**Interfaces:**
- Consumes: Task 1의 `clampGradeRange`, `clampTotalCarat`, `formatGradeRange`, 스케일/기본값 상수
- Produces: 멀티 payload `multiSpec = { totalCarat: number, colorRange, clarityRange, meleeSpec, overallDims, arrangement, standard }` (standard는 `"E–G / VVS1–VS2"` 파생 라벨), 솔리테어 payload `stonePrefs = { ...form.stonePrefs, carat: number|null, colorRange, clarityRange }`

- [ ] **Step 1: 기존 멀티 테스트 갱신 + 신규 테스트** — `src/lib/__tests__/intakePayload.test.js`의 `"멀티: stonePrefs null, multiSpec 기본 등급 채움 (자유입력 없이 제출 가능)"` 테스트를 아래로 교체하고, 솔리테어 range 테스트를 추가:

```js
  it("멀티: stonePrefs null, totalCarat 숫자화 + 등급 range 클램프 + standard 파생", () => {
    const payload = buildIntakePayload(
      ringForm({
        productLine: "multi", category: "necklace", styleId: "NECK-001",
        conditional: { chainStyle: "cable", chainLength: "18in", clasp: "lobster" },
        multiSpec: { totalCarat: "10", colorRange: ["G", "E"], clarityRange: ["VS2", "VVS1"], meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
        name: "Jiwon", contact: "j@x.com",
      }),
      [], null,
    );
    expect(payload.stonePrefs).toBeNull();
    expect(payload.multiSpec.totalCarat).toBe(10);
    expect(payload.multiSpec.standard).toBe("E–G / VVS1–VS2");
  });

  it("멀티: range 누락(구 드래프트)이면 기본 range·기본 캐럿으로 채운다", () => {
    const payload = buildIntakePayload(
      ringForm({
        productLine: "multi", category: "bangle", styleId: "BAN-001",
        conditional: { wristSize: "6.5in" },
        multiSpec: { meleeSpec: "", overallDims: "", arrangement: "", standard: "" },
        name: "Jiwon", contact: "j@x.com",
      }),
      [], null,
    );
    expect(payload.multiSpec.totalCarat).toBe(5); // bangle 기본
    expect(payload.multiSpec.colorRange).toEqual(["G", "E"]);
    expect(payload.multiSpec.standard).toBe("E–G / VVS1–VS2");
  });

  it("솔리테어: 단일 color/clarity(레거시 폼)를 range로 승격한다", () => {
    const payload = buildIntakePayload(ringForm({ name: "J", contact: "j@x.com" }), [], null);
    expect(payload.stonePrefs.colorRange).toEqual(["E", "E"]);
    expect(payload.stonePrefs.clarityRange).toEqual(["VS1", "VS1"]);
  });
```

또한 파일 상단 `ringForm`의 `stonePrefs`는 그대로 두되(레거시 승격 경로 검증), 다른 기존 테스트가 `DEFAULT_MULTI_STANDARD`를 기대하면 파생 라벨 기대값으로 수정한다.

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/intakePayload.test.js` / Expected: 신규 3건 FAIL
- [ ] **Step 3: 구현** — `src/lib/intakePayload.js`의 import에 추가:

```js
import {
  CLARITY_SCALE, COLOR_SCALE, MULTI_CLARITY_DEFAULT, MULTI_COLOR_DEFAULT,
  SOLITAIRE_CLARITY_DEFAULT, SOLITAIRE_COLOR_DEFAULT,
  clampGradeRange, clampTotalCarat, formatGradeRange,
} from "./gradeScale.js";
```

`buildIntakePayload`를 다음으로 교체:

```js
// createIntake에 넘길 최종 페이로드 — solitaire는 stonePrefs, multi는 multiSpec만 채운다.
// 등급은 [하한,상한] range로 정규화하고, multi.standard는 range에서 파생한 라벨이다.
export function buildIntakePayload(form, refs, user) {
  const contactDetails = submissionContact(form, user);
  const solitaire = form.productLine === "solitaire";
  const multiColor = clampGradeRange(COLOR_SCALE, form.multiSpec?.colorRange, MULTI_COLOR_DEFAULT);
  const multiClarity = clampGradeRange(CLARITY_SCALE, form.multiSpec?.clarityRange, MULTI_CLARITY_DEFAULT);
  const multiSpec = solitaire ? null : {
    totalCarat: clampTotalCarat(form.category, form.multiSpec?.totalCarat),
    colorRange: multiColor,
    clarityRange: multiClarity,
    meleeSpec: form.multiSpec?.meleeSpec || "",
    overallDims: form.multiSpec?.overallDims || "",
    arrangement: form.multiSpec?.arrangement || "",
    standard: `${formatGradeRange(multiColor)} / ${formatGradeRange(multiClarity)}`,
  };
  return {
    ...form,
    ...contactDetails,
    engraving: (form.engraving || "").trim(),
    couponCode: normalizeCouponCode(form.couponCode),
    stonePrefs: solitaire ? {
      ...form.stonePrefs,
      carat: Number(form.stonePrefs?.carat) || null,
      // 구 드래프트의 단일값(color/clarity)은 [v,v] range로 승격
      colorRange: clampGradeRange(COLOR_SCALE, form.stonePrefs?.colorRange ?? form.stonePrefs?.color, SOLITAIRE_COLOR_DEFAULT),
      clarityRange: clampGradeRange(CLARITY_SCALE, form.stonePrefs?.clarityRange ?? form.stonePrefs?.clarity, SOLITAIRE_CLARITY_DEFAULT),
    } : null,
    multiSpec,
    referenceMedia: sanitizeReferenceMedia(refs),
  };
}
```

`DEFAULT_MULTI_STANDARD` export는 유지한다(레거시 인테이크 표시 폴백).

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/intakePayload.test.js` / Expected: PASS (기존 테스트 포함)
- [ ] **Step 5: 관련 스위트 회귀** — Run: `npx vitest run src/lib/__tests__/` / Expected: PASS (autoFlow/coupons 등 multiSpec 사용처 깨짐 없음 — 깨지면 해당 기대값을 파생 라벨로 갱신)
- [ ] **Step 6: Commit** — `git add -A src/lib && git commit -m "feat: 인테이크 페이로드 — 멀티 totalCarat·등급 range, standard 파생 라벨"`

---

### Task 3: 견적 — 멜리 단가 신설 + range 반영 (TDD)

**Files:**
- Modify: `src/lib/quoteEstimate.js:8-53`
- Modify: `src/lib/seed.js:258-262` (settings에 `meleeUsdPerCt: 150,` 추가)
- Modify: `src/lib/store.js:160-224` (migrateDB에 키 주입)
- Modify: `server/settingsRepository.js:6-17` (`PUBLIC_SETTINGS_KEYS`에 `"meleeUsdPerCt"`)
- Test: `src/lib/__tests__/quoteEstimate.test.js` (신규)

**Interfaces:**
- Consumes: Task 1의 `clampTotalCarat`
- Produces: `estimateQuoteRange(form)` — 멀티: `carat = totalCarat`, `benchmarkUsdPerCt = settings.meleeUsdPerCt ?? 150`; 솔리테어: 컬러/클래리티 factor를 range 양끝 평균으로

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/__tests__/quoteEstimate.test.js`

```js
import { beforeEach, describe, expect, it } from "vitest";
import { estimateQuoteRange } from "../quoteEstimate.js";
import { resetDB, updateSettings } from "../store.js";

beforeEach(() => resetDB());

const multiForm = (patch = {}) => ({
  productLine: "multi", category: "bangle", styleId: "", metal: "18kw", couponCode: "",
  multiSpec: { totalCarat: 5, colorRange: ["G", "E"], clarityRange: ["VS2", "VVS1"] },
  ...patch,
});

describe("estimateQuoteRange — 멀티 총캐럿", () => {
  it("총 캐럿이 커지면 견적도 커진다", () => {
    const small = estimateQuoteRange(multiForm());
    const large = estimateQuoteRange(multiForm({ multiSpec: { totalCarat: 15, colorRange: ["G", "E"], clarityRange: ["VS2", "VVS1"] } }));
    expect(large.beloved.low).toBeGreaterThan(small.beloved.low);
  });
  it("멜리 단가 설정이 반영된다", () => {
    const base = estimateQuoteRange(multiForm());
    updateSettings({ meleeUsdPerCt: 300 });
    const bumped = estimateQuoteRange(multiForm());
    expect(bumped.beloved.low).toBeGreaterThan(base.beloved.low);
  });
  it("범위 밖 totalCarat은 카테고리 기본값으로 견적한다", () => {
    const junk = estimateQuoteRange(multiForm({ multiSpec: { totalCarat: 999 } }));
    const def = estimateQuoteRange(multiForm({ multiSpec: { totalCarat: 5 } }));
    expect(junk.beloved.low).toBe(def.beloved.low);
  });
});

describe("estimateQuoteRange — 솔리테어 range factor", () => {
  const soli = (colorRange) => ({
    productLine: "solitaire", category: "ring", styleId: "", metal: "18kw", couponCode: "",
    stonePrefs: { shape: "round", carat: "1.5", colorRange, clarityRange: ["VS1", "VS1"] },
  });
  it("상급 range가 하급 range보다 비싸다", () => {
    expect(estimateQuoteRange(soli(["E", "D"])).beloved.low)
      .toBeGreaterThan(estimateQuoteRange(soli(["H", "G"])).beloved.low);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/quoteEstimate.test.js` / Expected: FAIL
- [ ] **Step 3: 구현** — `src/lib/quoteEstimate.js`:

import 추가: `import { clampTotalCarat } from "./gradeScale.js";`

`CLARITY_FACTOR`에 IF-FL 키 추가:

```js
const CLARITY_FACTOR = { "IF-FL": 1.12, IF: 1.12, VVS1: 1.08, VVS2: 1.05, VS1: 1.0, VS2: 0.96, SI1: 0.9 };
```

factor 헬퍼 추가(파일 상단 상수들 아래):

```js
// range 양끝 factor 평균 — 레거시 단일값(form.color)은 그대로 조회
function rangeFactor(factors, range, legacy) {
  if (Array.isArray(range) && range.length) {
    return ((factors[range[0]] ?? 1.0) + (factors[range[1]] ?? 1.0)) / 2;
  }
  return factors[legacy] ?? 1.0;
}
```

스톤 단가 블록(39-53행)을 교체:

```js
  const solitaire = form.productLine === "solitaire";
  let benchmarkUsdPerCt;
  let carat;
  if (solitaire) {
    carat = Number(form.stonePrefs?.carat) || 1.0;
    const bench = benchmarkFor(form.stonePrefs?.shape || "round", carat);
    const unit = bench?.unitUsdPerCt ?? 400;
    benchmarkUsdPerCt = unit
      * rangeFactor(COLOR_FACTOR, form.stonePrefs?.colorRange, form.stonePrefs?.color)
      * rangeFactor(CLARITY_FACTOR, form.stonePrefs?.clarityRange, form.stonePrefs?.clarity);
  } else {
    // 멀티스톤: 고객이 고른 총 캐럿 × 멜리 단가 — 퀄리티 range는 상담에서 확정(견적 미반영)
    carat = clampTotalCarat(form.category, form.multiSpec?.totalCarat);
    benchmarkUsdPerCt = s.meleeUsdPerCt ?? 150;
  }
```

`src/lib/seed.js` settings 객체(`coupons:` 라인 근처)에 추가:

```js
      // 멀티스톤 총캐럿 견적용 멜리(스몰 스톤) 단가 — 어드민 벤치마크 페이지에서 조정
      meleeUsdPerCt: 150,
```

`src/lib/store.js` `migrateDB`의 payment 주입 블록 뒤에 추가:

```js
  // 멜리 단가(2026-07 총캐럿 스텝) — 구버전 저장 DB에 기본값 주입
  if (d?.settings && d.settings.meleeUsdPerCt == null) {
    d.settings.meleeUsdPerCt = 150;
    changed = true;
  }
```

`server/settingsRepository.js`의 `PUBLIC_SETTINGS_KEYS` 배열 `"coupons"` 라인 뒤에 추가:

```js
  "meleeUsdPerCt", // 멀티스톤 총캐럿 견적 단가 — 위저드 견적 추정이 소비
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/quoteEstimate.test.js src/lib/__tests__/coupons.test.js` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A src server && git commit -m "feat: 멀티 견적 총캐럿×멜리단가 반영 + 솔리테어 등급 range factor"`

---

### Task 4: ops.js — autoBrief·풀 매칭 range 호환

**Files:**
- Modify: `src/lib/ops.js:143-158` (autoBrief), `src/lib/ops.js:203-212` (poolStoneMatches)
- Test: `src/lib/__tests__/ops.test.js` (기존 — autoBrief 기대값 확인/추가)

**Interfaces:**
- Consumes: Task 1의 `formatGradeRange`
- Produces: autoBrief 멀티 출력에 `"{n}ct total"` 선두 포함; 솔리테어는 range 라벨(레거시 단일값 폴백). poolStoneMatches는 range 하한 기준 매칭.

- [ ] **Step 1: 테스트 추가** — `src/lib/__tests__/ops.test.js`에 describe 추가:

```js
describe("autoBrief — 등급 range", () => {
  it("멀티: totalCarat과 파생 standard가 브리프에 실린다", () => {
    const brief = autoBrief({ productLine: "multi", multiSpec: { totalCarat: 5, standard: "E–G / VVS1–VS2", meleeSpec: "", overallDims: "", arrangement: "" } });
    expect(brief).toContain("5ct total");
    expect(brief).toContain("E–G / VVS1–VS2");
  });
  it("솔리테어: colorRange가 있으면 range 라벨, 없으면 단일값", () => {
    const brief = autoBrief({ productLine: "solitaire", stonePrefs: { carat: 1.5, shape: "round", colorRange: ["F", "D"], clarityRange: ["VS1", "IF-FL"], growth: "CVD", lab: "IGI", colorTreatment: "disclosed" } });
    expect(brief).toContain("D–F/IF-FL–VS1");
    const legacy = autoBrief({ productLine: "solitaire", stonePrefs: { carat: 1.5, shape: "round", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI", colorTreatment: "disclosed" } });
    expect(legacy).toContain("E/VS1");
  });
});

describe("poolStoneMatches — range 하한 매칭", () => {
  const stone = { shape: "round", carat: 1.5, color: "F", clarity: "VS1", growth: "CVD" };
  const opts = { caratUnder: 0.05, caratOver: 0.4 };
  it("스톤 등급이 range 하한 이상이면 매칭", () => {
    expect(poolStoneMatches(stone, { shape: "round", carat: 1.5, colorRange: ["G", "D"], clarityRange: ["VS2", "IF-FL"], growth: "CVD" }, opts)).toBe(true);
  });
  it("하한 미달이면 탈락", () => {
    expect(poolStoneMatches(stone, { shape: "round", carat: 1.5, colorRange: ["E", "D"], clarityRange: ["VS2", "IF-FL"], growth: "CVD" }, opts)).toBe(false);
  });
});
```

(import에 `autoBrief`, `poolStoneMatches`가 없으면 추가)

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/ops.test.js` / Expected: 신규 FAIL
- [ ] **Step 3: 구현** — `src/lib/ops.js` 상단 import 추가: `import { formatGradeRange } from "./gradeScale.js";`

autoBrief 교체:

```js
export function autoBrief(intake) {
  if (intake.productLine === "solitaire" && intake.stonePrefs) {
    const s = intake.stonePrefs;
    const colorLbl = formatGradeRange(s.colorRange) || s.color;
    const clarityLbl = formatGradeRange(s.clarityRange) || s.clarity;
    return [
      s.carat && `${s.carat}ct ${s.shape}`, colorLbl && `${colorLbl}/${clarityLbl}`, s.growth, s.lab,
      s.colorTreatment === "disclosed" ? "post-growth treatment OK" : s.colorTreatment,
      s.fluorescence && s.fluorescence !== "none" && `fluor ${s.fluorescence}`,
      s.lwRatio && `L/W ${s.lwRatio}`,
    ].filter(Boolean).join(" · ");
  }
  if (intake.multiSpec) {
    const m = intake.multiSpec;
    return [
      m.totalCarat && `${m.totalCarat}ct total`,
      m.meleeSpec && `melee: ${m.meleeSpec}`,
      m.overallDims, m.arrangement, m.standard,
    ].filter(Boolean).join(" · ");
  }
  return "see style reference";
}
```

poolStoneMatches의 등급 두 줄 교체 ("IF-FL" 하한은 CLARITY_ORDER의 "IF"로 매핑):

```js
  const colorMin = Array.isArray(prefs.colorRange) ? prefs.colorRange[0] : prefs.color;
  const clarityMinRaw = Array.isArray(prefs.clarityRange) ? prefs.clarityRange[0] : prefs.clarity;
  const clarityMin = clarityMinRaw === "IF-FL" ? "IF" : clarityMinRaw;
  if (!gradeAtLeast(COLOR_ORDER, stone.color, colorMin)) return false;
  if (!gradeAtLeast(CLARITY_ORDER, stone.clarity, clarityMin)) return false;
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/ops.test.js src/lib/__tests__/autoFlow.test.js src/lib/__tests__/opsStore.test.js` / Expected: PASS (autoFlow 브리프 기대문자열이 바뀌었으면 그 테스트의 기대값을 새 포맷으로 갱신)
- [ ] **Step 5: Commit** — `git add -A src/lib && git commit -m "feat: autoBrief·풀매칭 등급 range 호환 (+멀티 totalCarat 브리프)"`

---

### Task 5: 피커 컴포넌트 — GradeRangeSlider·TotalCaratSlider + CSS

**Files:**
- Modify: `src/components/intake/pickers.jsx` (파일 끝에 두 컴포넌트 추가)
- Modify: `src/platform.css` (`.gflow-scale` 정의부(±5101행) 근처에 CSS 추가)

**Interfaces:**
- Produces: `GradeRangeSlider({ scale, value, onChange, ariaLabel })` — value는 `[lo,hi]` 등급 문자열, onChange도 동일 형식. `TotalCaratSlider({ value, onChange, min, max, step, unitLabel })` — onChange는 문자열 값.

- [ ] **Step 1: 컴포넌트 추가** — `src/components/intake/pickers.jsx` 끝에:

```jsx
// 등급 range 슬라이더 — 브릴리언스식 듀얼 핸들. 겹친 두 개의 네이티브 range 인풋으로
// 키보드 접근성을 공짜로 얻고, 썸만 포인터를 받는다. 값은 [하한, 상한] 등급 문자열.
export function GradeRangeSlider({ scale, value, onChange, ariaLabel = "" }) {
  const loRaw = scale.indexOf(value?.[0]);
  const hiRaw = scale.indexOf(value?.[1]);
  const lo = loRaw < 0 ? 0 : loRaw;
  const hi = hiRaw < 0 ? scale.length - 1 : hiRaw;
  const maxIdx = scale.length - 1;
  const pct = (i) => (maxIdx === 0 ? 0 : (i / maxIdx) * 100);
  const commit = (nextLo, nextHi) => onChange([scale[nextLo], scale[nextHi]]);
  return (
    <div className="gflow-grange" role="group" aria-label={ariaLabel}>
      <div className="gflow-grange-track">
        <span className="gflow-grange-fill" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} aria-hidden="true" />
        <input
          type="range" min="0" max={maxIdx} step="1" value={lo}
          aria-label={`${ariaLabel} min`}
          onChange={(e) => commit(Math.min(Number(e.target.value), hi), hi)}
        />
        <input
          type="range" min="0" max={maxIdx} step="1" value={hi}
          aria-label={`${ariaLabel} max`}
          onChange={(e) => commit(lo, Math.max(Number(e.target.value), lo))}
        />
      </div>
      <div className="gflow-grange-labels" aria-hidden="true">
        {scale.map((grade, i) => (
          <span key={grade} className={i >= lo && i <= hi ? "is-active" : ""}>{grade}</span>
        ))}
      </div>
    </div>
  );
}

// 총 캐럿 슬라이더 — 멀티스톤은 합계 중량이라 실물 프리뷰 없이 리드아웃만 (CaratSlider 비주얼 문법 재사용)
export function TotalCaratSlider({ value, onChange, min, max, step, unitLabel = "ct total" }) {
  const ct = Number(value) || min;
  return (
    <div className="gflow-carat">
      <div className="gflow-carat-visual">
        <span className="gflow-carat-readout"><strong>{ct.toFixed(2)}</strong><small>{unitLabel}</small></span>
      </div>
      <input
        className="gflow-carat-range"
        type="range" min={min} max={max} step={step} value={ct}
        aria-label="total carat"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 2: CSS 추가** — `src/platform.css`의 `.gflow-scale` 블록 위에 추가. **주의:** 토큰은 인접한 `.gflow-carat-range`/`.gflow-scale` 규칙이 실제 사용하는 변수(예: `var(--line)`, `var(--muted)`, 액센트 변수)를 그대로 따라 쓴다 — 구현 시 해당 블록을 읽고 동일 토큰으로 맞출 것. 기준 코드:

```css
/* 등급 range 슬라이더 — 듀얼 핸들 (겹친 두 range 인풋, 썸만 클릭) */
.gflow-grange { width: min(100%, 520px); display: grid; gap: 10px; }
.gflow-grange-track { position: relative; height: 24px; }
.gflow-grange-track::before {
  content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 3px;
  transform: translateY(-50%); background: var(--line); border-radius: 2px;
}
.gflow-grange-fill {
  position: absolute; top: 50%; height: 3px; transform: translateY(-50%);
  background: var(--accent); border-radius: 2px;
}
.gflow-grange-track input[type="range"] {
  position: absolute; inset: 0; width: 100%; height: 24px; margin: 0;
  -webkit-appearance: none; appearance: none; background: none; pointer-events: none;
}
.gflow-grange-track input[type="range"]:focus-visible { outline: 1px solid var(--accent); outline-offset: 4px; }
.gflow-grange-track input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; pointer-events: auto;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--bg-1); border: 1px solid var(--accent);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.28); cursor: grab;
}
.gflow-grange-track input[type="range"]::-moz-range-thumb {
  pointer-events: auto; width: 18px; height: 18px; border-radius: 50%;
  background: var(--bg-1); border: 1px solid var(--accent);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.28); cursor: grab;
}
.gflow-grange-labels { display: flex; justify-content: space-between; font-size: 12px; letter-spacing: 0.04em; color: var(--muted); }
.gflow-grange-labels .is-active { color: var(--accent); font-weight: 600; }
.gflow-grange-fields { display: grid; gap: 22px; width: min(100%, 520px); }
```

- [ ] **Step 3: 빌드 확인** — Run: `npx vite build 2>&1 | tail -3` / Expected: 빌드 성공
- [ ] **Step 4: Commit** — `git add src/components/intake/pickers.jsx src/platform.css && git commit -m "feat: GradeRangeSlider·TotalCaratSlider 피커 + gflow-grange CSS"`

---

### Task 6: IntakeForm — 멀티 '스톤' 스텝 + 리뷰 range 교체

**Files:**
- Modify: `src/pages/IntakeForm.jsx` (screenList, baseForm, 정규화, 스텝 JSX, 리뷰 카드/퀄리티 섹션, sectionKicker)
- Modify: `src/opsStrings.js` — `intake.gflow`에 4개 언어 키 추가 (en ±60행, ko ±477행, zh ±885행, es ±1293행 블록)

**Interfaces:**
- Consumes: Task 1 상수/헬퍼, Task 5 컴포넌트
- Produces: 멀티 플로우 `category → design → metal → stones → inspiration → (contact) → review`; form 상태에 `multiSpec.totalCarat`(문자열)·`colorRange`·`clarityRange`, `stonePrefs.colorRange`·`clarityRange`

- [ ] **Step 1: opsStrings 4개 언어 gflow 키 추가** — 각 로케일 `gflow` 객체의 `qCarat` 근처에:

EN:
```js
      qStones: "How many carats in total?",
      stonesHint: "Total carat weight across all stones — pick a quality range and we finalize it together.",
      totalCaratUnit: "ct total",
      colorRangeLbl: "Color range",
      clarityRangeLbl: "Clarity range",
      qualityRangeNote: "Estimate follows your total carats — the quality range is confirmed in your proposal.",
```
KO:
```js
      qStones: "총 몇 캐럿으로 할까요?",
      stonesHint: "모든 스톤을 합친 총 캐럿이에요 — 퀄리티는 범위로 골라두면 제안에서 함께 확정해요.",
      totalCaratUnit: "ct 합계",
      colorRangeLbl: "컬러 범위",
      clarityRangeLbl: "클래리티 범위",
      qualityRangeNote: "견적은 총 캐럿 기준이에요 — 퀄리티 범위는 확정 제안에서 최종 확정됩니다.",
```
ZH:
```js
      qStones: "总共想要多少克拉？",
      stonesHint: "所有钻石的总克拉数——品质选一个范围，方案阶段一起确定。",
      totalCaratUnit: "克拉（总计）",
      colorRangeLbl: "颜色范围",
      clarityRangeLbl: "净度范围",
      qualityRangeNote: "预估按总克拉计算——品质范围将在正式方案中确定。",
```
ES:
```js
      qStones: "¿Cuántos quilates en total?",
      stonesHint: "Peso total en quilates de todas las piedras — elige un rango de calidad y lo confirmamos juntos.",
      totalCaratUnit: "ct en total",
      colorRangeLbl: "Rango de color",
      clarityRangeLbl: "Rango de claridad",
      qualityRangeNote: "La estimación sigue tus quilates totales — el rango de calidad se confirma en la propuesta.",
```

- [ ] **Step 2: IntakeForm 상태·플로우 변경** — `src/pages/IntakeForm.jsx`:

(a) import 추가:

```js
import { CaratSlider, GradeRangeSlider, ImageOptionGrid, MetalSwatches, ShapeSilhouette, ShapeTiles, TotalCaratSlider } from "../components/intake/pickers.jsx";
import {
  CLARITY_SCALE, COLOR_SCALE, MULTI_CLARITY_DEFAULT, MULTI_COLOR_DEFAULT,
  SOLITAIRE_CLARITY_DEFAULT, SOLITAIRE_COLOR_DEFAULT, TOTAL_CARAT_RANGES,
  clampGradeRange, clampTotalCarat, formatGradeRange,
} from "../lib/gradeScale.js";
```
(기존 import에서 `ScalePicker` 제거 — 사용처가 사라진다)

(b) `screenList`(99-106행) 교체:

```js
// 질문 순서 — 멀티스톤 디자인은 셰입/캐럿 대신 총캐럿·퀄리티 '스톤' 스텝, 비회원은 리뷰 직전에 연락처
function screenList(productLine, isGuest) {
  const list = ["category", "design", "metal"];
  if (productLine === "solitaire") list.push("shape", "carat");
  else list.push("stones");
  list.push("inspiration");
  if (isGuest) list.push("contact");
  list.push("review");
  return list;
}
```

(c) `baseForm`의 stonePrefs/multiSpec 교체(134-139행):

```js
    stonePrefs: {
      shape: refDiamond?.shape || "round", carat: String(refDiamond?.carat || "1.5"),
      // 쇼케이스 다이아 프리필은 단일값 → [v,v] range로 승격
      colorRange: clampGradeRange(COLOR_SCALE, refDiamond?.color, SOLITAIRE_COLOR_DEFAULT),
      clarityRange: clampGradeRange(CLARITY_SCALE, refDiamond?.clarity, SOLITAIRE_CLARITY_DEFAULT),
      growth: "CVD", lab: "IGI India", colorTreatment: "disclosed", fluorescence: "none", lwRatio: "",
    },
    multiSpec: {
      totalCarat: String(TOTAL_CARAT_RANGES[initialCategory]?.default ?? 1.5),
      colorRange: [...MULTI_COLOR_DEFAULT], clarityRange: [...MULTI_CLARITY_DEFAULT],
      meleeSpec: "", overallDims: "", arrangement: "", standard: "",
    },
```

(d) 드래프트 복원 정규화 — `screenList` 함수 아래에 헬퍼 추가:

```js
// 구 드래프트(단일 color/clarity·range 없음)·카테고리 불일치 총캐럿을 기본값으로 정규화
function normalizeStoneSelections(form) {
  return {
    ...form,
    stonePrefs: {
      ...form.stonePrefs,
      colorRange: clampGradeRange(COLOR_SCALE, form.stonePrefs?.colorRange ?? form.stonePrefs?.color, SOLITAIRE_COLOR_DEFAULT),
      clarityRange: clampGradeRange(CLARITY_SCALE, form.stonePrefs?.clarityRange ?? form.stonePrefs?.clarity, SOLITAIRE_CLARITY_DEFAULT),
    },
    multiSpec: {
      ...form.multiSpec,
      totalCarat: String(clampTotalCarat(form.category, form.multiSpec?.totalCarat)),
      colorRange: clampGradeRange(COLOR_SCALE, form.multiSpec?.colorRange, MULTI_COLOR_DEFAULT),
      clarityRange: clampGradeRange(CLARITY_SCALE, form.multiSpec?.clarityRange, MULTI_CLARITY_DEFAULT),
    },
  };
}
```

useState 초기화(151-169행)의 draft 병합 return을 `return normalizeStoneSelections({ ...기존 객체... });`로 감싼다 (baseForm-only 분기는 이미 정규 형태라 그대로).

(e) `setS` 아래에 멀티 패치 헬퍼(193행 근처):

```js
  const setM = (patch) => setForm((f) => ({ ...f, multiSpec: { ...f.multiSpec, ...patch } }));
```

(f) 카테고리 변경 시 총캐럿 리셋 — category 화면 `onSelect`의 "다른 피스" 분기 patch에 한 줄 추가:

```js
                : {
                  category: value,
                  subcategory: defaultSubcategoryFor(value),
                  conditional: categoryDefaults(value),
                  styleId: "",
                  // 총캐럿 범위가 카테고리마다 달라 기본값으로 리셋
                  multiSpec: { ...form.multiSpec, totalCarat: String(TOTAL_CARAT_RANGES[value]?.default ?? 1.5) },
                },
```

(g) `colorOptions`/`clarityOptions`(382-383행) 삭제, 자리에:

```js
  const totalCaratRange = TOTAL_CARAT_RANGES[form.category] || TOTAL_CARAT_RANGES.ring;
```

`sectionKicker`(384-387행)에 `stones: g.stoneCard,` 추가.

(h) carat 스텝 블록 뒤에 새 '스톤' 스텝:

```jsx
      {activeScreen === "stones" && stepShell(g.qStones, g.stonesHint, (
        <>
          <TotalCaratSlider
            value={form.multiSpec.totalCarat}
            min={totalCaratRange.min} max={totalCaratRange.max} step={totalCaratRange.step}
            unitLabel={g.totalCaratUnit}
            onChange={(value) => setM({ totalCarat: value })}
          />
          <div className="gflow-grange-fields">
            <label className="field"><span>{g.colorRangeLbl}</span>
              <GradeRangeSlider scale={COLOR_SCALE} ariaLabel={t.color} value={form.multiSpec.colorRange} onChange={(v) => setM({ colorRange: v })} />
            </label>
            <label className="field"><span>{g.clarityRangeLbl}</span>
              <GradeRangeSlider scale={CLARITY_SCALE} ariaLabel={t.clarity} value={form.multiSpec.clarityRange} onChange={(v) => setM({ clarityRange: v })} />
            </label>
          </div>
          <button className="button primary" type="button" onClick={goNext}>{t.next}</button>
          <details className="gflow-edu-toggle">
            <summary>{g.whatsThis}</summary>
            <div className="gflow-edu-body"><StoneEduPanel field="carat" prefs={form.stonePrefs} /></div>
          </details>
        </>
      ))}
```

(i) 리뷰 스톤 카드(577-587행) 교체:

```jsx
                {solitaire ? (
                  <>
                    <strong>{p.shapes[form.stonePrefs.shape] || form.stonePrefs.shape} {Number(form.stonePrefs.carat).toFixed(2)}ct</strong>
                    <small>{formatGradeRange(form.stonePrefs.colorRange)} · {formatGradeRange(form.stonePrefs.clarityRange)} · {form.stonePrefs.growth} · IGI</small>
                  </>
                ) : (
                  <>
                    <strong>{Number(form.multiSpec.totalCarat).toFixed(2)}{g.totalCaratUnit === "ct total" ? "ct" : "ct"} · {formatGradeRange(form.multiSpec.colorRange)} · {formatGradeRange(form.multiSpec.clarityRange)}</strong>
                    <small>{g.multiNote}</small>
                  </>
                )}
```

(단순화: `<strong>{Number(form.multiSpec.totalCarat).toFixed(2)}ct · …` 로 고정 "ct" 사용)

(j) 솔리테어 리뷰 퀄리티 섹션(693-708행) 교체:

```jsx
          {solitaire && (
            <section className="gflow-review-section">
              <h4>{g.quality}</h4>
              <div className="gflow-quality-row">
                <strong>{formatGradeRange(form.stonePrefs.colorRange)} · {formatGradeRange(form.stonePrefs.clarityRange)} · {form.stonePrefs.growth} · IGI</strong>
                <button className="button secondary small" type="button" onClick={() => setAdjustQuality((v) => !v)}>{g.adjust}</button>
              </div>
              {adjustQuality && (
                <div className="gflow-grange-fields">
                  <label className="field"><span>{g.colorRangeLbl}</span>
                    <GradeRangeSlider scale={COLOR_SCALE} ariaLabel={t.color} value={form.stonePrefs.colorRange} onChange={(v) => setS({ colorRange: v })} />
                  </label>
                  <label className="field"><span>{g.clarityRangeLbl}</span>
                    <GradeRangeSlider scale={CLARITY_SCALE} ariaLabel={t.clarity} value={form.stonePrefs.clarityRange} onChange={(v) => setS({ clarityRange: v })} />
                  </label>
                </div>
              )}
              <p className="form-hint" style={{ margin: 0 }}>{g.qualityDefaultNote}</p>
            </section>
          )}
```

(k) 접수 완료 전 요약(카드 579-580행과 리뷰 697행 두 군데 모두 (i)/(j)에서 처리됨을 확인).

- [ ] **Step 3: QuoteCompare에 멀티 안내 한 줄** — `src/components/QuoteCompare.jsx` 마지막 `<p className="qc-note">{t.note}</p>` 아래에:

```jsx
      {!est.solitaire && <p className="qc-note">{p.intake.gflow.qualityRangeNote}</p>}
```

- [ ] **Step 4: 전체 테스트 + 빌드** — Run: `npx vitest run && npx vite build 2>&1 | tail -3` / Expected: 전부 PASS + 빌드 성공
- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: 인테이크 — 멀티 '스톤' 스텝(총캐럿+퀄리티 range) + 솔리테어 리뷰 range 교체"`

---

### Task 7: 어드민 벤치마크 — 멜리 단가 편집 필드

**Files:**
- Modify: `src/pages/admin/AdminBenchmark.jsx`

**Interfaces:**
- Consumes: `getSettings`/`updateSettings`(store), `pushSettingsToServer`
- Produces: 어드민이 `settings.meleeUsdPerCt`를 수정 → 서버 write-through

- [ ] **Step 1: 구현** — import에 `getSettings, updateSettings` 추가 (`adjustBenchmark, getBenchmark, getSettings, setBenchmarkPrice, updateSettings`). `BULK_COPY` 아래에:

```js
// 멜리(멀티스톤) 단가 카피 — 총캐럿 견적용
const MELEE_COPY = {
  en: { title: "Melee rate", unit: "USD / ct (total)", hint: "Multi-stone estimates = total carats × this rate × multiplier." },
  ko: { title: "멜리 단가", unit: "USD / ct (합계)", hint: "멀티스톤 견적 = 총 캐럿 × 이 단가 × 멀티플라이어." },
  zh: { title: "碎钻单价", unit: "USD / 克拉（总计）", hint: "多钻预估 = 总克拉 × 此单价 × 倍数。" },
  es: { title: "Tarifa melee", unit: "USD / ct (total)", hint: "Estimación multi-piedra = quilates totales × esta tarifa × multiplicador." },
};
```

컴포넌트 안 `const [bulk, setBulk] = ...` 아래에:

```js
  const m = MELEE_COPY[locale] || MELEE_COPY.en;
  const meleeUsdPerCt = getSettings().meleeUsdPerCt ?? 150;

  function commitMelee(value) {
    const v = Number(value);
    if (!v || v === meleeUsdPerCt) return;
    updateSettings({ meleeUsdPerCt: v });
    pushSettingsToServer({ meleeUsdPerCt: v });
    setSavedCell(`${t.saved} — ${m.title}`);
  }
```

일괄 조정 `con-adjust` div 아래(테이블 위)에 렌더 추가:

```jsx
      <div className="con-adjust">
        <span className="con-adjust-label">{m.title}</span>
        <label className="field field-pct"><span>{m.unit}</span>
          <input
            type="number" step="5" min="1"
            defaultValue={meleeUsdPerCt} key={meleeUsdPerCt}
            onBlur={(e) => commitMelee(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          />
        </label>
        <span className="con-note" style={{ margin: 0 }}>{m.hint}</span>
      </div>
```

- [ ] **Step 2: 빌드 확인** — Run: `npx vite build 2>&1 | tail -3` / Expected: 성공
- [ ] **Step 3: Commit** — `git add src/pages/admin/AdminBenchmark.jsx && git commit -m "feat: 어드민 벤치마크 — 멜리 $/ct 편집 필드 (서버 write-through)"`

---

### Task 8: 브라우저 검증 (verify 스킬)

- [ ] **Step 1:** `verify` 스킬 레시피로 dev 서버 + Playwright 구동
- [ ] **Step 2:** 멀티 플로우 — 카테고리 bangle → 테니스 브레이슬릿 계열 디자인 → metal → **스톤 스텝 표시**(총캐럿 5.00 기본, 컬러/클래리티 슬라이더) → 총캐럿 10으로 → 리뷰에서 스톤 카드 `10.00ct · E–G · VVS1–VS2` + 견적이 캐럿에 반응하는지 확인
- [ ] **Step 3:** 솔리테어 플로우 — ring → 솔리테어 디자인 → 리뷰 퀄리티 Adjust → range 슬라이더 동작·라벨 `D–F · IF-FL–VS1` 형식 확인
- [ ] **Step 4:** 스크린샷 확보 (스톤 스텝·리뷰) — 이상 발견 시 systematic-debugging으로 수정 후 재검증
