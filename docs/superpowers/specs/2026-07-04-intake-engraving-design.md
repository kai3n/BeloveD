# 인테이크 각인(Engraving) 문구 지원

날짜: 2026-07-04 / 상태: **확정** (브레인스토밍 세션에서 사용자 승인)
배경: 커스텀 디자인 서비스인데 각인을 받을 곳이 없다. 인테이크 위저드에서 각인 문구를 선택 입력으로 받아 어드민·포털까지 흘려보낸다.

## 0. 확정된 결정 (브레인스토밍)

| 결정 | 선택 |
|---|---|
| 입력 위치 | review 스텝의 Size & Fit 섹션 (전용 스텝 아님) — 위저드 문법상 세부 스펙은 review에서 확정 |
| 적용 범위 | 전체 카테고리 — 카테고리별 위치 힌트만 다르게 표시 |
| 검증 | 없음 (선택 필드, trim만). RFQ 흐름이라 가능 여부는 제안 단계에서 오퍼레이터가 조율 |
| 범위 제외 | 폰트 선택·실시간 프리뷰 (추후 전용 스텝으로 승격할 때 함께) |

## 1. 데이터 — `form.engraving` (string)

- `IntakeForm.jsx`의 `baseForm`에 `engraving: ""` 추가. 이후는 전부 기존 spread 경로로 자동 전파:
  - 드래프트 저장/복원: `{ ...baseForm, ...draft.form }`
  - 제출 페이로드: `buildIntakePayload`의 `{ ...form }` → 서버 `formPayload`(jsonb) — **서버 스키마 변경 없음**
  - 로컬 스토어: `createIntake(payload)`가 form을 그대로 저장 → `intake.engraving`
- 제출 시 trim된 값이 실리도록 `buildIntakePayload`에서 `engraving: (form.engraving || "").trim()` 정규화.

## 2. UI — review 스텝 Size & Fit 섹션 (`IntakeForm.jsx`)

- `#gflow-size-fit`의 `filter-grid` 안, 희망일(`requiredDate`) 필드 다음에 텍스트 입력 추가:
  - 라벨: `g.engravingLbl` ("각인 문구") — 어드민·포털 브리프 행에서 재사용하므로 "(선택)" 접미사 없이 평문. 선택 표시는 힌트가 담당.
  - `maxLength={30}`, placeholder: `g.engravingPh` (예: `J ♥ M 2026.07.04`)
  - 필드 아래 `form-hint`로 카테고리별 위치 안내: `g.engravingHints[cat]`
    - ring/bangle: 선택 사항 — 밴드 안쪽 · 최대 30자
    - necklace: 선택 사항 — 펜던트 뒷면 · 최대 30자
    - earrings: 선택 사항 — 디자인에 따라 가능 여부가 달라요, 제안 단계에서 확정해 드려요
- 선택 필드이므로 `conditionalComplete`·제출 검증 무변경. `form.conditional`이 아닌 form 최상위에 두는 이유: 카테고리 전환 시 `categoryDefaults()`로 리셋되지 않고 유지되어야 함.

## 3. i18n — `opsStrings.js` gflow (4개 언어)

en/ko/zh/es × 3키: `engravingLbl`, `engravingPh`, `engravingHints`(카테고리 4키 객체 `{ ring, necklace, earrings, bangle }`).

## 4. 어드민 — `AdminLiveOrders.jsx`

- `intakeRows`에 `["Engraving", (fp.engraving || "").trim()]` 행 추가. 기존 `.filter(([, v]) => v && v !== "—")` 덕에 값이 있을 때만 표시.

## 5. 고객 포털 — `ClientPortal.jsx`

- 사이즈 요약(`conditionalSizeSummary`) 근처 스펙 표시부에 각인 문구 한 줄 추가 (`intake.engraving`이 있을 때만). 라벨은 `p.intake.gflow.engravingLbl` 재사용 — 새 키 없음.

## 6. 검증

- `buildIntakePayload` 단위 테스트에 engraving 포함/trim 케이스 추가 (기존 vitest 스위트).
- 브라우저: 위저드 완주 → review에서 각인 입력 → 제출 → 어드민 라이브 주문 상세에 Engraving 행 표시 → 포털에서 문구 재확인. 미입력 시 어드민·포털 어디에도 빈 행이 안 생기는지 확인. 콘솔 에러 0.
