# 링 사이즈 도움말 패널 (Ring Size Help)

날짜: 2026-06-13 / 상태: **확정** (브레인스토밍 세션에서 사용자 승인)
배경: 인테이크 위저드 1단계('제품')의 "링 사이즈" 입력은 고객이 자기 치수를 모르면 막막하다. 다이아 교육 패널(`StoneEduPanel`)처럼 측정 방법(손가락 그림)과 사이즈 환산표를 보여주는 도움말 패널을 붙인다.

## 0. 확정된 결정 (브레인스토밍)

| 결정 | 선택 |
|---|---|
| 표시 방식 | 다이아 교육 패널과 동일 — 데스크톱 우측 사이드패널 / 모바일 인라인 |
| 환산표 기준 | US 사이즈 · 안둘레(mm) · 안지름(mm) |
| 노출 조건 | 위저드 1단계 + `category === "ring"` |
| 범위 | 링만 (목걸이 길이·팔찌 둘레 헬퍼는 추후), 표시 전용(스토어·테스트 무변경) |

## 1. 컴포넌트 — `src/components/RingSizeHelp.jsx`

- `StoneEduPanel`과 동일한 `.stone-edu-panel` 클래스 사용(다크 테마·레이아웃 일관).
- 구성:
  - kicker: `ringHelp.kicker` ("반지 사이즈 가이드")
  - 제목: `ringHelp.title`
  - **SVG 측정 그림**: 손가락 단면(원) + 안지름 캘리퍼(양쪽 화살표) + 반지 밴드 링. `currentColor`/CSS 변수 기반(다크 테마 자동).
  - 측정 방법 2줄: `ringHelp.how1`(잘 맞는 반지의 안지름 측정), `ringHelp.how2`(손가락에 실을 감아 둘레 측정 후 표와 대조).
  - **환산표**: 헤더(US / 둘레(mm) / 지름(mm)) + 4~11호 행. 숫자는 컴포넌트 상수(만국 공통).
- 표시 전용, props 없음.

사이즈 상수(US, 안지름 mm, 안둘레 mm):
```
4:14.9/46.8  5:15.7/49.3  6:16.5/51.9  7:17.3/54.4
8:18.2/57.2  9:19.0/59.5  10:19.8/62.3  11:20.7/65.0
```

## 2. IntakeForm 통합

- `showRingHelp = cat === "ring" && step === 0` 파생값 추가.
- 기존 `showEdu`(스톤, step===1)와 함께 레이아웃을 일반화: `const sidePanel = showEdu ? "stone" : showRingHelp ? "ring" : null;`
  - 페이지 폭: `sidePanel ? 1020 : 680`
  - `intake-layout ${sidePanel ? "has-edu" : ""}`
  - aside: `sidePanel === "stone"` → `<StoneEduPanel>`, `"ring"` → `<RingSizeHelp>`
- Step 1(제품)의 링 사이즈 필드 아래에 `.stone-edu-inline`(모바일용)으로 `<RingSizeHelp>` 1개 — 단, `cat === "ring"`일 때만. (스톤 인라인은 step 2에 그대로.)
- 기존 stone-edu-aside/inline CSS 그대로 재사용(추가 CSS 없음).

## 3. i18n — `intake.ringHelp` (4개 언어)

`{ kicker, title, how1, how2, colUs, colCirc, colDia }`. en/ko/zh/es. 사이즈 숫자는 코드 상수라 번역 불필요.

## 4. 검증

표시 전용 — 빌드 + 브라우저(데스크톱 사이드 / 모바일 인라인, 링 카테고리에서만 노출, 다른 카테고리에선 미노출) 확인. 콘솔 에러 0.
