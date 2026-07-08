# 런칭 세일 배너 + LAUNCH25 쿠폰 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LAUNCH25(25%) 쿠폰을 발급하고, 브릴리언스식 상단 할인 배너를 전 페이지에 노출하며, 어드민 쿠폰 페이지에서 배너 온/오프·문구(4개 언어)·코드를 관리할 수 있게 한다.

**Architecture:** 쿠폰은 기존 `settings.coupons` 카탈로그에 시드+1회 마이그레이션으로 주입. 배너는 `settings.saleBanner` 신설 — 순수 리졸버(`saleBanner.js`)가 로케일 폴백을 결정하고, `SaleBanner` 컴포넌트가 고정 헤더 위에 렌더하며 실측 높이를 CSS 변수로 내려 헤더/본문을 밀어낸다. 어드민 편집은 기존 `pushSettingsToServer` write-through 채널.

**Tech Stack:** React 18 + Vite, Vitest, Express/Postgres(`app_settings`), ResizeObserver.

**Spec:** `docs/superpowers/specs/2026-07-07-launch-sale-banner-coupon-design.md`

## Global Constraints

- 쿠폰 코드는 정확히 `LAUNCH25`, `kind: "percent"`, `value: 25`, `labelKey: "launch"`, `expiresAt: null`.
- 배너 문구는 EN/KO/ZH/ES 4개 언어, 빈 로케일은 EN 폴백, EN도 비면(또는 disabled) 배너 숨김.
- 배너는 `/bo-`·`/gate-`·`/admin` 경로에서 숨김 (ChatWidget과 동일 규칙).
- 문구는 텍스트 노드로만 렌더 (HTML 삽입 금지).
- 시드 기본: `enabled: true` (런칭 세일 즉시 노출).
- 테스트 러너: `npx vitest run <파일>`.

---

### Task 1: LAUNCH25 쿠폰 — 시드 + 1회 마이그레이션 (TDD)

**Files:**
- Modify: `src/lib/coupons.js:5-9` (BASE_COUPONS)
- Modify: `src/lib/store.js:160-224` (migrateDB), `src/lib/seed.js:258-262` (saleBanner 시드 — Task 2와 공유)
- Test: `src/lib/__tests__/coupons.test.js`

**Interfaces:**
- Produces: `findCoupon("LAUNCH25")` → percent 25 쿠폰; `applyCoupon` 25% 할인; 기존 브라우저 스토어에도 `launchSaleSeedVersion` 플래그로 1회 주입

- [ ] **Step 1: 실패하는 테스트 추가** — `src/lib/__tests__/coupons.test.js`에:

```js
describe("LAUNCH25 런칭 쿠폰", () => {
  it("시드에 25% percent로 존재한다", () => {
    resetDB();
    const coupon = findCoupon("launch25");
    expect(coupon).toMatchObject({ code: "LAUNCH25", kind: "percent", value: 25 });
  });
  it("applyCoupon이 총액 25%를 깎는다", () => {
    const out = applyCoupon({ totalUsd: 4000, diamondAmountUsd: 2000, multiplier: 1.8 }, { kind: "percent", value: 25 });
    expect(out.totalUsd).toBe(3000);
    expect(out.discountUsd).toBe(1000);
  });
});
```

(파일 상단 import에 `findCoupon`, `resetDB`가 없으면 `../store.js`에서 추가)

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/coupons.test.js` / Expected: 첫 테스트 FAIL
- [ ] **Step 3: 구현** — `src/lib/coupons.js` `BASE_COUPONS`에 추가:

```js
  { code: "LAUNCH25", kind: "percent", value: 25, labelKey: "launch", expiresAt: null },
```

`src/lib/store.js` `migrateDB`에 (멜리 단가 블록 뒤):

```js
  // 런칭 세일(2026-07) — LAUNCH25 쿠폰 + 상단 세일 배너를 기존 브라우저에 1회 주입.
  // 어드민이 이후 삭제/수정해도 재주입하지 않도록 버전 플래그로만 판단한다.
  if (d?.settings && d.settings.launchSaleSeedVersion !== 1) {
    if (Array.isArray(d.settings.coupons) && !d.settings.coupons.some((c) => c.code === "LAUNCH25")) {
      d.settings.coupons = [...d.settings.coupons, { code: "LAUNCH25", kind: "percent", value: 25, labelKey: "launch", expiresAt: null }];
    }
    if (!d.settings.saleBanner) d.settings.saleBanner = seed().settings.saleBanner;
    d.settings.launchSaleSeedVersion = 1;
    changed = true;
  }
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/coupons.test.js` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A src/lib && git commit -m "feat: LAUNCH25 런칭 쿠폰 (시드 + 1회 마이그레이션)"`

---

### Task 2: saleBanner 설정 시드 + 리졸버 (TDD)

**Files:**
- Create: `src/lib/saleBanner.js`
- Modify: `src/lib/seed.js:258-262` (settings), `server/settingsRepository.js:6-17`
- Test: `src/lib/__tests__/saleBanner.test.js`

**Interfaces:**
- Produces: `settings.saleBanner = { enabled, code, copy: {en,ko,zh,es} }`; `resolveSaleBanner(saleBanner, locale) → { text, code } | null`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/__tests__/saleBanner.test.js`

```js
import { describe, expect, it } from "vitest";
import { resolveSaleBanner } from "../saleBanner.js";

const banner = { enabled: true, code: "LAUNCH25", copy: { en: "Launch Sale", ko: "런칭 세일", zh: "", es: "" } };

describe("resolveSaleBanner", () => {
  it("현재 로케일 문구를 쓴다", () => {
    expect(resolveSaleBanner(banner, "ko")).toEqual({ text: "런칭 세일", code: "LAUNCH25" });
  });
  it("빈 로케일은 EN 폴백", () => {
    expect(resolveSaleBanner(banner, "zh")).toEqual({ text: "Launch Sale", code: "LAUNCH25" });
  });
  it("disabled·EN까지 비면·설정 없음 → null", () => {
    expect(resolveSaleBanner({ ...banner, enabled: false }, "en")).toBeNull();
    expect(resolveSaleBanner({ enabled: true, code: "X", copy: { en: " " } }, "en")).toBeNull();
    expect(resolveSaleBanner(undefined, "en")).toBeNull();
  });
  it("코드가 비면 code는 빈 문자열", () => {
    expect(resolveSaleBanner({ ...banner, code: "" }, "en")).toEqual({ text: "Launch Sale", code: "" });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/__tests__/saleBanner.test.js` / Expected: FAIL
- [ ] **Step 3: 구현** — `src/lib/saleBanner.js`

```js
// 세일 배너 문구 결정 — 현재 로케일 → EN 폴백 → 없으면 null(배너 숨김). 순수 로직.
export function resolveSaleBanner(saleBanner, locale) {
  if (!saleBanner?.enabled) return null;
  const text = (saleBanner.copy?.[locale] || saleBanner.copy?.en || "").trim();
  if (!text) return null;
  return { text, code: (saleBanner.code || "").trim() };
}
```

`src/lib/seed.js` settings에 추가 (meleeUsdPerCt 라인 근처):

```js
      // 상단 세일 배너 — 어드민 쿠폰 페이지에서 온/오프·문구 관리, 서버 write-through로 전 고객 배포
      saleBanner: {
        enabled: true,
        code: "LAUNCH25",
        copy: {
          en: "Launch Sale: 25% Off All Lab Diamond Jewelry",
          ko: "런칭 세일: 랩다이아 주얼리 전 품목 25% 할인",
          zh: "开业特惠：培育钻石珠宝全场七五折",
          es: "Oferta de lanzamiento: 25% en toda la joyería de diamantes de laboratorio",
        },
      },
      launchSaleSeedVersion: 1,
```

`server/settingsRepository.js` `PUBLIC_SETTINGS_KEYS`에 추가:

```js
  "saleBanner", // 상단 세일 배너 — 전 방문자 부팅 경로가 소비
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/__tests__/saleBanner.test.js` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A src server && git commit -m "feat: saleBanner 설정 시드 + 로케일 리졸버 + 서버 공개 키"`

---

### Task 3: SaleBanner 컴포넌트 + 레이아웃/CSS

**Files:**
- Create: `src/components/SaleBanner.jsx`
- Modify: `src/Layout.jsx:344-357` (Header 위에 렌더), `src/styles.css:168-189` (.site-header top 변수화 + 배너 CSS + main 오프셋)

**Interfaces:**
- Consumes: Task 2의 `resolveSaleBanner`, store의 `getSettings`, `useDBVersion`, `useLocale`
- Produces: 전 공개 페이지 상단 고정 배너; `--sale-banner-h` CSS 변수(root)로 헤더/본문 오프셋

- [ ] **Step 1: 컴포넌트 작성** — `src/components/SaleBanner.jsx`

```jsx
// 상단 세일 배너 — 브릴리언스식 풀폭 다크 바. settings.saleBanner(서버 write-through)로 전 고객 제어.
// 고정 헤더 위에 앉으므로 실측 높이를 --sale-banner-h로 내려 헤더(top)와 본문(margin-top)을 민다.
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLocale } from "../i18n.jsx";
import { getSettings } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { resolveSaleBanner } from "../lib/saleBanner.js";

// 어드민·게이트 경로에서는 숨김 (ChatWidget과 동일 규칙)
const BLOCKED = (path) => path.startsWith("/bo-") || path.startsWith("/gate-") || path.startsWith("/admin");

export default function SaleBanner() {
  useDBVersion();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const banner = BLOCKED(pathname) ? null : resolveSaleBanner(getSettings().saleBanner, locale);
  const ref = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el) {
      root.style.setProperty("--sale-banner-h", "0px");
      return undefined;
    }
    const apply = () => root.style.setProperty("--sale-banner-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply); // 모바일 두 줄 래핑도 실측이라 어긋나지 않는다
    ro.observe(el);
    return () => { ro.disconnect(); root.style.setProperty("--sale-banner-h", "0px"); };
  }, [banner?.text, banner?.code]);

  if (!banner) return null;
  return (
    <Link ref={ref} className="sale-banner" to="/designs">
      <span>{banner.text}</span>
      {banner.code && <span className="sale-banner-code">Code: {banner.code}</span>}
    </Link>
  );
}
```

- [ ] **Step 2: Layout에 장착** — `src/Layout.jsx`: `import SaleBanner from "./components/SaleBanner.jsx";` 추가, `<Header />` 바로 위에 `<SaleBanner />`.

- [ ] **Step 3: CSS** — `src/styles.css`의 `.site-header` 규칙에서 `top: 0;` → `top: var(--sale-banner-h, 0px);` 로 교체하고, `.site-header` 블록 위에 추가:

```css
/* 세일 배너 — 헤더 위 풀폭 다크 바 (NOIR/데이 양 테마 공통 고정 다크) */
.sale-banner {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 21;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 9px clamp(16px, 4vw, 56px);
  background: #0a0b0d;
  color: #f5f7fb;
  font-size: 13px;
  letter-spacing: 0.02em;
  text-align: center;
  text-decoration: none;
}
.sale-banner:hover { color: #ffffff; }
.sale-banner-code {
  text-decoration: underline;
  text-underline-offset: 3px;
  font-weight: 600;
  white-space: nowrap;
}
main { margin-top: var(--sale-banner-h, 0px); }
```

- [ ] **Step 4: 빌드 + 전체 테스트** — Run: `npx vitest run && npx vite build 2>&1 | tail -3` / Expected: PASS·빌드 성공
- [ ] **Step 5: Commit** — `git add -A src && git commit -m "feat: 상단 세일 배너 — 실측 높이 오프셋 + 어드민 경로 숨김"`

---

### Task 4: 어드민 쿠폰 페이지 — 세일 배너 관리 섹션 + 쿠폰 라벨

**Files:**
- Modify: `src/pages/admin/AdminCoupons.jsx` (상단 섹션 + COPY 4개 언어)
- Modify: `src/opsStrings.js` — 4개 로케일 `intake.gflow.couponNames`에 `launch` 키

**Interfaces:**
- Consumes: store `getSettings`/`updateSettings`, `pushSettingsToServer`, `normalizeCouponCode`
- Produces: 어드민 저장 → `settings.saleBanner` 갱신 + 서버 write-through

- [ ] **Step 1: couponNames.launch 4개 언어** — `src/opsStrings.js` 각 로케일 `couponNames`에:

- EN: `launch: "Launch discount (25%)"`
- KO: `launch: "런칭 기념 할인 (25%)"`
- ZH: `launch: "开业优惠 (25%)"`
- ES: `launch: "Descuento de lanzamiento (25%)"`

- [ ] **Step 2: AdminCoupons 섹션** — `src/pages/admin/AdminCoupons.jsx`:

(a) import 갱신:

```js
import { addCoupon, getSettings, listCoupons, removeCoupon, updateSettings } from "../../lib/store.js";
import { normalizeCouponCode } from "../../lib/coupons.js";
```

(b) `COPY` 각 로케일에 키 추가:

- EN: `bannerTitle: "Sale banner", bannerSub: "Sitewide bar above the header. Copy per language — empty falls back to EN.", bannerOn: "Show banner", bannerCode: "Code shown", bannerSave: "Save banner", bannerSaved: "Banner saved", bannerCodeWarn: "Not in the coupon catalog below — customers can't redeem it.",`
- KO: `bannerTitle: "세일 배너", bannerSub: "헤더 위 전 페이지 배너입니다. 언어별 문구 — 비우면 영어로 폴백됩니다.", bannerOn: "배너 표시", bannerCode: "표시 코드", bannerSave: "배너 저장", bannerSaved: "배너 저장됨", bannerCodeWarn: "아래 쿠폰 카탈로그에 없는 코드예요 — 고객이 적용받을 수 없습니다.",`
- ZH: `bannerTitle: "促销横幅", bannerSub: "页头上方全站横幅。按语言填写文案——留空则回退到英文。", bannerOn: "显示横幅", bannerCode: "展示代码", bannerSave: "保存横幅", bannerSaved: "已保存", bannerCodeWarn: "下方优惠码目录中没有该代码——客户无法使用。",`
- ES: `bannerTitle: "Banner de oferta", bannerSub: "Barra en todo el sitio sobre la cabecera. Texto por idioma — vacío usa el inglés.", bannerOn: "Mostrar banner", bannerCode: "Código mostrado", bannerSave: "Guardar banner", bannerSaved: "Banner guardado", bannerCodeWarn: "No está en el catálogo de cupones — los clientes no podrán canjearlo.",`

(c) 컴포넌트 상태/핸들러 (기존 useState들 아래):

```js
  const LOCALES = ["en", "ko", "zh", "es"];
  const [bannerDraft, setBannerDraft] = useState(() => {
    const saved = getSettings().saleBanner || {};
    return {
      enabled: Boolean(saved.enabled),
      code: saved.code || "",
      copy: { en: "", ko: "", zh: "", es: "", ...saved.copy },
    };
  });
  const bannerCodeUnknown = Boolean(normalizeCouponCode(bannerDraft.code))
    && !coupons.some((cp) => cp.code === normalizeCouponCode(bannerDraft.code));

  function saveBanner() {
    const next = { ...bannerDraft, code: normalizeCouponCode(bannerDraft.code) };
    updateSettings({ saleBanner: next });
    pushSettingsToServer({ saleBanner: next });
    setNotice(c.bannerSaved);
  }
```

(d) `<ConsoleHead …>` 바로 아래(쿠폰 등록 폼 위)에 렌더:

```jsx
      <section className="con-table-panel con-narrow" style={{ padding: 18, display: "grid", gap: 12 }}>
        <div className="con-adjust" style={{ margin: 0 }}>
          <span className="con-adjust-label">{c.bannerTitle}</span>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox" checked={bannerDraft.enabled} style={{ width: "auto" }}
              onChange={(e) => setBannerDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span>{c.bannerOn}</span>
          </label>
          <label className="field"><span>{c.bannerCode}</span>
            <input
              value={bannerDraft.code} maxLength={20} placeholder="LAUNCH25"
              onChange={(e) => setBannerDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
            />
          </label>
          <button className="button primary small" type="button" onClick={saveBanner}>{c.bannerSave}</button>
        </div>
        {bannerCodeUnknown && <p className="form-error" style={{ margin: 0 }}>{c.bannerCodeWarn}</p>}
        <p className="con-note" style={{ margin: 0 }}>{c.bannerSub}</p>
        {LOCALES.map((code) => (
          <label key={code} className="field"><span>{code.toUpperCase()}</span>
            <input
              value={bannerDraft.copy[code]}
              onChange={(e) => setBannerDraft((d) => ({ ...d, copy: { ...d.copy, [code]: e.target.value } }))}
            />
          </label>
        ))}
      </section>
```

- [ ] **Step 3: 빌드 + 전체 테스트** — Run: `npx vitest run && npx vite build 2>&1 | tail -3` / Expected: PASS·성공
- [ ] **Step 4: Commit** — `git add -A src && git commit -m "feat: 어드민 쿠폰 페이지 — 세일 배너 온/오프·문구(4개 언어)·코드 관리 섹션"`

---

### Task 5: 브라우저 검증 (verify 스킬)

- [ ] **Step 1:** 홈 접속 — 상단 다크 배너에 KO 로케일 문구 + `Code: LAUNCH25` 표시, 헤더/히어로가 배너 높이만큼 내려앉는지(겹침 없음), 클릭 시 `/designs` 이동
- [ ] **Step 2:** 언어 EN/ZH/ES 전환 — 문구 폴백 동작 확인
- [ ] **Step 3:** 인테이크 리뷰에서 쿠폰 `LAUNCH25` 입력 → 견적 25% 할인 + "런칭 기념 할인 (25%)" 라벨 확인
- [ ] **Step 4:** 어드민 콘솔 쿠폰 페이지 — 배너 토글 OFF 저장 → 공개 페이지에서 배너 사라짐(+ 헤더 top 0 복귀) → 다시 ON
- [ ] **Step 5:** 스크린샷 확보 — 이상 발견 시 systematic-debugging으로 수정 후 재검증
