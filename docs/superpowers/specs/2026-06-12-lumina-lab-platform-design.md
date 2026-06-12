# LUMINA LAB — 랩그로운 다이아몬드 커스텀 주얼리 플랫폼 디자인 문서

날짜: 2026-06-12
상태: **확정** (2026-06-12 사용자 컨펌 — 디자인 1 / 커스텀 주문 마켓플레이스 구조)

> 구현 노트: MVP는 **프론트엔드 프로토타입**으로 먼저 구축한다 — 전 화면(스토어프론트·벤더 포털·어드민)을 mock 데이터 스토어(localStorage) 위에 구현하여 전체 플로우를 클릭 가능한 상태로 만든 뒤, Supabase(백엔드)·Stripe(결제) 연동은 후속 플랜으로 진행. 샘플 사진은 기존 `public/assets/` 자산(jewelry-lineup.png 크롭, lab-diamond-tweezers.png, 히어로 영상)을 재사용한다. 신규 페이지 카피는 KO 우선, 다국어 확장은 후속 콘텐츠 태스크.

## 1. 개요

랩그로운 다이아몬드 악세사리를 판매하는 럭셔리 웹앱. 두 축으로 구성된다:

1. **럭셔리 브랜드 경험** — Blue Nile·Tiffany급 비주얼, 다이아몬드가 주인공인 영상 히어로 (디자인 확정 완료)
2. **벤더 중개형 주문제작 마켓플레이스** — 고객이 템플릿 기반으로 커스텀 주문을 제출하면, 익명화된 벤더가 시안(사진·영상)을 올리고, 고객 컨펌 → 디파짓 결제 → 제작 → 배송으로 이어지는 구조

벤치마크: Blue Nile (필터·링빌더·교육 콘텐츠·360° 뷰어), Rare Carat (딜 평가·비교·투명한 가격), 기존 codex 시안 (정보 구조).

## 2. 확정된 비주얼 디자인

브레인스토밍을 통해 확정된 사항 (시안 파일: `.superpowers/brainstorm/*/content/hero-3designs.html` 디자인 1):

| 항목 | 확정안 |
|---|---|
| 테마 | NOIR — 순수 블랙(#000~#0d0d0d) 바탕, 다이아몬드만 빛나는 구성 |
| 히어로 | **NOIR v2 센터드** (2026-06-12 변경 확정): 풀스크린 화이트 다이아몬드 매크로 영상 + 중앙 정렬 카피 "GROWN, *not mined.*" + 비네팅 + SCROLL. (기존 에디토리얼 레프트안 대체 — 사용자가 v2 센터드안을 "다이아 선명도/빛깔만 흰색이면 매우 마음에 듦"으로 재확정) |
| 히어로 영상 | `public/assets/diamond-noir-white.mp4` — diamond-noir.mp4를 화이트 그레이딩(노란 캐스트 제거, 미드톤 리프트, 디노이즈→1080p 업스케일→샤프닝)한 13s 핑퐁 루프, 5.8MB. 포스터: `diamond-noir-white-poster.png`. 추후 4K 실사 화이트 다이아 매크로 촬영본으로 교체 가능한 슬롯 구조 |
| 헤드라인 카피 (KO) | "GROWN, not mined." (영문 고정) + 서브 "지구를 캐지 않은, 완벽한 다이아몬드" |
| 서브 카피 (KO) | "천연과 동일한 물성 · IGI 인증 · 절반의 가격" |
| 폰트 | 한국어 헤드라인: **Song Myung** / 본문: Noto Sans KR / 영문 브랜드·헤드라인: **Cormorant Garamond** / 중국어: Noto Serif SC / 스페인어: Cormorant Garamond |
| 포인트 컬러 | 샴페인 골드 `#d6c5a0` (CTA·강조), 아이보리 `#f7f5f0` (텍스트) |
| 모션 | 영상 비네팅(주변 암전), 스파클 트윙클, fadeUp 순차 등장, 카드 호버 리프트 |
| 모바일 | 동일 영상을 세로 크롭(object-position 62%), 카피 상단·CTA 하단 풀폭 버튼 |
| CTA | "다이아몬드 쇼핑하기" (골드 솔리드) / "나만의 링 세팅" (고스트) |

## 3. 사용자 역할과 익명성 원칙

### 역할
- **고객(Customer)**: 템플릿 탐색, 커스텀 주문 제출, 시안 컨펌, 결제, 주문·배송 조회
- **벤더(Vendor)**: 익명화된 주문 요청 열람, 시안(사진·영상) 업로드, 제작 상태 업데이트
- **운영자(Admin)**: 다이아몬드 가격 직접 조정, 미디어 수동 업로드, 템플릿 관리, 벤더 관리, 전체 주문 감독

### 익명성 원칙 (핵심 비즈니스 규칙)
- 벤더와 고객은 **어떤 경로로도 직접 대화할 수 없다.** 채팅·연락처·자유 텍스트 교환 금지.
- 벤더에게 고객은 `주문 #1024` 같은 익명 ID로만 보인다. 이름·연락처·주소 등 PII는 벤더에게 절대 노출되지 않는다 (배송 라벨은 운영자/시스템이 생성).
- 고객에게 벤더는 노출되지 않는다 (브랜드가 직접 제작하는 것처럼 보임).
- 소통은 **구조화된 데이터만**: 고객 → 주문 폼 + 시안별 피드백 폼(선택지 + 제한된 텍스트), 벤더 → 시안 업로드 + 상태 업데이트. 피드백 텍스트는 연락처 패턴(전화번호·이메일·URL·SNS ID) 자동 마스킹.
- 벤더는 고객이 컨펌할 때까지 시안을 계속 업로드해야 한다 (리비전 횟수 제한 없음, 응답 SLA는 §10).

## 4. 핵심 플로우 — 커스텀 주문 상태머신

```
DRAFT → SUBMITTED → VENDOR_ASSIGNED → PROPOSAL_UPLOADED ⇄ REVISION_REQUESTED
                                            ↓ (고객 컨펌)
                                       CONFIRMED → DEPOSIT_PAID → IN_PRODUCTION
                                            ↓                        ↓
                                       (미결제 만료)            QUALITY_CHECK
                                                                     ↓
                                                            FINAL_PAYMENT_PAID
                                                                     ↓
                                              SHIPPED → DELIVERED → COMPLETED
취소: SUBMITTED~CONFIRMED 사이 고객 취소 가능. DEPOSIT_PAID 이후는 운영자 승인 필요.
```

1. **고객**: 템플릿/샘플 디자인 선택 → 세부사항 입력(금속, 캐럿, 사이즈, 각인, 예산, 참고 이미지 첨부) → 제출
2. **운영자**: 벤더 배정 (초기: 수동 배정, 추후 자동 라우팅)
3. **벤더**: 익명 요청 확인 → 시안 사진/영상 업로드 (여러 개, 버전 관리)
4. **고객**: 시안 검토 → 컨펌 또는 수정 요청(구조화 피드백) → (3↔4 반복)
5. **컨펌** → 디파짓 결제 (총액의 X%, 운영자 설정값, 기본 30%) → 제작 시작
6. 제작 단계 업데이트(벤더) → 검수(운영자) → 잔금 결제 → 배송 (단계별 트래킹) → 수령 확인

## 5. 기능 명세

### 5.1 고객 (Storefront)
- **홈**: 확정 히어로 + 컬렉션 섹션 + 베스트셀러(가격 표시) + 랩다이아 스토리(핀셋 영상) + 커스텀 주문 안내 + 푸터
- **다이아몬드 검색** (Blue Nile/RareCarat 벤치마크): 필터 — 쉐입(라운드·오벌·프린세스 등 10종) / 캐럿 / 컷 / 컬러 / 클래리티 / 가격 슬라이더 / 인증기관(IGI·GIA). 정렬: 가격·캐럿·신상품. 그리드 + 리스트 뷰
- **다이아몬드 상세**: 360°/영상 뷰어(운영자 업로드 미디어), 4C 스펙 테이블, 인증서 뷰어/다운로드, 가격, "이 다이아로 커스텀 주문" CTA
- **템플릿 갤러리**: 우리가 만든 샘플 디자인(링·목걸이·이어링·팔찌) 카드 그리드, 카테고리·스타일 필터
- **커스텀 주문 위저드** (핵심): ① 템플릿 선택 → ② 다이아몬드 선택(검색 연동 또는 추천) → ③ 세부사항(금속/사이즈/각인/예산/참고이미지) → ④ 검토·제출
- **마이페이지**: 주문 내역(상태 타임라인), 시안 검토함(미디어 갤러리 + 컨펌/수정요청 버튼), 결제 내역, 배송 추적(단계 표시: 제작중→검수→배송준비→배송중→배송완료), 위시리스트, 프로필
- **교육 콘텐츠**: 랩다이아몬드란? / 4C 가이드 (Phase 1은 정적 페이지 2개)
- **결제**: 디파짓·잔금 분리 결제. Stripe (KRW·USD·CNY·EUR 다통화) — 토스페이먼츠는 Phase 2
- **로그인/회원가입**: 이메일+비밀번호, Google OAuth. 비로그인 탐색 가능, 주문 제출 시 로그인 요구

### 5.2 벤더 포털 (`/vendor`)
- 벤더 계정 로그인 (운영자가 발급)
- **요청 큐**: 배정된 익명 주문 목록 (신규/진행중/컨펌됨/제작중 탭, 미응답 시간 표시)
- **주문 상세**: 템플릿·다이아 스펙·고객 요구사항 (PII 제외 전부) + 참고 이미지
- **시안 업로드**: 사진(최대 10장)·영상(최대 3개, 500MB) 업로드, 버전 라벨, 코멘트(연락처 마스킹 적용)
- **피드백 열람**: 고객 수정 요청 내용 확인 → 새 시안 업로드 (컨펌까지 반복)
- **제작 상태 업데이트**: IN_PRODUCTION 단계에서 진행 사진 업로드 + 단계 변경 요청

### 5.3 운영자 어드민 (`/admin`)
- **다이아몬드 인벤토리**: CRUD + **가격 직접 수정**(개별 입력 + 일괄 % 조정), 4C 스펙, 인증서 PDF 업로드, 공개/비공개 토글
- **미디어 관리**: 다이아·제품 사진/영상 **수동 업로드**, 히어로 영상 교체 슬롯
- **템플릿/샘플 디자인 관리**: CRUD, 카테고리, 노출 순서
- **주문 감독**: 전체 주문 조회, 벤더 배정/재배정, 상태 강제 변경, 시안·피드백 전체 열람(중재), 환불 처리
- **벤더 관리**: 계정 발급/정지, 성과 지표(평균 응답시간, 컨펌까지 리비전 수)
- **설정**: 디파짓 비율, 환율 표시 기준, 배송 단계 라벨

### 5.4 Phase 2로 미루는 것 (Non-goals for MVP)
기성품 장바구니 구매(커스텀만 우선), 다이아 비교함, 가격 알림, 리뷰, 가상 상담 예약, AI 추천, 토스페이먼츠, 다이아 도매 API 연동(Nivoda 등), 푸시/카카오 알림(이메일로 대체)

## 6. 다국어 (i18n)

- 지원 언어: **한국어(기본), English, 中文(简体), Español**
- 라이브러리: react-i18next + 언어별 JSON 리소스. URL 프리픽스 없이 헤더 셀렉터 + localStorage 저장 (SEO 프리렌더는 Phase 2)
- **네이티브 카피 원칙**: 직역 금지. 마케팅 카피는 언어별로 별도 작성. 예) KO "진짜 다이아몬드. 더 현명한 선택." / EN "Real diamond. Smarter choice." / ZH "真正的钻石，更明智之选。" / ES "Diamante real. La elección inteligente."
- **언어별 폰트 스택**: html lang 속성 기준으로 헤드라인 폰트 자동 전환 (KO: Song Myung / EN·ES: Cormorant Garamond / ZH: Noto Serif SC)
- 통화 표기: 언어별 기본 통화 표시(₩/$/¥/€), 결제는 Stripe 다통화

## 7. 데이터 모델 (Postgres)

```
users          (id, email, role[customer|vendor|admin], name, locale, created_at)
vendor_profiles(user_id, display_code, active, avg_response_hours)
diamonds       (id, shape, carat, cut, color, clarity, cert_org, cert_no, cert_pdf_url,
                price_krw, visible, created_by)
media_assets   (id, owner_type[diamond|template|proposal|production], owner_id,
                kind[image|video], url, sort_order, version_label)
templates      (id, category[ring|necklace|earring|bracelet], name_i18n, desc_i18n,
                base_price_krw, visible, sort_order)
custom_requests(id, customer_id, template_id, diamond_id?, details_json
                {metal, size, engraving, budget, notes}, status, vendor_id?, created_at)
proposals      (id, request_id, vendor_id, version, comment_masked, created_at)
proposal_feedback(id, proposal_id, customer_id, decision[confirm|revise],
                structured_choices_json, comment_masked, created_at)
orders         (id, request_id, total_krw, deposit_krw, deposit_paid_at,
                final_paid_at, status, shipping_stage, tracking_no?)
payments       (id, order_id, kind[deposit|final], provider, amount, currency, status, pg_ref)
status_events  (id, order_or_request_id, from_status, to_status, actor_id, created_at)  -- 감사로그
```

접근 제어(RLS): 벤더는 자신에게 배정된 request만, 그리고 customer PII 컬럼 제외 뷰로만 조회. 고객은 자신의 데이터만. 어드민 전체.

## 8. 아키텍처 & 기술 스택

- **프론트엔드**: 기존 유지 — Vite + React 19, react-router, react-i18next. 스타일은 CSS 변수 기반 디자인 토큰(NOIR 팔레트) + CSS Modules
- **백엔드**: **Supabase** (Postgres + Auth + Storage + RLS) — 별도 서버 없이 역할 분리·익명성 규칙을 RLS로 강제, 시안 미디어는 Storage. 선택 이유: 1인 개발 속도, 역할 기반 보안 내장. (트레이드오프: 복잡한 서버 로직은 Edge Functions로)
- **결제**: Stripe Checkout (deposit/final 두 개의 결제 세션), 웹훅 → Edge Function → 주문 상태 전이
- **영상 처리**: 업로드 원본 그대로 + 브라우저 재생 (트랜스코딩은 Phase 2)
- **마스킹**: 피드백/코멘트 저장 전 Edge Function에서 연락처 정규식 마스킹

## 9. 화면 목록 (라우트)

```
/                  홈 (확정 히어로)
/diamonds          다이아몬드 검색
/diamonds/:id      다이아몬드 상세
/templates         템플릿 갤러리
/custom/new        커스텀 주문 위저드 (4단계)
/account           마이페이지 (주문/시안검토/결제/배송/프로필 탭)
/account/requests/:id  시안 검토 상세
/guide/lab-diamond, /guide/4c   교육 페이지
/login, /signup
/vendor            벤더 요청 큐
/vendor/requests/:id   벤더 주문 상세 + 시안 업로드
/admin             대시보드
/admin/diamonds, /admin/media, /admin/templates, /admin/orders, /admin/vendors, /admin/settings
```

## 10. 에러·엣지 케이스

- **벤더 무응답**: 48시간 무응답 시 어드민 대시보드에 경고 표시, 운영자가 재배정
- **디파짓 미결제**: CONFIRMED 후 72시간 내 미결제 시 만료 알림, 7일 후 요청 자동 보류
- **취소/환불**: 디파짓 전 자유 취소. 디파짓 후에는 운영자 승인 + Stripe 환불 처리. IN_PRODUCTION 이후 환불 불가 정책 명시
- **연락처 우회 시도**: 마스킹 + 어드민 신고 큐. 이미지 내 연락처는 Phase 1에서는 운영자 육안 모니터링
- **동시성**: 상태 전이는 DB 트랜잭션 + 허용 전이 테이블 검증 (잘못된 전이 거부)
- **업로드 실패/대용량**: 클라이언트 사이즈 검증, 재시도 가능한 업로드

## 11. 테스트 전략

- 상태머신 전이 로직: 단위 테스트 (허용/거부 전이 전수)
- RLS 정책: Supabase 테스트로 역할별 접근 검증 (벤더가 PII 못 보는 것 필수 검증)
- 마스킹 함수: 단위 테스트 (전화·이메일·URL·SNS 패턴)
- 핵심 플로우 E2E (Playwright): 주문 제출 → 벤더 업로드 → 컨펌 → 결제(Stripe 테스트 모드) → 상태 변화
- 비주얼: 히어로 데스크톱/모바일 스크린샷 회귀

## 12. 구현 단계

- **Phase 1 (MVP)**: 디자인 토큰·홈(확정 히어로)·i18n 골격 → Auth/역할 → 다이아 검색/상세 + 어드민 인벤토리(가격 조정·미디어 업로드) → 템플릿 갤러리 + 어드민 템플릿 관리 → 커스텀 주문 위저드 + 벤더 포털 + 시안 검토 루프 → Stripe 디파짓/잔금 + 주문·배송 상태 → E2E
- **Phase 2**: §5.4 목록

## 13. 미해결 질문 (구현 중 확인)

- 디파짓 비율 기본값 30% 적정 여부 (운영자 설정 가능으로 구현)
- 잔금 결제 시점: 검수 통과 후 vs 배송 직전 (스펙: 검수 통과 후로 가정)
- 벤더 배정: MVP는 운영자 수동 배정으로 확정
