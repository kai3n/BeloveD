# Ops Manual 리팩토링 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. 스펙: `docs/superpowers/specs/2026-06-12-ops-manual-spec.md`

**Goal:** 기존 벤더 시안 마켓플레이스를 Diamond Operations Manual의 실제 플로우(인테이크→주문→스톤선택→견적→CAD→제작→QC→잔금→배송)로 대체. 고객 포털 / 서플라이어 포털 / Operations 콘솔 3면 구축.

### Stage A: ops 도메인 로직 + 스토어 (TDD)
- `src/lib/ops.js`: ORDER_STATUSES·전이, MILESTONE_STAGES(13), 견적 공식(quoteCompute), 실중량 정산(reconcileBalance), ID 생성, 다이아 publish allowlist(publicDiamondView), customerOrderView/supplierTaskView 보안 프로젝션, 9×7 벤치마크 기본값
- store v6: 슬라이스 추가 + 레거시(requests/proposals/feedback/orders/payments/productionMedia/statusMachine) 제거, API: createIntake→createOpsOrder(쿼리코드), PR 발행, 후보 제출/검수/publish/선택/락, 견적 draft→sent→accept(스냅샷), 마일스톤 upsert/publish, CAD 버전 추가/판정(덮어쓰기 금지), CA 발행/응답, 감사로그 래퍼, 데일리 체크 집계
- 테스트: 견적 공식·정산, allowlist 누락 필드, 보안 프로젝션(고객뷰에 원가 없음/서플라이어뷰에 고객명 없음), CAD 버전 불변, 마일스톤 순서, 풀 플로우

### Stage B: 문자열 4개 언어 (`src/opsStrings.js`)
intake(조건부 폼 전체)·portal(상태/마일스톤/견적/CAD/액션)·supplier(태스크/제출 폼)·ops(콘솔 전 모듈)·terms(약관 4항)

### Stage C: 고객
- `IntakeForm.jsx`(조건부 필드, 약관, 제출→OrderID+코드 안내), `StyleCatalog.jsx`, `ClientPortal.jsx`(게스트 코드 접근+로그인), Account 리스트 갱신, 라우트/내비 교체(주문제작→인테이크, 갤러리→스타일)

### Stage D: 서플라이어
- `/supplier`: TaskQueue, 태스크 상세(유형별 제출 폼: 후보/중량공임/CAD/QC), 역할 rename vendor→supplier

### Stage E: Operations 콘솔
- AdminOps(주문 테이블+상세 워크벤치), AdminStyles, AdminSpecs, AdminBenchmark(9×7), AdminChecklist, 설정 확장 — 기존 주문감독/템플릿 모듈 제거

### Stage F: 마무리
- 시드 데모 시나리오(진행중 주문 DM-000001: 후보 3개 published, 견적 sent, CAD V1 대기), 브라우저 E2E(인테이크→선택→수락→CAD 승인→마일스톤), 모바일 스윕, 배포
