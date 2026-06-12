# LUMINA LAB 딜러 네트워크 채널 — 스펙

날짜: 2026-06-12 / 상태: **확정** (근거: `diamond_qc.pdf` 내부 메모, 사용자 컨펌 "공존")
기존 B2C 커스텀 주문 마켓플레이스는 유지하고, PDF의 실제 비즈니스(브랜드 + 2단계 공인 딜러 네트워크)를 추가한다.

## 1. 비즈니스 모델 (PDF 요약)

- 중국 파트너 공장 → **CA 창고** → 독립 딜러에게 **도매 판매** → 딜러가 소비자에게 판매
- 우리는 수입자·브랜드 오너·마스터 디스트리뷰터. **딜러가 merchant of record** (소비자 결제는 딜러 몫, 차지백도 딜러 몫)
- **법적 레드라인**: ① MLM 금지 — 티어 자격은 순수 구매량 기준, 모집 보상·바이인 없음 ② 소매가 강제 금지 — **MSRP(권장가)** + **MAP(광고가 하한)** 정책만
- 드롭쉽: CA 창고 → 딜러 또는 최종 구매자 직배송. 첫 도매 주문 전 **seller's permit + resale certificate** 필수

## 2. 티어/가격

- 딜러 2티어 (예시: T1 $2,250 / T2 $2,500, 소매 ~$4,000 스톤 기준). 신규 = T2
- 승급: 분기 구매량 ≥ 임계값(운영자 설정) → T1. 2분기 연속 미달 → T2 강등
- **가격 = 스톤 도매가(티어별 고정) + 메탈 변동가**(중량g × 금 시세 × 순도 + 공임). 금 시세는 주문일 기준 — 운영자가 spot 가격 관리

## 3. 애프터서비스 (품질/비품질 분리)

**품질 결함 = 우리 책임 (end-to-end)**
- 대상: 인증서 불일치, 세팅 결함, 보증기간 내 정상 착용 중 스톤 분실, 주조 결함, 도금 불량
- 기간: 외관 결함 배송 후 7일 / 세팅 불량 12개월 / 제3자 가공 제외
- 플로우: 최종 구매자는 **딜러에게만** 연락 → 딜러가 사진/영상으로 클레임 제출 → 우리가 판정 → **수리가 아닌 교체** → **불량품 반환 조건부** (선불 라벨 / 신뢰 딜러는 선교체)
- 역물류: 불량품은 CA 창고로만. 골드는 분기별 정련소 배치(스팟 90%+ 회수), 스톤은 재검수 후 루스 풀로 복귀 — **샐비지 원장 기록**
- 공장 클레임: 사진 기반, 공장 원가 기준 무상 리메이크 + 샐비지 크레딧 공식(회수 골드 × 스팟 × 75%)

**비품질 반품 = 딜러 영역 (핸드북 권장 정책)**
- 주문제작: **Final Sale** (구매 전 명시, 품질 결함 제외)
- 카탈로그: 30일 반품 + **재입고비 ~20%** 또는 무료 교환/스토어 크레딧
- 사이징은 예방: 주문 확정 전 링 사이저 발송, **리사이즈 불가 스타일 플래그**(이터니티 밴드 등), 제3자 가공 시 세팅/메탈 보증 무효(스톤 보증 유지)

**보증 = 상품**
- 12개월 제조 결함 보증(기본) / 마모·유지보수는 유료 서비스(LA 벤치 주얼러) / (파일럿) 연 1회 무료 점검 조건부 평생 보증

## 4. QC & 데이터

- 선적 전 중국 풀 검수(세팅·인증서 대조·중량 검증·**개체별 사진**) → CA 입고 시 사진 대조 약식 검수
- **개체별 사진 아카이브** = 차지백/배송 분쟁 증거 파일. 주문 처리 화면에서 QC 사진 첨부 필수
- **보증 등록**: 모든 판매는 최종 구매자 이름+연락처 등록으로 보증 활성화. 우리는 딜러의 등록 고객에게 직접 마케팅하지 않음(서면 약정)
- **FTC**: 모든 제품 설명에 "laboratory-grown" 명시 (우리+딜러 의무). 전 스톤 IGI(급) 인증서 동봉

## 5. 웹앱 범위

### 5.1 퍼블릭 (기존 사이트에 추가)
- **딜러 지원 페이지** `/dealers/apply`: 사업자명·도시·seller's permit·resale cert 번호·예상 분기 물량 → 운영자 승인 대기
- 제품/템플릿 화면에 FTC 랩그로운 고지 문구
- 홈/푸터에 "공인 딜러 프로그램" 링크

### 5.2 딜러 포털 `/dealer` (신규 역할 dealer)
- **대시보드**: 현재 티어, 이번 분기 구매량/임계값 진행률, 강등 경고(연속 미달 분기 수), resale cert 상태
- **도매 카탈로그**: 카탈로그 피스(완제품 SKU) — 내 티어 도매가 = 스톤(티어) + 메탈 실시간 견적(g×스팟×순도+공임), MSRP 병기, 리사이즈 불가 플래그, FTC 문구
- **도매 주문**: 수량, 배송지(딜러 주소 / 최종 구매자 직배송), resale cert 없으면 주문 차단. 주문 시점 메탈 견적 고정
- **주문 내역**: 상태(접수→QC 통과(사진 열람)→배송중(운송장)→완료)
- **보증 등록**: 판매 건별 구매자 이름/연락처 등록 → 보증 만료일 자동 계산
- **클레임**: 보증 등록 건 선택 → 결함 유형 + 사진 제출 → 판정 상태 추적(제출→판정중→승인(교체)/반려→반환 대기→반환 수령→교체 발송)
- **정책/핸드북**: MSRP/MAP, 반품 권장 정책, 보증 기간, 사이징 규칙, FTC 의무

### 5.3 어드민 확장
- **딜러 관리**: 지원서 큐(승인/반려), 딜러 목록(티어·분기 구매량·cert·정지), 티어 수동 오버라이드
- **카탈로그(도매) 관리**: SKU CRUD — 스톤 도매가 T1/T2, MSRP, 메탈 중량 g, 공임, 리사이즈 가능 여부
- **금 시세**: 운영자 직접 갱신 (settings.goldSpotPerGram)
- **도매 주문 처리**: QC 사진 첨부(필수) → QC 통과 → 운송장 입력 → 배송
- **클레임 판정**: 사진 검토 → 승인(교체)/반려 + 사유 → 반환 수령 처리 → 샐비지 기록(회수 골드 g, 스톤 풀 복귀) → 교체 발송
- **샐비지 원장**: 클레임별 회수 기록, 분기 합계(정련소 배치용), 샐비지 크레딧(g × 스팟 × 75%)
- **보증 등록 대장**: 전체 조회 (직접 마케팅 금지 원칙 고지)
- **설정 확장**: 티어 임계값(분기 USD), 금 시세, 보증 기간(일/개월)

### 5.4 데이터 모델 추가 (mock store)
```
dealerApplications(id, bizName, city, contactName, email, permitNo, resaleCertNo, expectedQuarterlyUsd, status[pending|approved|rejected], createdAt)
users.role += "dealer"; dealerProfiles(userId, tier[1|2], city, permitNo, resaleCertNo, active, tierOverride?)
catalogItems(id, name{i18n}, category, image, msrpUsd, stoneWholesaleT1, stoneWholesaleT2, metalGrams, laborUsd, resizable, visible)
wholesaleOrders(id, dealerId, items[{itemId, qty, stoneUsd, metalUsd, unitUsd}], goldSpotAtOrder, shipTo{type[dealer|endBuyer], name, address}, status[PLACED|QC_PASSED|SHIPPED|DELIVERED|CANCELLED], qcPhotos[], trackingNo, totalUsd, createdAt)
warrantyRegs(id, dealerId, itemId, orderId?, buyerName, buyerContact, soldAt, warrantyUntil)
claims(id, dealerId, regId, defectType[certMismatch|setting|stoneLoss|casting|plating], desc, photos[], status[SUBMITTED|APPROVED|DENIED|AWAITING_RETURN|RETURN_RECEIVED|REPLACED], adminNote, salvage{goldGrams, stoneToPool, creditUsd}?, createdAt)
settings += { goldSpotPerGram, goldPurity: 0.75, tierThresholdUsd, warrantyMonths: 12, cosmeticWindowDays: 7 }
```

### 5.5 핵심 규칙(테스트 대상)
- 메탈 견적: `metalGrams × goldSpotPerGram × goldPurity + laborUsd` (주문 시점 고정 저장)
- 도매 단가: `stoneWholesale[tier] + metalQuote`
- 티어 산정: 이번 분기 주문 합계(USD, CANCELLED 제외) ≥ 임계값 → T1 자격. `belowStreak`(연속 미달 분기) ≥ 2 → T2. 수동 오버라이드 우선
- 클레임 상태머신: SUBMITTED→(APPROVED|DENIED); APPROVED→AWAITING_RETURN→RETURN_RECEIVED→REPLACED. DENIED 종결. 샐비지 크레딧 = goldGrams × spot × 0.75
- resale cert 없는 딜러는 주문 불가

### 5.6 Non-goals (이번 MVP 제외)
실결제/실배송 연동, MAP 광고가 모니터링 자동화, 공장 클레임 인보이스 상계, 멀티 통화(USD 고정), 딜러별 메모/콘사인먼트 조건, 공개 딜러 로케이터
