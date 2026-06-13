# 벤더 다이아몬드 풀 (Vendor Diamond Pool)

날짜: 2026-06-13 / 상태: **확정** (브레인스토밍 세션에서 사용자 승인)
배경: 현재 다이아 후보는 주문이 들어올 때마다 운영자가 벤더에게 "주문별 제출 요청"(diamondCandidates PR)을 발행하고 벤더가 그 주문에 맞춰 후보를 제출하는 구조다. 벤더가 **자기 재고를 미리 상설 풀(pool)에 올려두면**, 주문 시 시스템이 조건에 맞는 스톤을 자동 매칭해 고객에게 바로 보여줄 수 있다. 운영자는 모든 벤더 풀을 사진·레코드까지 CRUD하는 오버사이트 권한을 갖는다.

## 0. 확정된 결정 (브레인스토밍)

| 결정 | 선택 | 비고 |
|---|---|---|
| 풀의 목적 | 주문 매칭 소스 | B2C 쇼케이스/단순 재고추적 아님 |
| 매칭 기준 | 셰이프 일치 + 컬러·클래리티 등급 이상 + 캐럿 범위 + 성장방식 일치 | 일반 다이아 커스텀 관행 |
| 매칭 주체 | **완전 자동** (운영자 미관여) | 고객 포털에 바로 노출 |
| 재고 차감 | **락(디파짓) 시에만** | first-come, 기존 lock 로직과 일치 |
| 권한 | 벤더=자기 것만, 운영자=전체 | 운영자 사진 CRUD·삭제 포함. 벤더 원가는 고객 미노출 |
| 매칭 0건 | 기존 diamondCandidates PR 자동 발행 | 벤더 소싱 요청 fallback |
| 삭제 | 아카이브(소프트 삭제) | 락·주문 이력 참조 보존, 복원 가능 |
| 범위 | 풀 + CRUD + 자동매칭 | 다중선택→벤더 일괄확인 흐름은 후속 스펙 |

## 1. 접근법 — 새 컬렉션

기존 다이아 데이터가 둘 존재한다: `diamonds`(B2C 쇼케이스, 공개 /diamonds), `diamondCands`(주문별 후보). 풀을 이 둘에 끼워넣지 않고 **새 `poolDiamonds` 컬렉션**을 둔다.
- 풀 = 주문과 무관한 벤더 상설 재고 → 수명주기·소유권이 후보와 다름.
- 후보(`diamondCands`)는 풀에서 **스냅샷 복제**되어 생성(가격·사진 고정) → 풀 ↔ 후보 분리.
- B2C `diamonds`(쇼케이스)는 이번 작업에서 **건드리지 않음**.

## 2. 데이터 모델 — `poolDiamonds`

```
{ id: "POOL-000001", supplierId, igiNo, shape, carat, color, clarity, growth, lab,
  certOrg, reportUrl, proportions, colorTreatment,
  media: [{ kind: "image"|"video", src }],          // 사진/영상 (MediaPicker 형식)
  procurementCostUsd,                                 // 벤더 원가 — 고객 절대 미노출
  availability: "available" | "unavailable" | "sold", // 실시간 재고
  archived: false, createdAt, updatedAt }
```

- `available`만 매칭 대상. `unavailable`=벤더 수동 일시 내림. `sold`=락으로 자동 소진 또는 벤더 수동.
- 풀 스톤은 고객/공개 뷰에 직접 노출되지 않는다 — 자동 생성된 후보 스냅샷만(`publicDiamondView`가 원가·supplier 제외).

## 3. 매칭 로직 (`ops.js` 순수 헬퍼 + `store.js`)

- 등급 순서 상수 추가: `COLOR_ORDER = ["D","E","F","G","H","I","J","K"]`, `CLARITY_ORDER = ["FL","IF","VVS1","VVS2","VS1","VS2","SI1","SI2"]`. "등급 이상" = 스톤 인덱스 ≤ 요청 인덱스(인덱스 작을수록 고등급). 요청 등급이 목록에 없으면 매칭에서 해당 축 무시(관대).
- `poolStoneMatches(stone, prefs, opts)` (ops.js 순수 함수):
  - `stone.shape === prefs.shape`
  - `stone.carat >= prefs.carat - opts.caratUnder && stone.carat <= prefs.carat + opts.caratOver`
  - color: `COLOR_ORDER.indexOf(stone.color) <= COLOR_ORDER.indexOf(prefs.color)` (요청 컬러가 목록에 있을 때만)
  - clarity: 동일 방식
  - growth: `!prefs.growth || stone.growth === prefs.growth`
- `matchPoolForOrder(prefs)` (store.js): 활성 벤더의 `!archived && availability==="available"` 풀 스톤 중 `poolStoneMatches` 통과분을 캐럿 근접(|carat-prefs.carat|) → 원가 오름차순 정렬, `settings.poolMatchLimit`개로 캡.
- settings 신규: `poolCaratUnder`(기본 0.05), `poolCaratOver`(기본 0.40), `poolMatchLimit`(기본 12).

## 4. 자동매칭 통합 (`autoDispatchIntake` 수정)

솔리테어 인테이크 제출 시(`store.js` `autoDispatchIntake`):
- `const matched = autoMatchFromPool(order, intake);`
- `matched.length >= 1` → 후보가 이미 published 상태로 생성되어 고객 포털에 즉시 노출. **PR/운영자 개입 없음**.
- `matched.length === 0` → 기존 `autoIssuePr(order.id, "diamondCandidates", { … })` 폴백(벤더 소싱 요청).

`autoMatchFromPool(order, intake)`:
- `matchPoolForOrder(intake.stonePrefs)` 결과 각 풀 스톤마다 **후보 스냅샷** 생성:
  - id `DIA-{orderId}-NN`, `orderId`, `prId: null`, `poolDiamondId: pool.id`,
  - 필드 복제(igiNo, shape, carat, color, clarity, growth, lab, proportions, reportUrl, colorTreatment),
  - `image`/`video`는 pool.media에서 첫 이미지/영상 src 추출,
  - `procurementCostUsd: pool.procurementCostUsd`, `supplierId: pool.supplierId`,
  - `availability:"available"`, `internalReview:null`, `internalNotes:""`, `clientSelection:"none"`, `locked:false`, `createdAt`.
  - 완결성(`isCandidateComplete`)+벤치마크(`benchmarkFor`) 충족 시 `candidateAutoPrice`로 `customerPriceUsd` 설정 + `published=true`.
- 생성된 후보 배열 반환.

후보 선택 흐름: pool 후보는 `prId=null`이라 기존 `selectCandidate`에서 `fresh`가 falsy → `stockConfirm` PR을 `c.supplierId`(풀 스톤 소유 벤더)에 자동 발행 → 벤더 "재고 있음" 확인 → `lockCandidate`. 즉 기존 단일선택 흐름이 그대로 "선택→벤더확인→락"을 수행한다. (변경 불필요.)

## 5. 락 → 재고 동기화 (`lockCandidate` 수정)

`lockCandidate(diaId)` 끝에 추가:
- 후보에 `poolDiamondId`가 있으면 해당 풀 스톤 `availability="sold"`, `updatedAt` 갱신, audit("auto","pool",poolId,"sold").
- **같은 `poolDiamondId`를 참조하는 다른 주문의 미락 후보**(`locked!==true`, `orderId!==this.orderId`)를 `published=false`, `availability="sold"`로 무효화 → 한 물리 스톤 이중 판매 방지. 락 시점 first-come 규칙과 일치.

## 6. 벤더 풀 페이지 — `/supplier/pool`

- 라우트: `supplier/pool`, `RequireRole role="supplier"`. 신규 `src/pages/supplier/SupplierPool.jsx`.
- 로그인 벤더(`user.id`)의 풀만 표시(`listPoolDiamonds({ supplierId: user.id })`).
- 구성: 인벤토리 테이블(스톤 `shape carat`·4C·인증 `certOrg igiNo`·원가 `usd`·재고상태 토글·사진 수) + 신규 추가 폼(AdminDiamonds 폼 구조 + `MediaPicker` 재사용, growth·colorTreatment 필드 포함) + 인라인 수정(원가·재고상태) + 아카이브 버튼.
- 재고 토글: `available ↔ unavailable` (sold는 락 자동 또는 명시적 액션). `setPoolAvailability`.
- `SupplierQueue` 상단에 "My Pool" 링크 추가.

## 7. 운영자 풀 오버사이트 — `/admin/pool`

- 라우트: `admin/pool`. 신규 `src/pages/admin/AdminPool.jsx`. 어드민 사이드바에 "Diamond Pool" 항목.
- 모든 벤더 풀 조회 + 벤더 필터 드롭다운(`listPoolDiamonds({ includeArchived: true })`).
- 전체 CRUD: 사진 추가·수정·삭제(`MediaPicker`), 필드 수정, 아카이브/복원 토글, 원가 표시.
- 기존 AdminDiamonds(B2C 쇼케이스)는 그대로 유지.

## 8. 스토어 함수 (`store.js`)

- `listPoolDiamonds({ supplierId, includeArchived } = {})` — supplierId 지정 시 해당 벤더만, includeArchived false면 archived 제외.
- `getPoolDiamond(id)`.
- `savePoolDiamond(stone)` — id 있으면 머지 수정(updatedAt 갱신), 없으면 `POOL-` 신규 + 기본값(availability:"available", archived:false, media:[], createdAt). audit.
- `archivePoolDiamond(id, archived=true)` — soft delete/복원.
- `setPoolAvailability(id, availability)`.
- `matchPoolForOrder(prefs)`, `autoMatchFromPool(order, intake)` (§3·§4).
- 권한은 호출부에서 supplierId 스코프로 강제(벤더 페이지는 항상 `user.id` 전달).

## 9. 시드 / DB 버전 / i18n

- **DB 키 `lumina-db-v10` → `lumina-db-v11`**, `db()`에 v10 removal 추가.
- `isValidDB`에 `&& Array.isArray(d.poolDiamonds)` 추가. **시드에 반드시 `poolDiamonds` 포함**(없으면 매 로드 재시드 — 프로젝트 기존 함정).
- 시드: 기본 벤더(`settings.defaultSupplierId`)에 샘플 풀 스톤 6~8개 — 라운드/오벌 등 셰이프·캐럿(1.0~2.0)·등급(D~G, IF~VS2) 다양화 + media에 기존 `/assets/lab-diamond-tweezers.png` 사용 → 데모에서 1.5ct E/VS1 라운드 인테이크가 자동매칭되도록.
- `opsStrings.js`에 벤더 풀(`supplierPool`)·어드민 풀(`admin.pool`) 문자열 4개 언어(en/ko/zh/es).

## 10. 테스트 (`src/lib/__tests__/`)

- 등급 순서 헬퍼 + `poolStoneMatches`: 셰이프 불일치 제외, 등급 이상만 통과, 캐럿 범위 경계, growth 불일치 제외.
- `matchPoolForOrder`: archived·sold·unavailable·비활성 벤더 제외, 캡(limit) 적용, 정렬 순서.
- `autoMatchFromPool`: 솔리테어 인테이크에 published 후보 생성(벤치마크 자동가), 매칭 0건이면 후보 0 + 폴백 `diamondCandidates` PR 발행 확인.
- `lockCandidate`: poolDiamondId 후보 락 → 풀 스톤 sold + 다른 주문 형제 후보 무효화.
- `listPoolDiamonds` 권한 스코프(supplierId 필터).

## 11. 범위 제외 (YAGNI)

- 다중선택 → 벤더 일괄 재고확인 → 하나 락 흐름(후속 스펙, ClientPortal·selectCandidate·stockConfirm 대폭 수정 필요, 병행 세션 충돌 위험).
- 인테이크 이후 벤더가 새로 올린 재고의 소급 재매칭(매칭은 제출 시점 1회).
- 풀 → B2C `/diamonds` 쇼케이스 노출.
- 크로스탭 실시간 동기화(앱 내 `useDBVersion` 반응성으로 충분).
