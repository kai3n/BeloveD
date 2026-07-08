# 인테이크 개편 — 멀티 총 캐럿 스텝 + 그레이드 Range 슬라이더

**날짜**: 2026-07-07
**상태**: 설계 승인됨 (사용자 확정)
**레퍼런스**: https://www.brilliance.com/ 필터 UI (컬러/클래리티 듀얼 핸들 range 슬라이더)

## 배경 / 목적

테니스 브레이슬릿·테니스 목걸이·이터니티 밴드 같은 멀티스톤 디자인은 "가운데 큰 다이아"가
없어서 현재 인테이크 위저드가 셰입/캐럿 스텝을 통째로 건너뛴다. 품질은 `"F-G / VS+"` 고정
문자열, 견적은 캐럿 1.0 고정이라 고객이 원하는 규모·품질을 표현할 방법이 없다.

변경 목표:

1. **모든 멀티 디자인**(테니스류 + 스터드·후프·파베밴드·스테이션 등)에 **총 캐럿(total carat)
   선택 스텝**을 신설한다 — 센터 캐럿 선택의 멀티 버전.
2. 다이아 퀄리티(컬러/클래리티)는 브릴리언스처럼 **듀얼 핸들 range 슬라이더**로 허용 범위를
   고르게 한다 — **솔리테어·멀티 모두** 적용. (BeloveD 모델 = 고객이 허용 범위를 주고 상담에서
   확정하는 RFQ 흐름과 자연스럽게 맞음)
3. 멀티 견적이 총 캐럿에 반응하도록 **멜리 $/ct 단가**를 신설한다.

## 확정된 결정 사항 (Q&A)

| 질문 | 결정 |
|---|---|
| 총 캐럿 스텝 적용 범위 | 모든 멀티(productLine="multi") 디자인 |
| range 슬라이더 적용 범위 | 솔리테어 + 멀티 모두 |
| 스케일 범위 | 랩다이아 현실 범위 — 컬러 D~H, 클래리티 FL/IF~SI1 (전체 GIA 스케일 아님) |
| 견적 반영 | 반영 — 멜리 $/ct 벤치마크 신설(어드민 수정 가능) |
| 플로우 배치(접근안) | 접근 1 — 멀티만 새 '스톤' 스텝, 솔리테어는 리뷰 화면 피커 제자리 교체 |

## 아키텍처

### 새 공용 상수 — `src/lib/gradeScale.js`

```js
export const COLOR_SCALE = ["H", "G", "F", "E", "D"];            // 왼쪽=낮음 → 오른쪽=D (브릴리언스와 동일 방향)
export const CLARITY_SCALE = ["SI1", "VS2", "VS1", "VVS2", "VVS1", "IF-FL"]; // IF-FL은 한 눈금으로 묶음
```

- range 저장 형식: `["F", "D"]` — `[하한, 상한]` 그레이드 문자열 배열.
- 헬퍼: `clampGradeRange(scale, range)` (역전/스케일 밖 값 정규화),
  `formatGradeRange(range)` → `"F–D"`, 하한=상한이면 `"D"`.
- 순수 로직만 (React 의존 없음) — 유닛 테스트 대상.

### 새 피커 컴포넌트 — `src/components/intake/pickers.jsx`

- **`GradeRangeSlider`** — 듀얼 핸들 range 슬라이더.
  - props: `scale`(눈금 배열), `value`([min,max]), `onChange`, `ariaLabel`.
  - 트랙 위 두 핸들, 선택 구간 하이라이트, 눈금 라벨은 트랙 아래(브릴리언스 문법).
  - 눈금 스냅(연속값 아님), 키보드 조작 가능(핸들별 좌우 화살표), 핸들 교차 시 스왑이 아니라 클램프.
  - 기존 gflow 디자인 토큰/클래스 문법(`gflow-*`)을 따른다.
- **`TotalCaratSlider`** — 기존 `CaratSlider`의 비주얼 문법(리드아웃 + 레인지 인풋) 재사용,
  리드아웃은 `"5.00 ct total"` 형태(스톤 원 크기 비주얼은 총 캐럿에 부적합하므로 제외),
  `min/max/step`은 카테고리별 props.

### 플로우 변화 — `src/pages/IntakeForm.jsx`

- `screenList`:
  - 솔리테어: `category → design → metal → shape → carat → inspiration → (contact) → review` (불변)
  - 멀티: `category → design → metal → **stones** → inspiration → (contact) → review` (스톤 스텝 신설)
- **멀티 '스톤' 스텝** 한 화면 구성: 총 캐럿 슬라이더 + 컬러 `GradeRangeSlider` + 클래리티
  `GradeRangeSlider`. 교육 패널은 기존 `StoneEduPanel field="carat"` 콘텐츠를 재사용해 동일
  레이아웃으로 배치한다(멀티 전용 교육 콘텐츠 신설은 비범위).
- **솔리테어 리뷰 화면**: 컬러/클래리티 단일값 `ScalePicker` 2개를 `GradeRangeSlider` 2개로 교체
  (위치 불변).

### 기본값

| 항목 | 기본값 |
|---|---|
| 솔리테어 컬러 | `["F", "D"]` |
| 솔리테어 클래리티 | `["VS1", "IF-FL"]` |
| 멀티 컬러 | `["G", "E"]` |
| 멀티 클래리티 | `["VS2", "VVS1"]` |
| 총 캐럿 — ring(이터니티/파베밴드) | 0.5–5ct, step 0.25, 기본 1.5 |
| 총 캐럿 — bangle(테니스 브레이슬릿 등) | 1–15ct, step 0.5, 기본 5 |
| 총 캐럿 — necklace(테니스 목걸이 등) | 2–25ct, step 0.5, 기본 10 |
| 총 캐럿 — earrings(스터드/후프, 페어 합계) | 0.5–6ct, step 0.25, 기본 2 |

- 쇼케이스 다이아(`?diamond=`)에서 진입해 단일 color/clarity가 프리필되는 경우: 해당 값을
  하한=상한 range로 변환해 시드한다.

### 데이터 모델 — `src/lib/intakePayload.js`, form state

- `form.stonePrefs` (솔리테어): `color`/`clarity` 단일 필드 → `colorRange`/`clarityRange`
  `[min,max]` 배열로 교체.
- `form.multiSpec` (멀티): `totalCarat`(number), `colorRange`, `clarityRange` 추가.
  - `standard` 필드는 자유입력이 아니라 range에서 파생한 라벨(`"G–E / VS2–VVS1"`)로 채운다 —
    `DEFAULT_MULTI_STANDARD("F-G / VS+")` 폴백은 range 누락 시에만.
  - `meleeSpec`/`overallDims`/`arrangement`는 유지(어드민 상담 확정용).
- **하위 호환**: 서버에 이미 저장된 인테이크는 단일값 `color: "E"` 형태 — 표시 계층(ops 요약,
  어드민 상세)은 문자열이면 그대로, 배열이면 `formatGradeRange`로 처리한다. 마이그레이션 없음.
- **localStorage 드래프트**: 새 필드 없는 기존 드래프트 로드 시 기본값 주입(기존 draft 병합
  패턴 그대로).

### 견적 — `src/lib/quoteEstimate.js` + 설정

- `settings.meleeUsdPerCt` 신설 — 기본 **$150/ct**. 시드(`seed.js`) + 기존 스토어 마이그레이션
  (설정 키 없으면 주입).
- 멀티 견적: `carat = multiSpec.totalCarat`, `benchmarkUsdPerCt = settings.meleeUsdPerCt`,
  기존 `multiplier` 적용. (현행: carat 1.0 + 센터스톤 벤치마크 → 대체)
- 퀄리티 range는 견적에 **미반영** — 상담·확정 제안에서 오퍼레이터가 확정. 견적 카드에
  "선택하신 퀄리티 범위 기준으로 상담에서 확정됩니다" 취지 한 줄 표기(4개 언어).
- 어드민: `AdminBenchmark` 페이지에 멜리 $/ct 편집 필드 추가 →
  `pushSettingsToServer({ meleeUsdPerCt })`.

### 표시/요약 업데이트

- **리뷰 화면**: 멀티도 스톤 요약 카드 표시 — `"5.00 ct total · G–E · VS2–VVS1 · CVD · IGI"` 형식.
- **`src/lib/ops.js` 인테이크 요약**: multiSpec 요약에 totalCarat + range 라벨 포함.
- **접수 이메일**: 스톤 스펙 라인에 동일 라벨 사용(요약 빌더 공용화).
- **어드민 콘솔 인테이크 상세**: 동일.

### i18n

- 고객 노출 문구(`translations.js` gflow): 스톤 스텝 질문/힌트, "total carat" 라벨, 컬러/클래리티
  range 라벨, 견적 카드 문구 — **EN/KO/ZH/ES 4개 언어 전부**.
- 어드민 문구(`opsStrings.js`): 멜리 단가 라벨 등 4개 언어.

### 테스트

- `gradeScale` 유닛: clamp/format/역전 입력.
- `intakePayload` 확장: 멀티 페이로드에 totalCarat/colorRange/clarityRange, standard 파생 라벨,
  솔리테어 range 직렬화, 레거시 단일값 호환.
- `quoteEstimate`: 멀티 견적 = 총캐럿 × 멜리단가 × 마진, 설정 폴백.

## 에러 처리 / 엣지

- range 역전·스케일 밖 값 → `clampGradeRange`로 정규화 (제출 전 검증 포함).
- totalCarat이 카테고리 범위 밖(드래프트 복원·URL 진입) → 카테고리 기본값으로 리셋.
- 카테고리 변경 시 totalCarat이 새 카테고리 범위 밖이면 새 기본값으로 리셋.

## 비범위 (YAGNI)

- 퀄리티 range의 견적 가격 반영 (상담 확정으로 충분)
- 커트/폴리시 등 추가 4C 필터
- 기저장 인테이크 데이터 마이그레이션 (표시 계층 호환으로 처리)
