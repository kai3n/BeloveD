# 런칭 세일 — LAUNCH25 쿠폰 + 상단 할인 배너 + 어드민 관리 섹션

**날짜**: 2026-07-07
**상태**: 설계 승인됨 (사용자 확정)
**레퍼런스**: https://www.brilliance.com/ 상단 고지 배너
("4th of July Sale: 25% Off Lab Diamond Rings & Jewelry | Code: AMERICA" — 다크 바 + 코드 밑줄)

## 배경 / 목적

런칭 기념 25% 할인 캠페인. 세 가지 산출물:

1. **쿠폰 코드 `LAUNCH25`** — 25% 총액 할인 (기존 쿠폰 시스템에 추가).
2. **공개 사이트 최상단 할인 배너** — 브릴리언스식 풀폭 다크 바, 모든 페이지 헤더 위.
3. **어드민 관리 섹션** — 배너 온/오프, 문구(4개 언어), 표시 코드 편집.

## 확정된 결정 사항 (Q&A)

| 질문 | 결정 |
|---|---|
| 쿠폰 코드 이름 | `LAUNCH25` |
| 배너 문구 관리 | 4개 언어(EN/KO/ZH/ES) 각각, 빈 언어는 EN 폴백 |

## 아키텍처

### 쿠폰 — `src/lib/coupons.js` + 스토어 시드

- `BASE_COUPONS`에 추가: `{ code: "LAUNCH25", kind: "percent", value: 25, labelKey: "launch", expiresAt: null }`.
- **기존 스토어 주입**: 이미 운영 중인 스토어에는 `BASE_COUPONS` 변경이 반영되지 않으므로,
  `store.js`의 기존 시드 마이그레이션 패턴(버전 플래그, 예: `launchCouponSeedVersion`)으로
  `settings.coupons`에 LAUNCH25가 없으면 append. 어드민이 이후 수정/삭제하면 다시 주입하지
  않도록 버전 플래그로만 1회 실행.
- 쿠폰 라벨 `launch`("런칭 기념" 취지) — `opsStrings.js` 4개 언어.
- 적용 로직은 기존 `applyCoupon`(percent) 그대로 — 신규 코드가 견적·인테이크 쿠폰 입력에서
  즉시 동작. 최종 검증은 기존 규칙대로 오퍼레이터가 확정 제안에서 수행.

### 배너 설정 — `settings.saleBanner`

```js
saleBanner: {
  enabled: true,            // 런칭 세일 즉시 노출로 시드
  code: "LAUNCH25",         // 표시용 코드 (쿠폰 카탈로그와 별개 필드 — 배너에 보여줄 문자열)
  copy: { en: "...", ko: "...", zh: "...", es: "..." },
}
```

- 시드 기본 문구:
  - EN: `Launch Sale: 25% Off All Lab Diamond Jewelry`
  - KO: `런칭 세일: 랩다이아 주얼리 전 품목 25% 할인`
  - ZH: `开业特惠：培育钻石珠宝全场 75 折`
  - ES: `Oferta de lanzamiento: 25% de descuento en toda la joyería`
  - 코드 표기는 문구와 별개로 배너가 `| Code: LAUNCH25` 형태로 이어 붙인다(코드 필드 비면 생략).
- 기존 스토어에는 설정 키 마이그레이션(키 없으면 시드값 주입)으로 배포.
- 배포 채널: 어드민 저장 시 `pushSettingsToServer({ saleBanner })` — 기존 설정 write-through로
  전 고객 배포(쿠폰·결제 설정과 동일 채널).

### 공개 배너 — `src/Layout.jsx`

- 헤더 **위** 풀폭 바. 브릴리언스처럼 다크 바탕 + 흰 글씨 — NOIR(다크)·Gallery White(데이) 양
  테마에서 동일하게 보이도록 고정 다크 토큰 사용(테마 반전 없음).
- 내용: `{현재 로케일 문구}` + `Code: LAUNCH25`(밑줄 강조). 로케일 문구 비면 EN 폴백, EN도
  비면(또는 `enabled: false`) 배너 렌더 안 함.
- 클릭 시 주문 시작(스타일 카탈로그 라우트)으로 이동 — 배너 전체가 링크.
- 스티키 헤더가 있으면 배너 높이만큼 오프셋 보정(레이아웃 밀림 없이). 모바일에서 문구가 길면
  줄바꿈 허용(고정 높이 아님).
- 데모(GitHub Pages) 모드에서도 로컬 시드 설정으로 동일 동작.

### 어드민 섹션 — `src/pages/admin/AdminCoupons.jsx`

- 쿠폰 페이지 **상단에 "세일 배너" 섹션 신설** (배너와 쿠폰은 한 캠페인 묶음이라 이 페이지에
  배치). 어드민 콘솔 디자인 시스템(`con-*` 클래스, ConsoleHead/StatStrip 문법) 준수.
- 구성: 온/오프 토글, 표시 코드 입력 1칸, 언어별 문구 입력 4칸(EN/KO/ZH/ES), 저장 버튼.
- 저장 → 로컬 스토어 갱신 + `pushSettingsToServer({ saleBanner })`.
- 어드민 문구(`opsStrings.js`) 4개 언어 추가.

### 테스트

- 쿠폰: LAUNCH25 시드 주입(1회성 버전 플래그) + `applyCoupon` percent 25 검증.
- 배너 로케일 폴백 로직(현재 로케일 → EN → 숨김) 유닛 테스트 가능하게 순수 헬퍼로 분리
  (`resolveBannerCopy(saleBanner, locale)` 등).

## 에러 처리 / 엣지

- `saleBanner` 설정 자체가 없는 클라이언트(구 캐시) → 배너 미표시 (옵셔널 체이닝).
- 코드 필드가 쿠폰 카탈로그에 없는 코드여도 배너는 표시(표시용 필드) — 어드민 책임. 단
  어드민 섹션에 "쿠폰 카탈로그에 없는 코드" 경고 힌트 표시.
- XSS: 문구는 텍스트 노드로만 렌더(HTML 삽입 없음).

## 비범위 (YAGNI)

- 배너 스케줄링(시작/종료 일시 자동화) — 어드민 수동 온/오프로 충분
- 고객별/세그먼트별 배너, 다중 배너 로테이션
- 자동 쿠폰 적용(배너 클릭 시 쿠폰 자동 입력) — 추후 개선 후보
