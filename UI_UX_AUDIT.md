# UI/UX Audit — 2026-07-19

프로덕션 전면 감사(다중 에이전트 병렬: 접근성 / UX 상태·상호작용 / 반응형·CSS + 본체 브라우저 검증).
빌드: `npm run build` · 테스트: `npm test`(클라 214) + `npm run test:server`(서버 174) — 전부 통과.

## 점검 범위
- 공개 경로 12종(홈·카탈로그·상세·인테이크·가이드×2·프로세스·트랙·로그인·리뷰·FAQ·404) — 320px 가로 오버플로 **0px 전 경로** (프로덕션 빌드, Playwright 측정)
- 핵심 흐름: 인테이크 제출, 카탈로그 필터+뒤로가기, 주문 포털(목), 결제 카드, 어드민 제안 컴포저
- 콘솔 오류: 로컬 preview의 `/v1` 500만 존재(백엔드 부재 환경 노이즈 — 라이브는 API 있음). 앱 자체 오류 0.

## 수정한 문제

| ID | 심각도 | 위치 | 문제 → 수정 | 검증 |
|---|---|---|---|---|
| P1-1 | P1 | server/middleware.js | 어드민+고객 쿠키 동시 로그인 시 고객 API 전부 401(주문 포털 재로그인 루프). attachPrincipal이 두 세션 모두 해석, requireCustomer가 고객 세션 우선. chat/review 라우트도 principalCustomer 사용 | 신규 middleware.test.js 6케이스 + authRoutes 테스트를 올바른 동작 기준으로 갱신(구 테스트가 버그를 고정하고 있었음). 서버 174/174 |
| P1-2 | P1 | src/pages/IntakeForm.jsx | 서버 접수 실패 시에도 "접수 완료" 거짓 성공(주문 유실 위험). 서버 응답 await → 실패 시 오류+재시도(드래프트 보존), ApiUnavailable(정적 데모)만 로컬 폴백. 제출 busy 가드(Idempotency-Key 재생성 중복 방지) | 코드 경로 + 빌드/테스트 |
| P1-3 | P1 | src/pages/Home.jsx | 리뷰 라이트박스 포커스 관리 전무(WCAG 2.4.3) → 열림 시 포커스 이동·Tab 트랩·Escape·복귀·aria-label | 코드 + 빌드 |
| P1-4 | P1 | src/components/ui.jsx | 그리드 영상 무한 autoplay가 prefers-reduced-motion 무시(WCAG 2.2.2/2.3.3) → 감소 선호 시 포스터 정지. 홈 히어로도 동일 | 코드 + 빌드 |
| P1-5 | P1 | src/styles.css | 모바일 독이 aria-hidden 상태로 탭 순서에 잔존(보이지 않는 탭 스톱) → visibility 토글 동기화 | 코드 |
| P2-1 | P2 | src/lib/seed.js·designSlots.js | 존재하지 않는 자산 5건(시드 리뷰 4 + 벤젤 브레이슬릿 슬롯) → 실재 파일로 교체. 깨진 파일명을 고정하던 designSlots 테스트도 갱신 | 전수 대조 + 테스트 |
| P2-2 | P2 | src/components/ui.jsx | MediaThumb 이미지/비디오 onError 전무 → 깨짐 아이콘 대신 media-empty 폴백 | 코드 |
| P2-3 | P2 | src/pages/StyleCatalog.jsx | 필터 탭이 URL과 단방향 → 뒤로가기 시 탭·그리드 desync → params 동기화 useEffect. 칩 aria-pressed 추가 | 브라우저 재현→수정→재검증 |
| P2-4 | P2 | src/pages/Account.jsx | 주문 목록 로딩 중 "주문 없음" 플래시 → null=로딩 구분 | 코드 |
| P2-5 | P2 | src/pages/ServerOrderPortal.jsx | API 불가 화면 dead end → "다시 시도" 버튼(4개 언어) | 코드 |
| P2-6 | P2 | IntakeForm·ReviewNew·ClientPortal | 제출 오류에 role="alert" 부재(SR 미인지) + 이메일 오류 aria-describedby 연결 | 코드 |
| P3-1 | P3 | src/pages/Login.jsx | OTP 재전송 busy 가드 누락(연타 중복 요청) → 가드 | 코드 |
| P3-2 | P3 | src/pages/ReviewNew.jsx | 배송완료 주문 선택 busy 가드 누락 → 가드 | 코드 |
| P3-3 | P3 | src/NotFound.jsx | 404에 h1·복귀 CTA 없음 → 추가 | 브라우저 확인 |
| P3-4 | P3 | src/Layout.jsx·platform.css | 스킵 링크 부재 → `.skip-link`+`#main` | 브라우저 확인 |
| P3-5 | P3 | src/platform.css | 폼 포커스 표시가 저대비 보더뿐 → :focus-visible 2px 링 | 코드 |
| P3-6 | P3 | ui.jsx·Home.jsx | 아이콘 전용 버튼(✕, ‹›) accessible name → aria-label | 코드 |
| P1-6 | P1 | src/platform.css | StyleDetail 제목 nowrap → 장문 스타일명이 데스크톱 2열을 뚫어 페이지 가로 스크롤(+269px@1180, 실측 RING-016) → text-wrap:balance | 수정 후 재실측 0px |
| P2-7 | P2 | src/platform.css | 채팅 버블(z 940)이 리뷰/포털 라이트박스(z 90/120) 위에 떠 모달을 가림 → 라이트박스 z 1010 | 코드 |
| P2-8 | P2 | src/styles.css | 모바일 햄버거 34px 터치 타겟 → 44px (+히어로 정지 버튼) | 코드 |
| P3-7 | P3 | src/pages/admin/AdminHero.jsx | (직전 세션) 이미지 드롭 시 UI 잠김 → 영상만 수용+안내 | 이미 배포 |

## 통과 확인 (수정 불요)
- race condition: ServerOrderPortal loadSequence, 각 fetch cancelled 플래그 — 방어 완비
- 모바일 메뉴·LuxurySelect·ClientMediaCarousel: 포커스 트랩/복귀/ARIA 모범 구현
- lang 속성 동기화, 폼 라벨 래핑, 주요 페이지 h1, 404 라우트, 미디어 업로드 시퀀스 가드

## 남은 문제 (수정 보류 — 사유 명시)
- **P2** IntakeForm/ReviewNew 첨부가 R2 업로드 실패 시 base64 폴백 후 서버 제출에서 무경고 탈락 — `remoteRequired` 적용 시 정적 데모(Pages, R2 없음)의 첨부가 전면 차단되어 환경 분기 설계 필요. 재현: 오프라인에서 인테이크에 사진 첨부→제출.
- **P2** 어드민 채팅 인박스 ≤900px에서 스레드 목록 숨김(모바일 토글 부재) — JSX 재구성 필요, 어드민 전용이라 다음 패스. 재현: 모바일에서 /bo-4q9z7m/chat.
- **P3** 채팅 위젯 소형 터치 타겟 군집(18~38px), day 테마 hero-admin LIVE 뱃지 저대비, .crm-order-meta 모바일 잘림, 레거시 데드 CSS 블록, 채팅 첨부 치수 미지정 — 반응형 감사 잔여분.
- **P3** 포털 2종 메인 h1 부재, Guide h1→h3 계층, Stepper aria-current, LanguageMenu 포커스 복귀, aria-label 영어 하드코딩(4개 언어 사전화), blob URL revoke, 어드민 window.confirm 4곳 — 낮은 영향, 다음 패스.
- **성능**: 번들 경고(>500kB 청크)는 기존 상태 유지 — 이번 수정으로 회귀 없음(빌드 1.4s 동일). Lighthouse 계측은 로컬 preview에 백엔드가 없어 API 의존 지표가 왜곡되므로 라이브 기준 별도 수행 필요. field 데이터 없음(단정 금지).

## 검증 요약
- production build ✓ · 클라 vitest 214/214 ✓ · 서버 vitest 174/174 ✓ (신규 회귀 테스트 8개 포함)
- 320px 12경로 오버플로 0 ✓ · 뒤로가기 동기화/404/스킵링크 브라우저 재검증 ✓
