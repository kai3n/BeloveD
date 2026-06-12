# Diamond Operations Manual → 웹앱 리팩토링 스펙

날짜: 2026-06-12 / 상태: **확정** (근거: Diamond Operations Manual PDF — Lark 운영 매뉴얼 영문판)
기존 "벤더 시안 마켓플레이스"(임의 설계)를 매뉴얼의 실제 주문제작 플로우로 **대체**한다. 딜러 네트워크 채널·다이아 쇼케이스·홈은 유지.

## 1. 핵심 워크플로 (Order ID = DM-000001)

```
고객 문의 → 요구사항 폼(V3) → 주문 생성 → 스타일 확정
→ 스톤/메탈중량/공임 요청(서플라이어) → 내부 다이아 검수 → 고객 다이아 선택
→ 내부 견적 → 고객 견적·약관 수락 → 디파짓 → 서플라이어 3D CAD
→ 고객 CAD 리뷰/승인(버전 관리) → 제작 → 최종 QC(IGI·각인 검증, 실중량 정산)
→ 잔금 → 국내 창고 → 해상 운송 → 배송 → 아카이브
```

## 2. 역할과 보안 경계 (절대 규칙)

| 역할 | 접근 | 절대 불가 |
|---|---|---|
| Operations | 전부 | — |
| Customer | 자기 주문만 (query code 또는 로그인) | 내부 원가·서플라이어 신원·타 고객 주문 |
| Supplier | 배정 태스크만 (전용 링크) | 고객 신원·판매가·마진·Order 전체 |
| Logistics | 운송 정보만 | 원가·마진·불필요 고객정보 |

- 고객 공개 다이아는 **허용 필드만 복사**(allowlist) — supplier/procurementCost/internalReview/internalNotes 제외
- 주문별 조회 코드(query code)는 랜덤 — 전화번호/생일 금지
- 서플라이어 태스크에는 Order ID 미노출 (PR ID로만)

## 3. 엔티티 (mock store 슬라이스)

```
intakes        (id, orderId?, name, contact, productLine[solitaire|multi], category[ring|necklace|earrings|bangle],
                styleId, budget, metal[14ky|18ky|14kr|18kr|18kw|pt], conditional{ringSize|chainStyle+chainLength(16/18/20in)+clasp|wristSize|earringDetails},
                stonePrefs{shape,carat,color,clarity,growth[CVD|HPHT],lab,colorTreatment,fluorescence,lwRatio}?,
                requiredDate, country, termsAccepted, createdAt)
opsOrders      (id=DM-xxxxxx, intakeId, customerId?, customerName, styleId, status[STYLE_SELECTION|STONE_SELECTION|QUOTATION|CAD|PRODUCTION|QC|BALANCE|SHIPPING|DELIVERED|ARCHIVED|PAUSED|CANCELLED],
                owner, queryCode, selectedDiamondId?, cadLink?, requiredDate, internalNotes, createdAt)
opsStyles      (id=RING-001…, category, name{i18n}, coverImage, mediaComplete, metalOptions[], estWeightG, laborUsd, leadDays,
                availableForSale, published, supplierEvidence, firstQuoteAt)
styleSpecs     (id, styleId, metal, size, centerStoneSpec, estWeightG, variancePct, laborUsd, materialsUsd, status[approved|reconfirm], evidence)
diamondPricing (shape×caratTier 매트릭스 — unitUsdPerCt, quoteDate)  // 9 shapes × 7 tiers
procurementReqs(id=PR-xxxxxx, orderId, type[diamondCandidates|weightLabor|cad|qc], supplierId, dueDate, batchValidUntil?, brief, status[open|submitted|closed])
diamondCands   (id=DIA-{order}-NN, orderId, prId, igiNo, shape, carat, color, clarity, growth, lab, proportions{table,depth,crown,pavilion,lw,faceUp},
                reportUrl, image, video, colorTreatment, availability[available|hold|sold], procurementCostUsd, supplierId, internalReview[recommended|alternate|excluded],
                published, customerPriceUsd, clientSelection[none|selected], locked)
quotes         (id=Q-{order}-V{n}, orderId, status[draft|sent|accepted|expired], estWeightG, metalRefUsdPerG, lossRatePct, nonMetalUsd,
                internal{diamondCostUsd, laborUsd, extrasUsd, riskUsd, multiplier}, snapshot{benchmarkUsdPerCt, specWeightG},
                metalAmountUsd, diamondAmountUsd, totalUsd, depositUsd, balanceUsd, validUntil, leadDays, acceptedAt?)
milestones     (id=M-{order}-NN, orderId, stage[13종], status[pending|inProgress|waitingClient|blocked|done],
                clientUpdate, clientAction, link, publishToClient, at)
cadReviews     (id, orderId, version, fileUrl, supplierUploadedAt, internalReview, sentAt, decision[approved|minorRevision|styleChange]?,
                feedback[{change}...], confirmedMeasurements, evidence, decidedAt)  // 버전당 1레코드, 덮어쓰기 금지
customerActions(id=CA-xxxxxx, orderId, type[diamondSelection|quoteAcceptance|cadReview|finalWeight|deliveryAddress|shippingApproval],
                prompt, link, dueDate, status[open|done], response?, respondedAt)
auditLog       (id, actor, entity, entityId, field?, before?, after?, at)  // 모든 쓰기 기록
settings      += { opsDepositRate: 0.5, metalRefUsdPerG{metal별}, defaultLossRatePct: 8, designChangeFeeUsd: 15, cancelAfterProductionMinUsd: 140, productionLeadDays: 10 }
```

13 마일스톤 스테이지(고정 순서): Deposit Received, Diamond Locked, CAD Issued, CAD Approved, Production Started, Setting/Polishing, Final QC Video, IGI & Inscription Verified, Actual Metal Reconciled, Balance Received, Sent to Domestic Warehouse, Ocean Shipment, Delivered & Archived.

## 4. 견적 공식 (테스트 대상)

- diamondAmount = 벤치마크 스냅샷 USD/ct × carat × multiplier
- metalAmount = estWeightG × metalRefUsdPerG × (1 + lossRate%)
- total = diamondAmount + metalAmount + nonMetalUsd (공임·인증서/기프트박스/물류·리스크버퍼는 내부 구성요소, 고객에겐 nonMetal 패키지로만)
- deposit = round(total × opsDepositRate), balance = total − deposit
- 실중량 정산: balance 재계산 = (actualWeightG − estWeightG) × metalRefUsdPerG × (1+loss) 를 잔금에 가감
- 스냅샷 원칙: 벤치마크/스펙 변경이 과거 견적에 영향 없음

## 5. 화면

### 고객 (Storefront 변환)
- **주문제작 폼 V3** (`/custom/new` 대체): 카테고리/제품라인 조건부 필드(링 사이즈, 체인 16/18/20in 단일선택, 손목둘레, 이어링 상세), 메탈 6종, 솔리테어면 스톤 선호 입력, >2ct CVD+컬러트리트먼트 권장 안내, 약관 동의 → 제출 시 DM Order ID + query code 발급 화면
- **스타일 카탈로그** (`/styles`, 기존 템플릿 갤러리 대체): published 스타일만, Style ID 표기, 카테고리 필터
- **클라이언트 포털** (`/portal/:orderId?code=` 게스트 + 로그인 고객 `/account`): 현재 상태, 선택 스타일/다이아, 견적(수락 액션), 다이아 후보 선택(배치 만료 표시), CAD 뷰+구조화 피드백(승인/마이너 수정+항목별), 마일스톤 타임라인(publishToClient만), 물류 추적, 진행 액션(CA) 목록
- 다이아 쇼케이스(`/diamonds`)·홈·가이드·딜러 채널은 유지

### 서플라이어 (`/supplier`, 기존 벤더 포털 대체 — 역할명 supplier)
- 태스크 큐: 배정된 PR (유형·마감일·배치만료) — 고객 신원/판매가 미노출
- 다이아 후보 제출 (IGI번호·4C·성장방식·비율·미디어·가용성·공급가)
- 중량/공임 제출 (estWeight, loss 포함 여부, labor, melee, lead time, 가정)
- CAD 업로드 (버전별), 제작 단계 업데이트, 최종 QC 파일(영상·인증서·중량 증빙)

### Operations 콘솔 (`/admin` 확장 — 기존 주문감독/템플릿 모듈 대체)
- **주문 관제**: 전체 주문 테이블(상태·오너·필요일·다음 액션), 주문 상세 = 인테이크/PR 발행/후보 검수(추천·대안·제외 + 안전필드 publish)/견적 빌더(스냅샷+공식 자동계산, 내부 원가 입력)/마일스톤 보드(13종, publish 토글)/CAD 리뷰 이력/고객 액션/감사 로그
- **스타일 라이브러리**: 내부 스타일 CRUD + Available for Sale + publish
- **스타일 스펙**: 조합별 고정 중량/공임 (Approved for Quoting)
- **다이아 벤치마크**: 9×7 매트릭스 인라인 편집 + quote date
- **데일리 체크리스트** 대시보드: 매뉴얼 §12 항목 자동 점검(인테이크 미주문, Waiting Client 방치, 견적 만료 임박, 후보 부족, 필요일 임박)
- **설정**: 디파짓 비율, 메탈 기준가, 로스율, 약관 수수료

### 제거(대체)되는 것
기존 custom requests/proposals/feedback/orders/payments 도메인, 벤더 포털, 템플릿 갤러리, 기존 어드민 주문감독·템플릿 모듈. (딜러 채널·다이아 쇼케이스·홈·가이드는 유지)

## 6. Non-goals (MVP)
실결제·Lark Base 동기화·이메일 알림·서플라이어 전용 외부 링크 서명(로그인으로 대체)·물류 외부 API·CNY 표기(USD 고정)
