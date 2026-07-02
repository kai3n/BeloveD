# Image-First Intake + Simplified Order Flow — Design Spec

날짜: 2026-07-01 · 승인: 컨셉 목업(`public/intake-concepts/`) 기준 사용자 확정
- Intake: **Option 3 Gallery Flow** 베이스 (+ Option 1의 이미지 리뷰 카드)
- Order flow: **order-flow-concept.html** 그대로 (제안 미디어는 화살표 캐러셀)

## 1. 배경 / 목표

1. 고객 요청 폼(IntakeForm)이 드롭다운·텍스트 중심이라 모바일/인스타 유입 고객에게 무겁다.
   → 풀스크린 한 화면 한 질문, 이미지를 탭해서 답하는 폼으로 교체.
2. 주문 flow가 후보 여러 개 → 셀렉션 제출 → 재고확인 → 항목별 견적 수락로 길다.
   → 어드민이 벤더 상담 후 **확정 제안 1장**(다이아 스펙 + 총액)을 보내고,
   고객은 **컨펌 → Zelle/Venmo 디파짓** 두 번의 행동만 한다.
3. 견적 breakdown(다이아/메탈/패키지/중량)은 **어드민 전용**. 고객은 총액·디파짓·잔금만 본다.
4. 제안된 다이아는 **동급 대체 가능** — 대체 시 IGI 번호·실물 미디어로 재확인 받는다.

## 2. Feature A — Gallery Flow Intake

### 화면 구성 (한 화면 한 질문, 탭하면 자동 진행)

| # | 질문 | UI | 비고 |
|---|---|---|---|
| 1 | Category | 포토 타일 4개 (ring/necklace/earrings/bangle) | `?category=`/`?style=` 프리필 시 스킵 |
| 2 | Design | 해당 카테고리의 Style Library 카드 (사진+이름) + "아직 모르겠어요" | 선택 시 productLine 추론 (기존 `inferProductLineFromStyle`) |
| 3 | Metal | 그라디언트 스와치 칩 6개 (`OPS_METALS`) | |
| 4 | Shape | SVG 실루엣 타일 9개 (`BENCHMARK_SHAPES`) | solitaire만. multi면 스킵 |
| 5 | Carat | 슬라이더 + 실물 비율 스톤 프리뷰 | solitaire만. `?diamond=` 프리필 |
| 6 | Inspiration | 기존 `MediaPicker` (최대 5, 스킵 가능) | |
| 7 | Review | 이미지 요약 카드(Option 1 스타일) + 사이즈/핏 + 퀄리티 행 + 희망일 + 연락처(비로그인) + 약관 + 제출 | |

### Review 화면 세부
- **사이즈/핏**: 카테고리 조건부 필드를 컴팩트 칩/셀렉트로 수집
  (ring→ringSize, necklace→chainStyle·chainLength·clasp, bangle→wristSize, earrings→earringDetails).
  필수 검증은 기존 `validateStep(0)` 규칙 유지.
- **퀄리티 행**: 기본값 `E · VS1 · CVD · IGI` 표시 + "조정" 토글로 컬러/클래리티 스케일 피커 인라인 확장.
- **multi 라인**: shape/carat 스킵, multiSpec 자유입력 제거 — 빈 값 + 기본 standard로 제출하고
  어드민이 상담·제안 단계에서 확정한다 (§3 flow와 일치).

### 유지되는 것
- `createIntake` 페이로드 구조 (category/subcategory/styleId/metal/conditional/stonePrefs/multiSpec/referenceMedia/…) — 서버·어드민 호환.
- localStorage 드래프트(`lumina-intake-draft`, 현재 화면 인덱스 포함), URL 프리필, 제출 완료 화면(주문번호+코드).
- 교육 콘텐츠: 사이드패널 대신 스톤 질문 화면의 "이게 뭐예요?" 토글로 `StoneEduPanel` 인라인 노출.
- i18n 4개 언어(en/ko/zh/es) — 신규 문자열은 `opsStrings.js`의 intake 섹션에 추가.

### 구현 노트
- 신규 공용 컴포넌트: `src/components/intake/` — `ImageOptionGrid`, `ShapeTiles`(SVG 세트),
  `MetalSwatches`, `CaratSlider`, `ScalePicker`, `GalleryStep`(풀스크린 레이아웃/전환/진행 도트).
- 스타일은 앱 디자인 토큰(styles.css 변수) 사용 — 목업의 NOIR 하드코딩 색상을 쓰지 않는다 (day/night 모드 대응).
- 기존 IntakeForm.jsx는 교체. 위저드 방어 로직(Enter 암묵 제출 방지)은 화면당 버튼 구조라 불필요.

## 3. Feature B — Proposal → Deposit Order Flow

### 고객 여정 (포털)
`Request(제출 완료) → Proposal(확정 제안·컨펌) → Deposit(Zelle/Venmo) → Production(CAD→완성→배송)`

- 포털 상단에 4단계 저니 레일 표시.
- **고객용 다이아 후보 선택 단계 제거** — 후보 비교/셀렉션 제출/재고확인 UI는 고객 포털에서 사라진다.
  (어드민 내부 후보·조달 도구는 유지. 상담은 기존 채팅으로.)

### 확정 제안 카드 (기존 quote 확장)
- **미디어 캐러셀**: 사진·영상 최대 5개(다이아·세팅·완성 예시), 좌우 화살표 + 카운터 + 도트,
  기존 `ClientMediaCarousel` 재사용.
- **스펙 라인**: Stone / Grade / Certificate(IGI) / Setting / Lead Time.
- **금액**: 총액(크게) + Deposit/Balance 분할 + 유효기간. **breakdown 없음.**
- **동급 대체 안내문** 고정 노출: 캐럿 ±0.03·동일 등급 이상 대체 가능, 대체 시 IGI·영상 재확인 후 진행.
- 배송지 입력(기존 `ShippingAddressPanel`) 완료 → **Confirm This Proposal** = `acceptQuote`.

### 디파짓 카드 (컨펌 후 활성)
- Zelle/Venmo 계정 + Copy 버튼 + 금액 + "메모에 주문번호" 안내.
- **I've Sent the Deposit** → `quote.depositReportedAt` 기록 + `depositReceived` 마일스톤 `waitingClient`→어드민 확인 대기 표시("영업일 24시간 내 확인").
- 어드민이 기존 `markDepositReceived(orderId)` 실행 → 스톤 락 + CAD 자동 진행 (기존 로직 그대로).
- 잔금(BALANCE) 단계도 동일한 결제 카드 컴포넌트 재사용.

### 데이터 변경 (store.js / ops.js)
- `quote`에 추가: `proposalMedia[{kind,src}]`(≤5), `stoneSpec{shape,carat,color,clarity,cut,igiNo}`,
  `substitutionNote(선택)`, `depositReportedAt`.
- `settings`에 추가: `payment: { zelle, venmo, note }` — 어드민 설정 화면에서 편집.
- **`portalView` 고객 프로젝션에서 breakdown 제거**: `metalAmountUsd`·`nonMetalUsd`·`diamondAmountUsd`·`estWeightG` 미노출.
  노출 필드: `totalUsd, depositUsd, balanceUsd, validUntil, leadDays, status, proposalMedia, stoneSpec, substitutionNote, depositReportedAt`.
- 신규 액션: `reportDepositSent(quoteId, actor)`.

### 어드민 변경 (AdminOpsOrder)
- "다음 고객 컨펌 보내기"에 **확정 제안 컴포저**: 후보 선택(또는 수동 스펙 입력) + 미디어 첨부 +
  기존 견적 입력(중량/메탈시세/로스/패키지 — breakdown은 여기서만 보임) + 대체 안내문 → `sendQuote`.
- 입금 확인 대기 목록(기존 checklist `depositWait`)에 `depositReportedAt` 뱃지 노출 + 확인 버튼(`markDepositReceived`).
- 어드민 설정에 Zelle/Venmo 핸들 편집 필드.

## 4. 테스트

- `portalView` 프로젝션: breakdown 필드가 고객 뷰에 없음을 단언 (보안 회귀 방지 — 핵심).
- flow 전이: sendQuote(제안) → acceptQuote → reportDepositSent → markDepositReceived → status CAD.
- intake: 새 폼이 만드는 페이로드가 `createIntake` 기대 구조와 일치 (카테고리별 conditional 포함).
- 기존 vitest 스위트 전체 그린 유지.

## 5. 범위 제외 (YAGNI)

- 실제 결제 연동(Zelle/Venmo API) — 수동 확인이 운영 모델.
- 어드민 후보/조달/벤더 도구 재설계 — 그대로 유지.
- 다국어 문서/이메일 알림 변경.
