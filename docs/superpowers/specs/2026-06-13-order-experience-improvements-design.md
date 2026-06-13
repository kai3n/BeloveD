# 주문 경험 개선 3종 (Order Experience Improvements)

날짜: 2026-06-13 / 상태: **확정** (브레인스토밍 세션에서 사용자 승인)
배경: 현재 주문 플로우의 마찰점 점검 결과 — 고객 인테이크가 한 페이지에 과밀, 벤더 폴백 후보가 수기 입력, 고객 스톤 선택이 단일·불투명. 디파짓 결제 CTA는 이번 범위 제외(입금은 운영자 수동 확인 유지). 세 기능은 서로 독립적이라 개별 배포 가능하며, 격리 워크트리(`worktree-pool-shells-verify`)에서 구현한다.

## 0. 확정된 결정 (브레인스토밍)

| 결정 | 선택 |
|---|---|
| ② 인테이크 위저드 | 3단계 (제품 → 센터스톤 → 레퍼런스+연락처/약관), 단계별 필수값 검증 |
| ③ 벤더 폴백 제출 | 풀 선택 + 수기 입력 병행 |
| ④ 다중선택 | 찜 개수 제한 없음, 벤더 일괄 확인 후 '있음' 중 하나를 고객이 락 |
| 디파짓 | 범위 제외 (운영자 수동 확인 유지) |
| 구현 순서 | ③ → ② → ④ (작고 안전한 것 먼저, 위험한 ④ 마지막) |

## 1. 기능 ② — 인테이크 단계형 위저드

**대상:** `src/pages/IntakeForm.jsx` (단일 폼 → 3단계). 스토어/제출 페이로드 변경 없음.

- 상단에 `.stepper`(기존 CSS 재사용) 3단계 표시: ① 제품 ② 센터스톤 ③ 레퍼런스.
- 상태 `const [step, setStep] = useState(0)`. 단계별 렌더:
  - **Step 1 (제품):** name 제외 — 제품라인·카테고리·스타일·메탈·예산·필요일·국가 + 카테고리 조건부 필드(ring size 등). (이름/연락처는 Step 3으로 이동해 끝에서 한 번에.)
  - **Step 2 (센터스톤):** 솔리테어면 8필드 + `<StoneEduPanel>`(기존 포커스 연동 유지), 멀티스톤이면 multiSpec. (제품라인이 멀티면 이 단계 제목/내용 전환.)
  - **Step 3 (레퍼런스+제출):** 레퍼런스 `MediaPicker`+`PinAnnotator`, 이름, 연락처, 약관 블록, 약관 체크, 제출.
- 하단 네비: `뒤로`(step>0) / `다음`(step<2) / `제출`(step===2). `다음` 클릭 시 현재 단계 필수값 검증 — 미충족이면 진행 차단 + 인라인 에러.
  - 검증 규칙: Step1 = country 필수 + 카테고리별 조건부 필수(ring: ringSize 등, 기존 `required` 필드 기준). Step3 = name·contact·termsAccepted 필수.
  - HTML5 `required`만으로는 단계 이동을 막지 못하므로, `다음`에서 해당 단계 필드를 JS로 검사하는 `validateStep(step)` 추가.
- 새 i18n: `intake.wizardSteps`(3개 라벨), `intake.next`/`intake.back`. (en/ko/zh/es)
- 모바일: 한 컬럼으로 자연 스택(기존 filter-grid 반응형 그대로). stepper는 가로 유지.

## 2. 기능 ③ — 벤더 폴백 후보를 풀에서 선택

**대상:** `src/pages/supplier/SupplierTask.jsx` (`diamondCandidates` 태스크 분기).

- `diamondCandidates` 태스크 화면 상단에 **"내 풀에서 선택"** 섹션 추가:
  - `listPoolDiamonds({ supplierId: user.id })` 중 `availability==="available" && !archived` 목록을 체크박스 행으로 표시(스톤·4C·인증·원가).
  - 체크 후 **"선택 항목 제출"** 버튼 → `submitPoolCandidates(prId, poolIds)` 호출(신규 store 함수): 각 풀 스톤을 후보 스냅샷으로 생성(기존 `autoMatchFromPool`의 스냅샷 로직 재사용 — poolDiamondId 참조, image/video 추출, 완결+벤치마크면 자동가·published). PR 상태 submitted.
  - 풀이 비어 있으면 안내 문구.
- 기존 **수기 입력 폼은 그대로 아래 유지** (풀에 없는 스톤 대응). 둘 중 어느 쪽이든 제출 가능.
- 신규 store 함수 `submitPoolCandidates(prId, poolIds)`:
  - pr = getProcurement(prId); 각 poolId의 getPoolDiamond → 스냅샷 후보 생성(`DIA-{orderId}-NN`, prId, poolDiamondId, supplierId=pool.supplierId, 필드 복제, available).
  - 완결+벤치마크면 candidateAutoPrice+published (submitCandidates와 동일 규칙). pr.status="submitted". audit.
- 신규 i18n: `supplierP.fromPool`("내 풀에서 선택"), `supplierP.poolSubmit`("선택 항목 제출"), `supplierP.poolEmpty`. (4언어)
- **공유 헬퍼 추출(DRY):** 후보 스냅샷 생성 로직이 `autoMatchFromPool`·`submitPoolCandidates` 두 곳에서 동일 → `store.js` 내부 함수 `poolStoneToCandidate(pool, orderId, seq)`로 추출해 양쪽이 사용.

## 3. 기능 ④ — 고객 다중선택 스톤 흐름

**대상:** `src/pages/ClientPortal.jsx` + `src/lib/store.js`(`selectCandidate`/`submitStockConfirm`/`lockCandidate` 재설계) + 후보 필드 추가.

**플로우:** 고객이 후보 여러 개 찜(shortlist) → "재고 확인 요청" → 찜한 각 후보의 벤더에게 stockConfirm 발행 → 벤더가 후보별 있음/품절 응답 → 고객이 '있음' 확인분 중 하나를 최종 락(→ QUOTATION, 디파짓 수동).

**후보 필드 추가:** `stockConfirmed: boolean`(기본 false) — 벤더가 재고 있음으로 응답한 후보 표시.

**store 변경:**
- `toggleShortlist(diaId, actor)` (신규, 기존 `selectCandidate` 대체): 후보 유효성 검사(published·available·만료 아님) 후 `clientSelection`을 "selected"↔"none" 토글. **PR 발행/락 없음.** 락된 주문(selectedDiamondId 있음)이면 무시.
- `requestStockConfirm(orderId, actor)` (신규): 해당 주문의 `clientSelection==="selected"` 후보들 중 열린/응답된 stockConfirm이 없는 것마다 `createProcurement(type:"stockConfirm", supplierId: cand.supplierId, diamondId: cand.id)` 발행. 이미 처리 중인 건 건너뜀.
- `submitStockConfirm(prId, available)` (수정): available → 후보 `stockConfirmed=true`, availability는 **available 유지(락 안 함)**. sold → `setCandidateAvailability(sold)` + `clientSelection="none"` + `stockConfirmed=false`. **기존의 자동 lockCandidate 제거.**
- `lockSelectedCandidate(diaId, actor)` (신규): 후보가 `clientSelection==="selected" && stockConfirmed && available`인지 검증 → `lockCandidate(diaId)`(기존: selectedDiamondId 설정·QUOTATION·풀 sold·형제 무효화·tryAutoQuote 그대로) → 같은 주문의 다른 shortlist 후보 `clientSelection="none"`으로 초기화.
- **기존 fresh-batch 자동 락 최적화 제거**: 모든 선택이 shortlist→confirm→lock을 거치도록 통일(사용자 요구).

**ClientPortal 체크포인트 ① 스톤 UI 재구성:**
- 후보 카드에 **찜 토글**(선택/해제) — `order.status==="STONE_SELECTION" && !selectedDiamondId`일 때.
- 찜이 1개 이상이면 **"재고 확인 요청"** 버튼 노출 → `requestStockConfirm`.
- 각 후보 상태 뱃지: 찜됨 / 확인 중(stockConfirm 열림) / 재고 있음(stockConfirmed) / 품절(availability sold).
- `stockConfirmed` 후보에 **"이걸로 확정"** 버튼 → `lockSelectedCandidate`.
- 락 후엔 기존처럼 선택 요약 + 다음 단계로.
- 신규 i18n: `portal.shortlist`/`portal.unshortlist`/`portal.requestStock`/`portal.checking`/`portal.inStock`/`portal.soldOut`/`portal.lockThis`. (4언어)

**기존 테스트 영향(autoFlow.test.js):** 단일 selectCandidate 자동 락을 전제한 테스트("풀 체인", "무효 후보 선택 차단")는 신규 흐름(toggleShortlist→requestStockConfirm→submitStockConfirm→lockSelectedCandidate)으로 갱신. 워크트리 격리 상태라 main과 분리되어 안전.

## 4. 테스트

- **③**: `submitPoolCandidates` — 선택 풀 스톤이 후보로 생성(poolDiamondId·자동가·published), pr submitted. `poolStoneToCandidate` 추출 후 `autoMatchFromPool` 회귀 통과.
- **④**: `toggleShortlist`(토글·다중), `requestStockConfirm`(찜한 수만큼 PR), `submitStockConfirm`(있음→stockConfirmed·락 안 됨 / 품절→drop), `lockSelectedCandidate`(확정→락+형제 초기화+풀 sold), 미확인 후보 락 시도 차단.
- **②**: 위저드는 컴포넌트 렌더 테스트 인프라 없음 → 빌드 + 브라우저 검증. `validateStep` 순수 함수로 분리 가능하면 단위 테스트.
- 전체 회귀: 갱신된 autoFlow 포함 그린.

## 5. 범위 제외 (YAGNI)

- 디파짓/잔금 인앱 결제 CTA (운영자 수동 유지).
- 위저드 단계 저장/이어하기(드래프트 persistence).
- 다중선택의 벤더 측 일괄 확인 UI(벤더는 기존 stockConfirm 태스크를 후보별로 처리 — PR이 여러 개 생기지만 동일 화면 재사용).
