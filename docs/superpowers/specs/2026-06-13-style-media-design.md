# 스타일 사진/영상 (커버 + 갤러리)

날짜: 2026-06-13 / 상태: **확정** (브레인스토밍 세션에서 사용자 승인)
배경: 어드민 스타일 라이브러리(`/admin/styles`)에 사진/영상을 올리는 UI가 없어, 새 스타일이 전부 하드코딩 placeholder 이미지로 표시된다. 카탈로그의 실제 사진은 시드 데이터뿐. MediaPicker로 커버+갤러리 입력을 붙이고, 갤러리를 볼 수 있는 경량 스타일 상세 페이지를 추가한다.

## 0. 확정된 결정
| 결정 | 선택 |
|---|---|
| 범위 | 커버 1장 + 여러 장 갤러리, 추가/수정 모두 |
| 표시 | 신규 스타일 상세 `/styles/:id`(갤러리+CTA), 카드 클릭 → 상세 |

## 1. 어드민 (`AdminOpsStyles.jsx`)
- "스타일 추가" 폼에 `<MediaPicker>` 추가. 제출 시 `coverImage = media[0]?.src || 기본`, `media`, `mediaComplete = media.length > 0`. 기존 하드코딩 `coverImage` 제거.
- 각 스타일 행에 "미디어" 버튼 → 인라인 `<MediaPicker>` 패널로 기존 스타일 커버·갤러리 교체(AdminPool 사진편집 패턴): 저장 시 `saveOpsStyle({ id, media, coverImage: media[0]?.src, mediaComplete })`.

## 2. 스타일 상세 (`src/pages/StyleDetail.jsx`, route `styles/:id`)
- `getOpsStyle(id)`. 미디어 목록 = `style.media?.length ? style.media : [{ kind: coverImage.endsWith(".mp4")?"video":"image", src: coverImage }]`.
- `.detail-layout` 재사용: 메인 `MediaThumb` + 1개 초과면 `.thumb-row` 썸네일(DiamondDetail 패턴). 정보(이름·ID·카테고리·중량·리드) + `이 스타일로 시작`(→`/custom/new?style=ID`) + 목록으로(→`/styles`). 미공개/없음이면 not-found 문구.

## 3. 카탈로그 (`StyleCatalog.jsx`)
- 카드 `to`를 `/custom/new?style=ID` → `/styles/ID`로 변경(상세 경유).

## 4. store / i18n
- `saveOpsStyle`은 임의 필드 머지 — 변경 없음. `getOpsStyle` 기존.
- i18n: `opsA.styles`에 `media`/`save` 2개(4언어). 상세 CTA·뒤로는 기존 `styleCat.start`·`detail.back` 재사용.

## 5. 검증
표시/입력 위주 — 빌드 + 브라우저(어드민 미디어 추가·편집 → 카탈로그 카드 → 상세 갤러리 → 주문 시작). 콘솔 에러 0. 스토어 테스트 무변경.
