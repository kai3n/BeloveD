# 딜러 네트워크 채널 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. 스펙: `docs/superpowers/specs/2026-06-12-dealer-network-spec.md`

**Goal:** 기존 앱에 PDF 비즈니스(2단계 딜러 네트워크)를 추가 — 퍼블릭 딜러 지원, 딜러 포털(도매 카탈로그·주문·보증등록·클레임·티어), 어드민 확장(딜러/카탈로그/주문처리/클레임판정/샐비지/설정).

**Architecture:** 기존 mock store(localStorage)에 딜러 도메인 슬라이스 추가(DB v4). 순수 로직(메탈 견적·티어 산정·클레임 상태머신)은 `src/lib/dealer.js`로 분리해 Vitest TDD. UI는 기존 NOIR 토큰/platform.css 재사용, 전 문자열 4개 언어.

### Task 1: 딜러 도메인 로직 (TDD)
- Create `src/lib/dealer.js`: `metalQuote(item, spot, purity)`, `unitWholesale(item, tier, spot, purity)`, `quarterKey(date)`, `computeTier(orders, profile, settings, now)`(오버라이드>연속미달강등>볼륨승급), `CLAIM_FLOW` 허용 전이 + `canClaimTransition`
- Test `src/lib/__tests__/dealer.test.js`: 견적 계산, 티어 승급/강등/오버라이드, 클레임 전이 전수, 샐비지 크레딧
- store.js: DB v4 + seed 확장(catalogItems 5 SKU=lineup 제품, 딜러 2명(T1/T2)+pending 지원서, 진행중 도매주문·보증등록·클레임 샘플) + API: applications/dealers/catalog CRUD, createWholesaleOrder(cert 게이트, 주문시점 견적 고정), order 상태 전이(QC사진 필수), registerWarranty, submitClaim/adjudicate/receiveReturn(샐비지)/markReplaced, listSalvage, settings 확장
- store 테스트: 도매 주문 풀 플로우 + cert 게이트 + 클레임 풀 플로우

### Task 2: 4개 언어 문자열
- platformStrings.js에 `dealer`(포털 전체), `dealerApply`(퍼블릭), `adminDealer`(어드민 확장) 섹션 — en/ko/zh/es

### Task 3: 퍼블릭
- `src/pages/DealerApply.jsx`(지원 폼→pending), 푸터·홈 콘시어지 아래 링크, FTC 고지 컴포넌트(`FtcNote`)를 다이아 상세·갤러리·카탈로그에 표시

### Task 4: 딜러 포털 (`/dealer`, RequireRole dealer)
- `DealerLayout`(서브 내비) + Dashboard(티어 진행률/경고/cert 상태), Catalog(티어 도매가+MSRP+견적 분해), OrderNew(수량·드롭쉽 주소·견적 고정), Orders(상태/QC사진/운송장), Registrations(등록 폼+목록), Claims(목록+제출 폼: 등록건 선택·결함유형·사진), Policies(핸드북 정적)

### Task 5: 어드민 확장
- AdminDealers(지원서 큐+딜러 목록+티어 오버라이드/정지), AdminCatalog(SKU CRUD+금시세 인라인), AdminWholesale(QC사진 첨부→QC통과→운송장→배송), AdminClaims(판정/반환수령+샐비지 입력/교체발송, 샐비지 분기 합계), AdminWarranty(등록 대장), AdminSettings에 금시세·티어임계값 추가

### Task 6: 라우팅/검증/배포
- App.jsx 라우트, Layout 역할 링크(dealer), 데모 계정 버튼(딜러) 추가
- 브라우저 플로우 검증: 지원→승인→로그인→주문(cert 게이트)→QC→배송 / 보증등록→클레임→판정→반환→샐비지→교체
- 모바일 오버플로 스윕, 커밋, Pages 배포
