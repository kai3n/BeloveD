# 센터스톤 교육 사이드 패널 (Stone Education Panel)

날짜: 2026-06-12 / 상태: **확정** (브레인스토밍 세션에서 사용자 승인)
배경: 인테이크 폼의 "Center stone preferences" 8개 필드(Shape·Carat·Color·Clarity·Growth·Lab·Fluorescence·L/W)는 일반 고객에게 생소한 보석 용어다. Blue Nile(필터 ⓘ 팝오버 + 등급 스케일 그래픽)·Rare Carat(상세 페이지 체크리스트 + 스케일 위 현재 위치 표시) 패턴을 참고해, **포커스된 필드의 의미를 그래픽과 함께 설명하는 교육 박스**를 폼 옆에 붙인다. 업계 표준대로 등급별 실사 사진이 아닌 **SVG 일러스트**를 쓴다(라이선스·톤 일관성·로딩 문제 없음).

## 0. 확정된 결정 (브레인스토밍)

| 결정 | 선택 | 비고 |
|---|---|---|
| 표시 방식 | 포커스 연동 사이드 패널 | 필드 포커스 시 우측 고정 패널 내용 전환. Blue Nile 검색 UI 유사 |
| 비주얼 | SVG 일러스트 (코드 렌더링) | 실사 조달 안 함. NOIR 다크 테마 일치, 현재 선택값 하이라이트 |
| 적용 범위 | 인테이크 폼만 | /diamonds·DiamondDetail·가이드 연결은 반응 보고 확장 (YAGNI) |
| 콘텐츠 톤 | 교육 + 구매 가이드 | 중립 서술 + "스윗 스팟" 가이드 1문장. 기존 bigStoneNote와 톤 일치 |
| 언어 | EN/中文/KO/ES 4개 전부 | 프로젝트 불변 규칙 |

## 1. 레이아웃 & 동작

- `productLine=solitaire`일 때만 패널 존재 (멀티스톤은 해당 없음).
- 페이지 폭 680 → ~980px 확장. 폼 본체(~680) + 패널(~280) 가로 배치, 패널은 `position: sticky`로 스크롤 따라옴.
- `eduField` 상태(초기값 `"shape"`)를 IntakeForm이 보유. 센터스톤 필드 각각의 `onFocus`로 갱신.
- 값 변경 시 패널 그래픽 하이라이트 즉시 반영 (예: Color E→F 선택 시 스케일 마커 이동) — `prefs`를 그대로 prop으로 전달.
- **모바일/좁은 화면**: 사이드 공간이 없으므로 같은 박스를 센터스톤 그리드 바로 아래 인라인 렌더링 (CSS 미디어 쿼리로 배치 전환, 컴포넌트는 1개).

## 2. 필드별 콘텐츠 (8종)

| 필드 | SVG 비주얼 | 가이드 방향 (EN 기준, 4개 언어 작성) |
|---|---|---|
| shape | 선택 셰이프 외곽선+패셋 라인 크게, 나머지 미니 아이콘 행 | Round = 최대 브릴리언스, 팬시 셰이프는 같은 캐럿에 더 커 보임 |
| carat | 0.5/1/1.5/2/3 ct 상대 크기 원 + 내 캐럿 하이라이트 | 1 ct = 0.2 g, 정면 크기는 무게보다 천천히 커짐. 2 ct↑는 bigStoneNote 연계 |
| color | 다이아 글리프 D→J 점진 웜톤 그라데이션 + ▲ 현재 선택 | D–F 무색 / G–J 준무색. "E reads icy white with no warm tint" |
| clarity | 돋보기 원 IF→VS2, 내포물 점 증가 + 현재 선택 | VS1 = eye-clean 스윗 스팟 |
| growth | CVD(레이어 성장) vs HPHT(프레스) 미니 다이어그램 | 둘 다 진짜 다이아몬드. 2 ct↑는 CVD 권장 (bigStoneNote와 일치) |
| lab | 인증서 + 거들 레이저 각인 아이콘 | IGI가 랩다이아 대부분 감정, 각인이 리포트와 매칭 |
| fluorescence | UV 글로우 강도 3단계(None/Faint/Medium) 다이아 | None–Faint면 어떤 조명에서도 아이시 화이트 유지 |
| lwRatio | 1.0 / 1.35 / 1.5 비율 오벌 외곽선 비교 | 오벌 클래식 = 1.30–1.50, 라운드 = 1.0 |

## 3. 구조

- **새 컴포넌트** `src/components/StoneEducation.jsx`
  - `<StoneEduPanel field={eduField} prefs={form.stonePrefs} />` — 표시 전용, 상태 없음. 추후 다른 페이지 재사용 가능.
  - 내부에 필드별 SVG 서브컴포넌트 (ColorScale, ClarityScale, ShapeGallery, CaratCircles, GrowthDiagram, LabBadge, FluorGlow, RatioOutlines).
  - SVG는 `currentColor`/CSS 변수 기반으로 다크 테마 자동 일치.
- **문자열** `src/opsStrings.js`에 `stoneEdu` 섹션 추가 — 언어별 × 필드별 `{ title, body, guide }`. 데이터(등급 키 D/E/F…)는 키 기반, 문장만 번역.
- **IntakeForm 변경 최소화**: `eduField` useState 1개 + 각 필드 onFocus + 레이아웃 래퍼 div. 제출 payload·스토어·검증 로직 변경 없음.
- **CSS**: `styles.css`에 `.stone-edu-*` 클래스 + 미디어 쿼리 (사이드 ↔ 인라인 전환).

## 4. 테스트

- 4개 언어 `stoneEdu` 키 파리티 테스트 (en/zh/ko/es 구조 동일성) — 기존 문자열 테스트 패턴 따름.
- `<StoneEduPanel>` 스모크: field prop 8종 각각에 해당 섹션 제목이 렌더되는지, prefs 하이라이트(예: color="E"에 마커)가 반영되는지.

## 5. 범위 제외

- /diamonds 필터·DiamondDetail·/guide/4c 연결 없음 (확장 후보로만 기록).
- 실사 사진 에셋 추가 없음.
- Cut 등급 설명 없음 — 현재 폼에 Cut 필드가 없음 (벤치마크가 Ideal/EX 고정).
