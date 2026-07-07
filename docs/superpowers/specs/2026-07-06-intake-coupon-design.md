# 인테이크 쿠폰 코드 지원

날짜: 2026-07-06 / 상태: **확정** (사용자 설계 위임 — "알아서 구현해줘" + 코드 3종 지시)
배경: 쿠폰 입력 시 할인해 주는 입력 박스. RFQ 흐름이라 결제 시점이 없으므로, 쿠폰은 "견적 약속"으로 캡처하고 예상 견적에 즉시 반영해 보여준다. 최종 적용은 오퍼레이터가 확정 제안(견적)에서 검증한다.

## 0. 확정된 결정

| 결정 | 선택 |
|---|---|
| 입력 위치 | review 스텝, QuoteCompare(예상 견적) 바로 위 "쿠폰 코드" 섹션 — 할인 효과가 견적에 즉시 보이는 자리 |
| 할인 모델 | `margin0`: 다이아 멀티플라이어 1.8→1.0 (마진 0%, 원가) / `percent`: 총액 % 할인 |
| 코드 3종 | `BD-ATCOST` 운영자(margin0) · `BD-PRIVATE` 프라이빗 파티(15%) · `WELCOME5` 기본(5%) |
| 검증 | 클라이언트 카탈로그 조회(즉시 피드백). 미등록 코드도 페이로드에 캡처(오프라인 캠페인 대비), UI에는 "유효하지 않음" 표시 |
| 보안 | 코드가 번들/공개 설정에 노출됨 — RFQ 특성상 허용. 운영자 코드 남용은 오퍼레이터가 제안 단계에서 거절 |
| 카탈로그 저장소 (2차 확장) | 정적 상수 → `settings.coupons`로 승격. 어드민 콘솔에서 등록/삭제/만료 관리, `pushSettingsToServer` write-through → Postgres → `/v1/settings/public` 하이드레이션으로 전 고객 배포 |
| 범위 제외 | 사용횟수 제한·코드 수정(삭제 후 재등록으로 갈음)·전용 서버 검증 API |

## 1. 쿠폰 카탈로그 — `src/lib/coupons.js` (신규, 순수 로직)

```js
export const COUPONS = [
  { code: "BD-ATCOST", kind: "margin0", labelKey: "staff" },
  { code: "BD-PRIVATE", kind: "percent", value: 15, labelKey: "private" },
  { code: "WELCOME5", kind: "percent", value: 5, labelKey: "welcome" },
];
```

- `normalizeCouponCode(raw)`: trim → 대문자 → 내부 공백 제거.
- `findCoupon(raw)`: 정규화 후 카탈로그 조회, 없으면 null.
- `applyCoupon({ totalUsd, diamondAmountUsd, multiplier }, coupon)` → `{ totalUsd, discountUsd }`:
  - `margin0`: `total − diamondAmount + round(diamondAmount / multiplier)` (다이아를 원가로 환원)
  - `percent`: `round(total × (1 − value/100))`
  - null 쿠폰: 원본 그대로, discountUsd 0.

## 2. 예상 견적 — `src/lib/quoteEstimate.js`

- `estimateQuoteRange(form)`이 `form.couponCode`를 읽어 `findCoupon` → `quoteCompute` 결과의 `totalUsd`에 `applyCoupon` 적용 후 low/high 스프레드.
- 반환에 `coupon: { code, labelKey, savedUsd } | null` 추가 (`savedUsd`는 스프레드 전 총액 기준 절감액, round10).
- 경쟁사 범위는 미할인 기준 유지(경쟁사에 내 쿠폰은 없음) — 절감폭이 자연히 커진다.

## 3. UI

- **IntakeForm review**: QuoteCompare 바로 위에 `gflow-review-section` 섹션 "쿠폰 코드". 텍스트 입력(`form.couponCode`, 대문자 정규화된 값 저장) + 상태 힌트:
  - 유효: `✓ <쿠폰 이름> — 아래 견적에 반영됐어요` (couponNames[labelKey])
  - 무효(비어있지 않음): `유효하지 않은 코드예요 — 확정 제안 때 다시 확인해 드려요`
  - 비어있음: 안내 힌트.
- **QuoteCompare**: `est.coupon` 있으면 qc-head에 `쿠폰 <CODE> 적용 · −$X` 한 줄.

## 4. 데이터 흐름

- `baseForm`에 `couponCode: ""` — 드래프트·spread 전파는 각인과 동일.
- `buildIntakePayload`: `couponCode: normalizeCouponCode(form.couponCode)` 정규화(무효 코드도 캡처).
- **어드민** `AdminLiveOrders` intakeRows: `["Coupon", (fp.couponCode || "").trim()]`.
- **포털** `ClientPortal` buildOrderBriefRows: 쿠폰 행(값 있을 때만), 라벨 `gflow.couponTitle`.

## 5. 로컬 데모 견적 반영 — `store.js createQuote`

- `createQuote`가 주문의 인테이크 `couponCode`를 조회해 `findCoupon` → computed 총액에 `applyCoupon`, `depositUsd`/`balanceUsd` 재계산, `quote.coupon = { code, discountUsd }` 기록.
- 서버 실견적은 무변경 — 오퍼레이터가 어드민의 Coupon 행을 보고 수동 반영.

## 6. i18n — `opsStrings.js` (4개 언어)

- `intake.gflow`: `couponTitle`, `couponPh`, `couponHint`, `couponInvalid`, `couponApplied`(이름 받는 함수 or 문자열 조합), `couponNames: { staff, private, welcome }`.
- `intake.estimate`: `couponLine(code, amount)` 함수형 키.

## 7. 어드민 쿠폰 관리 (2차 확장 — 같은 날 사용자 추가 요구)

- **저장소**: `settings.coupons` 배열 `{ code, kind: "margin0"|"percent", value?, labelKey?, expiresAt: "YYYY-MM-DD"|null, createdAt }`. 시드는 기본 3종(§0). `migrateDB`가 구버전 로컬 DB에 시드 주입. `hydrateFromServer`의 settings 병합으로 서버 값이 로컬을 덮어쓴다(서버에 coupons 키가 없으면 시드 유지).
- **조회 규칙**: `findCoupon`(store)이 정규화 → `settings.coupons`에서 조회 → `expiresAt`이 오늘(로컬 날짜) 미만이면 만료로 제외. `coupons.js`는 순수 헬퍼(normalize·apply·isCouponActive)만 남긴다.
- **store CRUD**: `listCoupons()` / `addCoupon({ code, value, expiresAt })`(percent 전용, 코드 중복·값 1–99 검증, 실패 시 null) / `removeCoupon(code)`.
- **어드민 UI**: 신규 `AdminCoupons.jsx`, 라우트 `/bo-4q9z7m/coupons`, 메뉴 키 `opsA.menu.coupons`(4개 언어), 아이콘 lucide `TicketPercent`. con-* 문법(ConsoleHead) 준수. 목록(코드·할인·만료·상태·삭제) + 등록 폼(코드/할인%/만료일 선택). 변경 즉시 `pushSettingsToServer({ coupons })` — AdminMetals와 동일한 write-through 패턴.
- **서버**: `settingsRepository.js`의 `PUBLIC_SETTINGS_KEYS`에 `"coupons"` 1줄 추가(공개 배포 + 어드민 PUT allowlist 겸용). 그 외 서버 무변경.
- **위저드 표시**: labelKey 있는 시드 쿠폰은 `couponNames[labelKey]`, 어드민 등록 쿠폰은 `CODE · −N%`로 표기.

## 8. 검증

- 단위: `coupons.test.js`(정규화·대소문자 무시 조회·margin0/percent/null 적용), `intakePayload.test.js`(couponCode 정규화 캡처), `quoteEstimate` 쿠폰 적용으로 범위 하락 확인, `createQuote` 쿠폰 반영(총액·디파짓·밸런스·quote.coupon).
- 브라우저: 위저드 완주 — WELCOME5 입력 → 견적 즉시 하락 + 적용 라인 → 제출 → 포털 브리프 Coupon 행. 무효 코드 힌트. BD-ATCOST가 WELCOME5보다 큰 할인인지 확인. 콘솔 에러 0.
