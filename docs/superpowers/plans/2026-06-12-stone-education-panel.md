# 센터스톤 교육 사이드 패널 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인테이크 폼의 센터스톤 8개 필드(Shape·Carat·Color·Clarity·Growth·Lab·Fluorescence·L/W)에 포커스하면, 해당 항목을 SVG 일러스트 + 4개 언어 설명으로 교육하는 사이드 패널을 붙인다.

**Architecture:** 순수 데이터/계산은 `src/lib/stoneEdu.js`, 표시 전용 컴포넌트는 `src/components/StoneEducation.jsx`(SVG 서브컴포넌트 포함), 문구는 `src/opsStrings.js`의 `stoneEdu` 섹션(en/ko/zh/es). IntakeForm은 `eduField` 상태 1개 + onFocus + 레이아웃 래퍼만 추가하고 제출 payload는 건드리지 않는다. 데스크톱은 폼 옆 sticky aside, ≤1120px에선 센터스톤 그리드 아래 인라인 복제 렌더(CSS로 둘 중 하나만 표시).

**Tech Stack:** React 19 (JSX, hooks), 인라인 SVG (CSS 변수 기반), vitest (node 환경 — 컴포넌트 렌더 테스트 인프라 없음 → lib/문자열 테스트만), 기존 `useLocale()` 컨텍스트.

**스펙:** `docs/superpowers/specs/2026-06-12-stone-education-panel-design.md`

**주의:** 워킹 트리에 다른 세션의 수정 파일이 있다. **절대 `git add -A`/`commit -a` 금지** — 각 커밋에서 이 플랜이 명시한 파일만 staging.

---

## File Structure

| 파일 | 역할 |
|---|---|
| Create `src/lib/stoneEdu.js` | 스케일 상수(컬러/클래리티/형광/캐럿/비율) + 캐럿→mm 계산 + 최근접 인덱스. 순수 함수만 |
| Create `src/lib/__tests__/stoneEdu.test.js` | 4개 언어 stoneEdu 파리티 + lib 헬퍼 테스트 |
| Modify `src/opsStrings.js` | 각 로케일(en≈L3, ko≈L125, zh≈L247, es≈L369)에 `stoneEdu` 섹션 추가 |
| Create `src/components/StoneEducation.jsx` | `<StoneEduPanel field prefs />` + 필드별 SVG 비주얼 8종 |
| Modify `src/pages/IntakeForm.jsx` | eduField 상태, onFocus 8개, aside/인라인 렌더, 페이지 폭 |
| Modify `src/platform.css` | `.stone-edu-*`, `.edu-*` 스타일 + 1120px 미디어 쿼리 |

---

### Task 1: lib/stoneEdu.js — 순수 데이터/계산 (TDD)

**Files:**
- Create: `src/lib/stoneEdu.js`
- Test: `src/lib/__tests__/stoneEdu.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/stoneEdu.test.js` 생성 (파리티 테스트는 Task 2에서 추가하므로 여기선 lib만):

```js
import { describe, expect, it } from "vitest";
import {
  EDU_FIELDS, COLOR_SCALE, COLOR_TINTS, CLARITY_SCALE, CLARITY_DOTS,
  FLUOR_LEVELS, CARAT_REFS, RATIO_EXAMPLES, caratDiameterMm, nearestIndex,
} from "../stoneEdu.js";

describe("stoneEdu — 센터스톤 교육 데이터/계산", () => {
  it("EDU_FIELDS — 인테이크 센터스톤 8개 필드와 일치", () => {
    expect(EDU_FIELDS).toEqual(["shape", "carat", "color", "clarity", "growth", "lab", "fluorescence", "lwRatio"]);
  });

  it("스케일 무결성 — 컬러 D 시작, 클래리티 내포물 단조 증가, 틴트 전체 존재", () => {
    expect(COLOR_SCALE[0]).toBe("D");
    expect(COLOR_SCALE).toContain("J");
    for (const g of COLOR_SCALE) expect(COLOR_TINTS[g], g).toMatch(/^#/);
    expect(CLARITY_SCALE).toEqual(["IF", "VVS1", "VVS2", "VS1", "VS2"]);
    expect(CLARITY_DOTS.IF).toBe(0);
    for (let i = 1; i < CLARITY_SCALE.length; i++) {
      expect(CLARITY_DOTS[CLARITY_SCALE[i]]).toBeGreaterThan(CLARITY_DOTS[CLARITY_SCALE[i - 1]]);
    }
    expect(FLUOR_LEVELS).toEqual(["none", "faint", "medium"]); // 폼 select value와 동일 (소문자)
    expect(CARAT_REFS).toContain(1.5);
    expect(RATIO_EXAMPLES[0]).toBe(1.0);
  });

  it("caratDiameterMm — 1ct ≈ 6.45mm, 단조 증가, 무효 입력은 null", () => {
    expect(caratDiameterMm(1)).toBeCloseTo(6.45, 2);
    expect(caratDiameterMm(2)).toBeGreaterThan(caratDiameterMm(1.5));
    expect(caratDiameterMm("1.5")).toBeCloseTo(6.45 * Math.cbrt(1.5), 4); // 폼 값은 문자열
    expect(caratDiameterMm("")).toBeNull();
    expect(caratDiameterMm(0)).toBeNull();
    expect(caratDiameterMm(-1)).toBeNull();
  });

  it("nearestIndex — 최근접 기준값 인덱스, 파싱 불가면 -1", () => {
    expect(nearestIndex(CARAT_REFS, 1.4)).toBe(2);  // 1.5가 최근접
    expect(nearestIndex(CARAT_REFS, "2.2")).toBe(3); // 2
    expect(nearestIndex(CARAT_REFS, 99)).toBe(4);    // 3 (마지막)
    expect(nearestIndex(CARAT_REFS, "")).toBe(-1);
    expect(nearestIndex(CARAT_REFS, "abc")).toBe(-1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/stoneEdu.test.js`
Expected: FAIL — `Failed to load ../stoneEdu.js` (모듈 없음)

- [ ] **Step 3: 최소 구현**

`src/lib/stoneEdu.js` 생성:

```js
// 센터스톤 교육 패널 — 순수 데이터/계산. 표시(SVG)는 components/StoneEducation.jsx 담당.
export const EDU_FIELDS = ["shape", "carat", "color", "clarity", "growth", "lab", "fluorescence", "lwRatio"];

// 교육 스케일은 폼 선택지(D–G)보다 넓게 보여준다 — 등급이 어디쯤인지 감각을 주기 위함
export const COLOR_SCALE = ["D", "E", "F", "G", "H", "I", "J"];
export const COLOR_TINTS = {
  D: "#f8fafc", E: "#f7f7f2", F: "#f6f4e9", G: "#f4f0de", H: "#f2ebd1", I: "#f0e6c3", J: "#eee0b5",
};

export const CLARITY_SCALE = ["IF", "VVS1", "VVS2", "VS1", "VS2"];
export const CLARITY_DOTS = { IF: 0, VVS1: 1, VVS2: 2, VS1: 3, VS2: 5 };

export const FLUOR_LEVELS = ["none", "faint", "medium"]; // 인테이크 select value와 동일

export const CARAT_REFS = [0.5, 1, 1.5, 2, 3];
export const RATIO_EXAMPLES = [1.0, 1.35, 1.5];

// 라운드 브릴리언트 근사 정면 직경 — 1ct ≈ 6.45mm, 직경 ∝ ∛중량
export function caratDiameterMm(carat) {
  const c = Number(carat);
  if (!Number.isFinite(c) || c <= 0) return null;
  return 6.45 * Math.cbrt(c);
}

export function nearestIndex(list, value) {
  const v = Number(value);
  if (value === "" || value == null || !Number.isFinite(v)) return -1;
  let best = 0;
  for (let i = 1; i < list.length; i++) {
    if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) best = i;
  }
  return best;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/__tests__/stoneEdu.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/stoneEdu.js src/lib/__tests__/stoneEdu.test.js
git commit -m "feat(edu): 센터스톤 교육 스케일 데이터 + 캐럿→mm 계산"
```

---

### Task 2: opsStrings.js — stoneEdu 4개 언어 문구 (TDD)

**Files:**
- Modify: `src/lib/__tests__/stoneEdu.test.js` (파리티 테스트 추가)
- Modify: `src/opsStrings.js` (4개 로케일에 `stoneEdu` 추가 — en은 `intake:` 블록 위 L19 근처, ko L141, zh L263, es L385의 각 `intake:` 바로 위)

- [ ] **Step 1: 파리티 테스트 추가 (실패 확인용)**

`src/lib/__tests__/stoneEdu.test.js` 상단 import에 추가:

```js
import { opsStrings } from "../../opsStrings.js";
```

describe 블록 안에 테스트 추가:

```js
  it("4개 언어 stoneEdu 파리티 — kicker + 8필드 × title/body/guide", () => {
    for (const loc of ["en", "ko", "zh", "es"]) {
      const edu = opsStrings[loc].stoneEdu;
      expect(edu, `${loc}.stoneEdu`).toBeTruthy();
      expect(edu.kicker, `${loc}.kicker`).toBeTruthy();
      for (const f of EDU_FIELDS) {
        for (const k of ["title", "body", "guide"]) {
          expect(edu[f]?.[k], `${loc}.${f}.${k}`).toBeTruthy();
        }
      }
    }
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/__tests__/stoneEdu.test.js`
Expected: FAIL — `en.stoneEdu` undefined

- [ ] **Step 3: 4개 로케일에 stoneEdu 추가**

각 로케일 객체의 `intake: {` 바로 위에 삽입.

**en** (`const en = {` 블록):

```js
  stoneEdu: {
    kicker: "Diamond guide",
    shape: {
      title: "Shape",
      body: "The outline of the stone seen from above. Round brilliants deliver maximum sparkle; fancy shapes like oval and pear spread their weight wider, so they face up larger per carat.",
      guide: "Round is the timeless default — oval is the modern pick that wears bigger.",
    },
    carat: {
      title: "Carat weight",
      body: "1 carat = 0.2 g. Face-up size grows slower than weight — a 2 ct round is only about 26% wider than a 1 ct.",
      guide: "Lab-grown pricing makes 1.5–2 ct the sweet spot — sizes that stay rare in mined stones.",
    },
    color: {
      title: "Color grade",
      body: "Graded from D (perfectly colorless) toward Z (warm tint). D–F read colorless; G–J are near-colorless with a hint of warmth from the side.",
      guide: "E reads icy white with no warm tint — our showcase standard.",
    },
    clarity: {
      title: "Clarity grade",
      body: "Counts the inclusions visible under 10× magnification — from IF (internally flawless) down through VVS and VS. VS-grade inclusions are invisible to the naked eye.",
      guide: "VS1 is eye-clean — the value sweet spot before prices jump.",
    },
    growth: {
      title: "Growth method",
      body: "CVD grows the diamond layer by layer in a plasma chamber; HPHT recreates the earth's pressure in a press. Both are real diamonds — identical in hardness, fire, and chemistry.",
      guide: "Above 2 ct we recommend CVD with disclosed post-growth treatment — far better availability.",
    },
    lab: {
      title: "Grading laboratory",
      body: "An independent lab — IGI grades most lab-grown stones — verifies the 4Cs and laser-inscribes the report number on the girdle.",
      guide: "We verify the girdle inscription against your report on video before shipping.",
    },
    fluorescence: {
      title: "Fluorescence",
      body: "How the stone reacts to UV light. None to Faint has no visible effect in daylight; stronger fluorescence can add a hazy cast in sunlight.",
      guide: "Choose None–Faint to keep the icy white look under any light.",
    },
    lwRatio: {
      title: "Length-to-width ratio",
      body: "Length divided by width — it sets the silhouette of fancy shapes. 1.00 is perfectly round; higher numbers stretch the outline.",
      guide: "Classic ovals run 1.30–1.50 — below that reads plump, above reads elongated.",
    },
  },
```

**ko** (`const ko = {` 블록):

```js
  stoneEdu: {
    kicker: "다이아몬드 가이드",
    shape: {
      title: "셰이프 (모양)",
      body: "위에서 본 스톤의 윤곽입니다. 라운드 브릴리언트는 반짝임이 가장 크고, 오벌·페어 같은 팬시 셰이프는 무게가 넓게 퍼져 같은 캐럿이라도 더 커 보입니다.",
      guide: "고민된다면 라운드가 클래식 — 더 커 보이는 모던한 선택은 오벌입니다.",
    },
    carat: {
      title: "캐럿 (중량)",
      body: "1캐럿 = 0.2g. 정면 크기는 무게보다 천천히 커집니다 — 2캐럿 라운드는 1캐럿보다 지름이 약 26% 클 뿐입니다.",
      guide: "랩그로운 가격대에선 1.5–2캐럿이 스윗 스팟 — 채굴 다이아에선 희귀한 사이즈입니다.",
    },
    color: {
      title: "컬러 (색 등급)",
      body: "D(완전 무색)에서 Z(웜톤)로 갈수록 따뜻한 기운이 더해집니다. D–F는 무색, G–J는 옆에서 볼 때 미세한 온기가 느껴지는 준무색입니다.",
      guide: "E는 따뜻한 기운이 전혀 없는 아이시 화이트 — 저희 쇼케이스 기준입니다.",
    },
    clarity: {
      title: "클래리티 (투명도)",
      body: "10배 확대경으로 보이는 내포물 기준 등급입니다 — IF(내부 무결점)부터 VVS, VS 순서. VS 등급의 내포물은 육안으로 보이지 않습니다.",
      guide: "VS1은 육안 무결점(eye-clean) — 가격이 뛰기 직전의 가성비 스윗 스팟입니다.",
    },
    growth: {
      title: "성장 방식",
      body: "CVD는 플라즈마 챔버에서 층층이 쌓아 올리고, HPHT는 프레스로 지구 내부의 압력을 재현합니다. 둘 다 경도·광채·화학 성분이 동일한 진짜 다이아몬드입니다.",
      guide: "2캐럿 이상은 공시된 성장 후 컬러 처리를 포함한 CVD를 권장합니다 — 수급이 훨씬 좋습니다.",
    },
    lab: {
      title: "감정 기관",
      body: "독립 감정 기관(랩다이아는 대부분 IGI)이 4C를 검증하고 거들에 리포트 번호를 레이저로 각인합니다.",
      guide: "출고 전 거들 각인과 리포트 번호가 일치하는지 영상으로 확인해 드립니다.",
    },
    fluorescence: {
      title: "형광성",
      body: "자외선에 대한 반응입니다. None–Faint는 일상광에서 아무 영향이 없고, 강한 형광은 햇빛 아래에서 뿌연 느낌을 줄 수 있습니다.",
      guide: "어떤 조명에서도 아이시 화이트를 유지하려면 None–Faint를 고르세요.",
    },
    lwRatio: {
      title: "가로세로 비율 (L/W)",
      body: "길이를 너비로 나눈 값으로, 팬시 셰이프의 실루엣을 결정합니다. 1.00은 완전한 원형이고 숫자가 클수록 길쭉해집니다.",
      guide: "클래식 오벌은 1.30–1.50 — 그보다 작으면 통통하게, 크면 길쭉하게 보입니다.",
    },
  },
```

**zh** (`const zh = {` 블록):

```js
  stoneEdu: {
    kicker: "钻石指南",
    shape: {
      title: "形状",
      body: "从正上方看到的钻石轮廓。圆形明亮式切工火彩最强；椭圆形、梨形等异形钻重量分布更宽，同克拉看起来更大。",
      guide: "经典之选是圆形；想显大又时尚，选椭圆形。",
    },
    carat: {
      title: "克拉（重量）",
      body: "1克拉 = 0.2克。正面尺寸的增长慢于重量——2克拉圆钻的直径只比1克拉大约26%。",
      guide: "以培育钻的价格，1.5–2克拉是甜蜜点——这在天然钻中是稀有尺寸。",
    },
    color: {
      title: "颜色等级",
      body: "从D（完全无色）到Z（暖色调）分级。D–F为无色；G–J为接近无色，侧看略带暖意。",
      guide: "E级呈现冰白色、毫无暖调——这是我们展示库的标准。",
    },
    clarity: {
      title: "净度等级",
      body: "按10倍放大镜下可见的内含物分级——从IF（内部无瑕）到VVS、VS。VS级的内含物肉眼不可见。",
      guide: "VS1肉眼无瑕——是价格跃升前的性价比甜蜜点。",
    },
    growth: {
      title: "生长方式",
      body: "CVD在等离子腔体中逐层生长；HPHT用压机重现地球内部的高压。两者都是真钻石——硬度、火彩、化学成分完全相同。",
      guide: "2克拉以上我们推荐CVD（含披露的生长后处理）——供应充足得多。",
    },
    lab: {
      title: "鉴定机构",
      body: "独立鉴定机构（培育钻大多由IGI鉴定）核实4C，并在腰棱上激光镌刻证书编号。",
      guide: "发货前我们会通过视频核对腰棱镌刻与证书编号一致。",
    },
    fluorescence: {
      title: "荧光",
      body: "钻石对紫外线的反应。None–Faint在日常光线下毫无影响；强荧光在阳光下可能产生雾感。",
      guide: "想在任何光线下保持冰白外观，请选择None–Faint。",
    },
    lwRatio: {
      title: "长宽比",
      body: "长度除以宽度，决定异形钻的轮廓。1.00为正圆，数值越大越修长。",
      guide: "经典椭圆为1.30–1.50——小于则显圆润，大于则显细长。",
    },
  },
```

**es** (`const es = {` 블록):

```js
  stoneEdu: {
    kicker: "Guía del diamante",
    shape: {
      title: "Forma",
      body: "El contorno de la piedra vista desde arriba. El corte brillante redondo ofrece el máximo destello; las formas fantasía como ovalada o pera reparten el peso y se ven más grandes por quilate.",
      guide: "La redonda es el clásico atemporal; la ovalada es la opción moderna que luce más grande.",
    },
    carat: {
      title: "Peso en quilates",
      body: "1 quilate = 0,2 g. El tamaño visible crece más despacio que el peso: un redondo de 2 ct es solo un 26% más ancho que uno de 1 ct.",
      guide: "Con precios de laboratorio, 1,5–2 ct es el punto óptimo: tamaños raros en diamantes de mina.",
    },
    color: {
      title: "Grado de color",
      body: "Se clasifica de D (incoloro perfecto) hacia Z (tono cálido). D–F se ven incoloros; G–J son casi incoloros con un toque cálido visto de lado.",
      guide: "El grado E se ve blanco glacial sin tono cálido: nuestro estándar de vitrina.",
    },
    clarity: {
      title: "Grado de pureza",
      body: "Clasifica las inclusiones visibles con aumento 10×: de IF (internamente impecable) pasando por VVS y VS. Las inclusiones VS son invisibles a simple vista.",
      guide: "VS1 es limpio a la vista: el punto óptimo antes de que el precio se dispare.",
    },
    growth: {
      title: "Método de crecimiento",
      body: "CVD hace crecer el diamante capa a capa en una cámara de plasma; HPHT recrea la presión terrestre en una prensa. Ambos son diamantes reales: idénticos en dureza, fuego y química.",
      guide: "Por encima de 2 ct recomendamos CVD con tratamiento posterior declarado: mucha mejor disponibilidad.",
    },
    lab: {
      title: "Laboratorio certificador",
      body: "Un laboratorio independiente (IGI certifica la mayoría de los diamantes de laboratorio) verifica las 4C y graba con láser el número del informe en el filetín.",
      guide: "Antes del envío verificamos en video que la inscripción coincida con su informe.",
    },
    fluorescence: {
      title: "Fluorescencia",
      body: "La reacción de la piedra a la luz UV. De None a Faint no tiene efecto visible a la luz del día; una fluorescencia fuerte puede dar un aspecto lechoso al sol.",
      guide: "Elija None–Faint para mantener el blanco glacial bajo cualquier luz.",
    },
    lwRatio: {
      title: "Proporción largo-ancho",
      body: "El largo dividido por el ancho define la silueta de las formas fantasía. 1,00 es perfectamente redondo; cifras mayores estilizan el contorno.",
      guide: "Los ovalados clásicos van de 1,30 a 1,50; por debajo se ven rellenos, por encima alargados.",
    },
  },
```

- [ ] **Step 4: 테스트 통과 + 전체 테스트 회귀 확인**

Run: `npx vitest run`
Expected: 전부 PASS (stoneEdu 5 tests 포함, 기존 테스트 회귀 없음)

- [ ] **Step 5: 커밋**

```bash
git add src/opsStrings.js src/lib/__tests__/stoneEdu.test.js
git commit -m "feat(edu): stoneEdu 교육 문구 4개 언어 (8필드 × title/body/guide) + 파리티 테스트"
```

---

### Task 3: StoneEducation.jsx — 패널 + SVG 비주얼 8종

**Files:**
- Create: `src/components/StoneEducation.jsx`

컴포넌트 렌더 테스트 인프라(jsdom/testing-library)가 없으므로 이 태스크는 빌드 통과로 검증한다 (의존성 추가는 YAGNI).

- [ ] **Step 1: 컴포넌트 작성**

`src/components/StoneEducation.jsx` 생성 (전체 내용):

```jsx
// 센터스톤 교육 패널 — 포커스된 필드의 의미를 SVG 일러스트와 함께 설명. 표시 전용(상태 없음).
import { useLocale } from "../i18n.jsx";
import { BENCHMARK_SHAPES } from "../lib/ops.js";
import {
  COLOR_SCALE, COLOR_TINTS, CLARITY_SCALE, CLARITY_DOTS, FLUOR_LEVELS,
  CARAT_REFS, RATIO_EXAMPLES, caratDiameterMm, nearestIndex,
} from "../lib/stoneEdu.js";

/* ---------- 공용 글리프 ---------- */

// 셰이프 외곽선 (viewBox 0 0 40 48). 내부에 55% 축소 사본을 겹쳐 테이블 패싯을 암시.
const SHAPE_NODES = {
  round: <circle cx="20" cy="24" r="16" />,
  oval: <ellipse cx="20" cy="24" rx="13" ry="19" />,
  princess: <rect x="6" y="10" width="28" height="28" />,
  cushion: <rect x="6" y="10" width="28" height="28" rx="8" />,
  emerald: <polygon points="13,6 27,6 32,11 32,37 27,42 13,42 8,37 8,11" />,
  asscher: <polygon points="12,10 28,10 34,16 34,32 28,38 12,38 6,32 6,16" />,
  radiant: <polygon points="10,9 30,9 34,13 34,35 30,39 10,39 6,35 6,13" />,
  pear: <path d="M20 4 C28 14 34 22 34 31 a14 14 0 1 1 -28 0 C6 22 12 14 20 4 Z" />,
  marquise: <path d="M20 4 C30 14 34 19 34 24 C34 29 30 34 20 44 C10 34 6 29 6 24 C6 19 10 14 20 4 Z" />,
};

function ShapeGlyph({ shape, size = 22 }) {
  const node = SHAPE_NODES[shape] || SHAPE_NODES.round;
  return (
    <svg viewBox="0 0 40 48" width={size} height={size * 1.2} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        {node}
        <g transform="translate(20 24) scale(0.55) translate(-20 -24)" opacity="0.5">{node}</g>
      </g>
    </svg>
  );
}

// 측면 브릴리언트 실루엣 — 컬러 틴트/형광 표현용
function DiamondGlyph({ fill, active, size = 26 }) {
  return (
    <svg viewBox="0 0 24 22" width={size} height={size * 0.92} aria-hidden>
      <polygon points="4,1 20,1 23,8 12,21 1,8" fill={fill}
        stroke={active ? "var(--accent)" : "rgba(0,0,0,0.3)"} strokeWidth={active ? 1.4 : 0.7} />
      <polyline points="1,8 23,8" stroke="rgba(0,0,0,0.16)" strokeWidth="0.7" fill="none" />
      <polyline points="8,1 7,8 12,21 17,8 16,1" stroke="rgba(0,0,0,0.1)" strokeWidth="0.7" fill="none" />
    </svg>
  );
}

/* ---------- 필드별 비주얼 ---------- */

function ShapeVisual({ prefs }) {
  const { p } = useLocale();
  const shape = SHAPE_NODES[prefs.shape] ? prefs.shape : "round";
  return (
    <div>
      <div className="edu-shape-hero">
        <ShapeGlyph shape={shape} size={56} />
        <span>{p.shapes[shape] || shape}</span>
      </div>
      <div className="edu-shape-row">
        {BENCHMARK_SHAPES.filter((s) => s !== shape).map((s) => <ShapeGlyph key={s} shape={s} />)}
      </div>
    </div>
  );
}

function CaratVisual({ prefs }) {
  const active = nearestIndex(CARAT_REFS, prefs.carat);
  const px = (ct) => caratDiameterMm(ct) * 4.6; // mm → px (3ct ≈ 43px로 viewBox에 맞춤)
  return (
    <div className="edu-scale-row">
      {CARAT_REFS.map((ct, i) => (
        <div key={ct} className={`edu-scale-item ${i === active ? "is-active" : ""}`}>
          <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden>
            <circle cx="22" cy="22" r={px(ct) / 2} fill="none"
              stroke={i === active ? "var(--accent)" : "var(--line-strong)"} strokeWidth={i === active ? 1.6 : 1} />
          </svg>
          <span>{ct} ct</span>
        </div>
      ))}
    </div>
  );
}

function ColorVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      {COLOR_SCALE.map((g) => (
        <div key={g} className={`edu-scale-item ${g === prefs.color ? "is-active" : ""}`}>
          <DiamondGlyph fill={COLOR_TINTS[g]} active={g === prefs.color} />
          <span>{g}</span>
        </div>
      ))}
    </div>
  );
}

// 돋보기 원 안 내포물 점 — 등급이 내려갈수록 점이 늘어난다 (고정 좌표)
const INCLUSION_POS = [[13, 9], [8, 14], [15, 14], [9, 8], [12, 12]];

function ClarityVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      {CLARITY_SCALE.map((g) => (
        <div key={g} className={`edu-scale-item ${g === prefs.clarity ? "is-active" : ""}`}>
          <svg viewBox="0 0 22 22" width="30" height="30" aria-hidden>
            <circle cx="11" cy="11" r="9.5" fill="none"
              stroke={g === prefs.clarity ? "var(--accent)" : "var(--line-strong)"} strokeWidth="1.1" />
            {INCLUSION_POS.slice(0, CLARITY_DOTS[g]).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="0.9" fill="var(--muted)" />
            ))}
          </svg>
          <span>{g}</span>
        </div>
      ))}
    </div>
  );
}

function GrowthVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      <div className={`edu-scale-item edu-growth ${prefs.growth === "CVD" ? "is-active" : ""}`}>
        <svg viewBox="0 0 52 40" width="74" height="57" aria-hidden>
          {[10, 22, 34, 44].map((x, i) => <circle key={x} cx={x} cy={6 + (i % 2) * 3} r="1.2" fill="var(--quiet)" />)}
          {[27, 22, 17, 12].map((y, i) => (
            <rect key={y} x={14 + i * 1.5} y={y} width={24 - i * 3} height="3.4"
              fill="none" stroke="currentColor" strokeWidth="1" opacity={1 - i * 0.18} />
          ))}
          <rect x="12" y="32" width="28" height="3" fill="var(--quiet)" opacity="0.5" />
        </svg>
        <span>CVD</span>
      </div>
      <div className={`edu-scale-item edu-growth ${prefs.growth === "HPHT" ? "is-active" : ""}`}>
        <svg viewBox="0 0 52 40" width="74" height="57" aria-hidden>
          <polygon points="26,12 34,20 26,28 18,20" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M26 2 v6 M26 38 v-6 M6 20 h6 M46 20 h-6" stroke="var(--quiet)" strokeWidth="1.3" fill="none" />
          <path d="M23.6 6 L26 9.4 L28.4 6 M23.6 34 L26 30.6 L28.4 34 M9 17.6 L12.4 20 L9 22.4 M43 17.6 L39.6 20 L43 22.4"
            fill="none" stroke="var(--quiet)" strokeWidth="1.1" />
        </svg>
        <span>HPHT</span>
      </div>
    </div>
  );
}

function LabVisual() {
  return (
    <svg viewBox="0 0 120 44" width="100%" height="56" aria-hidden>
      <rect x="4" y="5" width="50" height="34" fill="none" stroke="var(--line-strong)" strokeWidth="1.1" />
      {[12, 18, 24].map((y) => <line key={y} x1="10" y1={y} x2="40" y2={y} stroke="var(--quiet)" strokeWidth="1.1" />)}
      <circle cx="44" cy="31" r="5" fill="none" stroke="var(--accent)" strokeWidth="1.1" />
      <polygon points="78,8 102,8 108,17 90,38 72,17" fill="none" stroke="var(--line-strong)" strokeWidth="1.1" />
      <line x1="72" y1="17" x2="108" y2="17" stroke="var(--accent)" strokeWidth="1.3" />
      <text x="90" y="14.8" textAnchor="middle" fontSize="4.6" fill="var(--accent)" fontFamily="monospace">IGI LG1234567</text>
    </svg>
  );
}

const GLOW = { none: 0, faint: 0.22, medium: 0.45 };

function FluorVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      {FLUOR_LEVELS.map((lv) => (
        <div key={lv} className={`edu-scale-item ${lv === prefs.fluorescence ? "is-active" : ""}`}>
          <svg viewBox="0 0 36 34" width="44" height="42" aria-hidden>
            {GLOW[lv] > 0 && <ellipse cx="18" cy="16" rx="15" ry="13" fill="#7da7ff" opacity={GLOW[lv]} />}
            <polygon points="10,6 26,6 30,13 18,29 6,13" fill={GLOW[lv] ? "#e7efff" : "#f5f7fb"}
              stroke={lv === prefs.fluorescence ? "var(--accent)" : "rgba(0,0,0,0.3)"}
              strokeWidth={lv === prefs.fluorescence ? 1.4 : 0.7} />
          </svg>
          <span style={{ textTransform: "capitalize" }}>{lv}</span>
        </div>
      ))}
    </div>
  );
}

function RatioVisual({ prefs }) {
  const active = nearestIndex(RATIO_EXAMPLES, prefs.lwRatio);
  return (
    <div className="edu-scale-row">
      {RATIO_EXAMPLES.map((r, i) => (
        <div key={r} className={`edu-scale-item ${i === active ? "is-active" : ""}`}>
          <svg viewBox="0 0 40 56" width="40" height="56" aria-hidden>
            <ellipse cx="20" cy="28" rx="13" ry={13 * r} fill="none"
              stroke={i === active ? "var(--accent)" : "var(--line-strong)"} strokeWidth={i === active ? 1.6 : 1} />
          </svg>
          <span>{r.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 패널 본체 ---------- */

const VISUALS = {
  shape: ShapeVisual, carat: CaratVisual, color: ColorVisual, clarity: ClarityVisual,
  growth: GrowthVisual, lab: LabVisual, fluorescence: FluorVisual, lwRatio: RatioVisual,
};

export default function StoneEduPanel({ field, prefs }) {
  const { p } = useLocale();
  const key = p.stoneEdu[field] && VISUALS[field] ? field : "shape";
  const edu = p.stoneEdu[key];
  const Visual = VISUALS[key];
  return (
    <div className="stone-edu-panel panel">
      <div className="stone-edu-kicker">{p.stoneEdu.kicker}</div>
      <h4>{edu.title}</h4>
      <div className="stone-edu-visual"><Visual prefs={prefs} /></div>
      <p className="stone-edu-body">{edu.body}</p>
      <p className="stone-edu-guide">{edu.guide}</p>
    </div>
  );
}
```

- [ ] **Step 2: 빌드로 문법/import 검증**

Run: `npm run build`
Expected: 빌드 성공 (경고 없이). 실패 시 에러 메시지의 파일·라인 수정.

- [ ] **Step 3: 커밋**

```bash
git add src/components/StoneEducation.jsx
git commit -m "feat(edu): StoneEduPanel — 필드별 SVG 비주얼 8종 (스케일·다이어그램·하이라이트)"
```

---

### Task 4: IntakeForm 통합 + CSS

**Files:**
- Modify: `src/pages/IntakeForm.jsx`
- Modify: `src/platform.css` (파일 끝에 추가)

- [ ] **Step 1: IntakeForm — import + 상태**

`src/pages/IntakeForm.jsx` 상단 import에 추가 (L9 `PinAnnotator` import 아래):

```jsx
import StoneEduPanel from "../components/StoneEducation.jsx";
```

`const [annotIdx, setAnnotIdx] = useState(0);` (L36) 아래에 추가:

```jsx
const [eduField, setEduField] = useState("shape"); // 교육 패널이 따라가는 포커스 필드
```

- [ ] **Step 2: IntakeForm — 레이아웃 래퍼 + aside**

페이지 래퍼(L76)를 솔리테어일 때 넓힌다. `solitaire`는 L72에서 return 위로 끌어올려야 하므로, L71-73의 파생값 선언이 이미 return 앞에 있음을 확인하고 그대로 사용:

```jsx
// 변경 전 (L76)
<div className="page page-narrow" style={{ maxWidth: 680 }}>
// 변경 후
<div className="page page-narrow" style={{ maxWidth: solitaire ? 1020 : 680 }}>
```

`<form className="panel form-stack" onSubmit={submit}>` (L80)을 flex 래퍼로 감싸고, form 닫는 태그(L193 `</form>`) 뒤에 aside 추가:

```jsx
<div className={`intake-layout ${solitaire ? "has-edu" : ""}`}>
  <form className="panel form-stack" onSubmit={submit}>
    {/* ...기존 내용 그대로... */}
  </form>
  {solitaire && (
    <aside className="stone-edu-aside">
      <StoneEduPanel field={eduField} prefs={form.stonePrefs} />
    </aside>
  )}
</div>
```

- [ ] **Step 3: IntakeForm — 센터스톤 필드 8개에 onFocus + 모바일 인라인**

센터스톤 섹션(L131-147)의 각 입력에 onFocus 추가:

```jsx
<div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
  <label className="field"><span>{t.shape}</span>
    <select value={form.stonePrefs.shape} onFocus={() => setEduField("shape")} onChange={(e) => setS({ shape: e.target.value })}>
      {BENCHMARK_SHAPES.map((sh) => <option key={sh} value={sh}>{p.shapes[sh] || sh}</option>)}
    </select></label>
  <label className="field"><span>{t.carat}</span>
    <input type="number" step="0.1" value={form.stonePrefs.carat} onFocus={() => setEduField("carat")} onChange={(e) => setS({ carat: e.target.value })} /></label>
  <label className="field"><span>{t.color}</span>
    <select value={form.stonePrefs.color} onFocus={() => setEduField("color")} onChange={(e) => setS({ color: e.target.value })}>{["D", "E", "F", "G"].map((c) => <option key={c}>{c}</option>)}</select></label>
  <label className="field"><span>{t.clarity}</span>
    <select value={form.stonePrefs.clarity} onFocus={() => setEduField("clarity")} onChange={(e) => setS({ clarity: e.target.value })}>{["IF", "VVS1", "VVS2", "VS1", "VS2"].map((c) => <option key={c}>{c}</option>)}</select></label>
  <label className="field"><span>{t.growth}</span>
    <select value={form.stonePrefs.growth} onFocus={() => setEduField("growth")} onChange={(e) => setS({ growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
  <label className="field"><span>{t.lab}</span>
    <input value={form.stonePrefs.lab} onFocus={() => setEduField("lab")} onChange={(e) => setS({ lab: e.target.value })} /></label>
  <label className="field"><span>{t.fluorescence}</span>
    <select value={form.stonePrefs.fluorescence} onFocus={() => setEduField("fluorescence")} onChange={(e) => setS({ fluorescence: e.target.value })}><option value="none">None</option><option value="faint">Faint</option><option value="medium">Medium</option></select></label>
  <label className="field"><span>{t.lwRatio}</span>
    <input value={form.stonePrefs.lwRatio} onFocus={() => setEduField("lwRatio")} onChange={(e) => setS({ lwRatio: e.target.value })} placeholder="1.0" /></label>
</div>
{bigStone && <p className="warn-note">{t.bigStoneNote}</p>}
<div className="stone-edu-inline">
  <StoneEduPanel field={eduField} prefs={form.stonePrefs} />
</div>
```

(변경점: 각 입력에 `onFocus` 8개 + `{bigStone && …}` 아래 `.stone-edu-inline` 블록. 나머지는 기존 그대로.)

- [ ] **Step 4: platform.css — 스타일 추가**

`src/platform.css` 파일 끝에 추가:

```css
/* 센터스톤 교육 패널 (인테이크) */
.intake-layout.has-edu { display: flex; gap: 24px; align-items: flex-start; }
.intake-layout.has-edu > form { flex: 1 1 auto; min-width: 0; }
.stone-edu-aside { flex: 0 0 300px; position: sticky; top: 96px; }
.stone-edu-panel h4 { margin: 4px 0 12px; font-size: 15px; }
.stone-edu-kicker { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
.stone-edu-visual { margin: 2px 0 12px; color: var(--silver); }
.stone-edu-body { color: var(--muted); font-size: 12.5px; line-height: 1.65; margin: 0 0 8px; }
.stone-edu-guide { color: var(--accent-bright); font-size: 12.5px; line-height: 1.6; margin: 0; }
.edu-scale-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end; }
.edu-scale-item { display: grid; justify-items: center; gap: 2px; font-size: 10px; color: var(--quiet); padding: 4px 3px; border: 1px solid transparent; }
.edu-scale-item.is-active { color: var(--accent-bright); border-color: var(--line); background: var(--surface-2); }
.edu-shape-hero { display: grid; justify-items: center; gap: 4px; font-size: 12px; color: var(--muted); margin-bottom: 8px; }
.edu-shape-row { display: flex; gap: 6px; flex-wrap: wrap; color: var(--quiet); }
.stone-edu-inline { display: none; }

@media (max-width: 1120px) {
  .intake-layout.has-edu { display: block; }
  .stone-edu-aside { display: none; }
  .stone-edu-inline { display: block; }
}
```

- [ ] **Step 5: 빌드 + 전체 테스트**

Run: `npm run build && npx vitest run`
Expected: 빌드 성공, 테스트 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/pages/IntakeForm.jsx src/platform.css
git commit -m "feat(edu): 인테이크 폼에 교육 패널 통합 — 포커스 연동 aside + 모바일 인라인"
```

---

### Task 5: 브라우저 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: dev 서버 + 스모크 확인**

Run: `npm run dev` (백그라운드)
Playwright(MCP)로 `http://localhost:5173/custom/new` 접속 후 확인:
1. Product line이 solitaire(기본값) → 우측에 "Diamond guide / Shape" 패널 표시
2. Color select 포커스 → 패널이 컬러 스케일로 전환, E에 하이라이트
3. Color를 F로 변경 → 하이라이트가 F로 이동
4. Carat에 2.5 입력 → 패널 캐럿 원 중 3 ct가 아닌 2 ct... (2.5는 2와 3의 중간이므로 둘 중 가까운 쪽인 2 또는 3 — `nearestIndex` 규칙상 2가 우선) 하이라이트 확인 + bigStoneNote 표시 유지
5. 뷰포트 760px로 줄이기 → aside 사라지고 그리드 아래 인라인 박스 표시
6. 언어를 KO로 전환 → 패널 문구가 한국어로 전환
7. Product line을 multi로 변경 → 패널 사라지고 페이지 폭 원복
8. 폼 제출이 기존과 동일하게 동작 (Order ID 발급 화면)

- [ ] **Step 2: 스크린샷을 사용자에게 공유, 콘솔 에러 0 확인**

---

## Self-Review 결과

- **스펙 커버리지**: 레이아웃/포커스 연동(Task 4), 8종 비주얼(Task 3), 4개 언어 문구(Task 2), 테스트 2종(Task 1·2), 모바일 인라인(Task 4 CSS), sticky(Task 4 CSS), 제출 payload 불변(Task 4 — stonePrefs 구조 변경 없음) — 전부 매핑됨.
- **플레이스홀더**: 없음 (전체 코드·문구 포함).
- **타입 일관성**: `EDU_FIELDS` 키 = opsStrings `stoneEdu` 키 = `VISUALS` 키 = IntakeForm `setEduField()` 인자 — 8개 동일 문자열 확인. `FLUOR_LEVELS` 소문자 = select value 소문자 일치.
