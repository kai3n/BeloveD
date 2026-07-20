# UI/UX Audit — 2026-07-19

> **⚠️ 독립 Release QA 재검증(2026-07-19 심야)이 아래에 추가됨 — 본문 표의 P1-2·P1-3은 재검증에서 결함이 발견되어 후속 수정됨. 최종 상태는 문서 하단 "독립 Release QA" 섹션이 진실.**

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

---

# 독립 Release QA — 2026-07-19 (별도 세션, 위 감사와 독립 재검증)

위 감사의 완료 표시를 신뢰하지 않고 로컬 dev(5173)+API(8787, 로컬 Postgres)와
프로덕션 번들(8787 static)에서 전 항목을 브라우저로 직접 재현·검증. 결과:
위 표의 P1 2건이 재검증에 실패했고(그중 1건은 수정이 새 P0을 유발), 신규 3건을 발견해 모두 수정.

## 재검증 실패 → 수정 (이번 세션)

| 심각도 | 위치 | 문제 | 수정 · 증거 |
|---|---|---|---|
| **P0(신규, P1-3 수정이 유발)** | src/pages/Home.jsx `LovedWorn` | P1-3(라이트박스 포커스 트랩)에서 추가한 훅 3개(lbRef·lbReturnRef·useEffect)가 `if (reviews.length===0) return null` **뒤에** 배치 → 서버 `/v1/reviews`가 빈 배열이면 "Rendered fewer hooks than expected"로 **홈 전체 백지**(에러 바운더리 없음 → 루트 언마운트). 로컬에서 100% 재현(게시 리뷰 0). 라이브도 게시 리뷰가 0이 되는 순간 동일 | 훅을 조기 return 앞으로 이동. 재검증: 빈 리뷰 상태에서 홈 정상 렌더(dev+prod 번들 모두), 콘솔 오류 0. 전 컴포넌트 훅-조기return 순서 전수 스윕(에이전트) — 이 1건 외 위반 없음 |
| **P1-2 미완(거짓 성공 잔존)** | src/pages/IntakeForm.jsx + src/lib/api.js | 서버가 500/502(HTML·비JSON 계약)를 반환하면 apiFetch가 `ApiUnavailableError`(=정적 데모)로 오분류 → 로컬 DM- 접수 "완료" 화면 = **주문 유실 그대로**. 브라우저 재현: `/v1/intakes` 502 목킹 → "Request received/DM-000009" 표시됨 | 로컬 폴백을 Login.jsx와 동일하게 정적 데모 빌드(`!WITH_BACKOFFICE`) 전용으로 게이트. 재검증: 502 시 role=alert 오류+폼 유지+드래프트 보존, 차단 해제 후 재제출 → BD-100012 발급·로컬 Postgres `customer_orders`에 실재 확인 |

## 신규 발견 → 수정 (이번 세션)

| 심각도 | 위치 | 문제 → 수정 |
|---|---|---|
| P2 | src/chat.css | 채팅 런처가 홈 히어로 구간에서 opacity:0인데 tabIndex 유지 → **보이지 않는 키보드 탭 스톱**(P1-5와 동일 클래스, 채팅 위젯 누락분) → `visibility:hidden` 동기 토글(페이드아웃 후 지연). 숨김 시 포커스 불가·스크롤 후 정상 복귀 실측 |
| P2 | src/styles.css `.info-channel-value` | `/privacy`·`/contact` 320px에서 이메일 장문이 **가로 오버플로 +39px**(위 감사의 "전 경로 0px"는 InfoPage 계열 누락) → `overflow-wrap:anywhere`. 재실측 0px(dev+prod) |
| P3 | src/pages/admin/AdminBenchmark.jsx | `<tr>` 내 공백 텍스트 노드 React DOM 경고(콘솔 오류) → 공백 제거 |

## 재검증 통과 (직접 재현으로 확인)

- **P1-1** 어드민+고객 쿠키 동시 로그인: `/v1/orders` 200(주문 1)·`/v1/admin/orders` 200(주문 12) — 401 루프 없음
- **P1-3** 라이트박스(크래시 수정 후): 포커스 진입·Tab 8회 순환 트랩·Escape 닫기·트리거로 복귀
- **P1-4** prefers-reduced-motion: 히어로 영상 정지+포스터 / 일반 시 재생
- **P1-5** 모바일 독 visibility 동기화: aria-hidden 패널 내 도달 가능한 포커서블 0
- **P1-6** RING-016 1180px 오버플로 0 · **P2-8** 햄버거 44×44
- **P2-1** 시드 자산 전수 대조: seed/designSlots/styleSeedData 실참조 99건 전부 존재
- **P2-2** 미디어 요청 3건 강제 실패 → 깨진 이미지 0, media-empty 폴백 표시
- **P2-3** 카탈로그 칩↔URL 뒤로가기 2단 동기화(카테고리→상세→back→back) · 서브카테고리 그룹 aria-pressed 정상
- **P2-4** Account null=로딩 (코드+실주문 목록 렌더) · **P2-5** 포털 unavailable→"Try again"→복구 실측
- **P2-6** 인테이크 검증 오류 role=alert + 해당 섹션 자동 스크롤 · **P2-7** 채팅 z 940 < 라이트박스 z 1010
- **P3-3** 404 h1+복귀 CTA · **P3-4** 스킵 링크(포커스 시 top:12px 노출, Enter 후 Tab이 #main 내부로)
- 모바일 메뉴: 열림 시 포커스 진입·Tab 14/14 트랩·Escape 닫기+버거로 복귀
- 인테이크 위저드 전 스텝(카테고리→디자인→메탈→셰입→캐럿→영감→연락처→리뷰) 실구동, 성공 경로 BD-100012 서버 캡처
- OTP 로그인(실서버 세션)→/account→주문 워크스페이스, 콘솔 오류 0
- 어드민 콘솔 11페이지(live/designs/benchmark/metals/payments/reviews/chat/coupons/hero/members/analytics) 렌더·오버플로 0
- 반응형: 320px 20경로(위 12경로+InfoPage 7종+404) 오버플로 0(수정 후), 768/1180/1920px 핵심 7경로 0
- KO 로케일(lang=ko·번역), submitFailed 4개 언어 사전 존재 확인
- 최종: build ✓ · 클라 214/214 ✓ · 서버 174/174 ✓ · 프로덕션 번들 스모크(홈·designs·custom/new·privacy) 콘솔 오류 0

## 환경 이슈 (제품 결함 아님, 로컬에서 해결)

- 로컬 Postgres가 마이그레이션 5개 미적용(0011_chat_ops 등) → 어드민 채팅 인박스 500. `npm run db:migrate`로 해소. 라이브(Neon)와 무관하나, **0008·0011·0013 번호 중복** 파일명은 적용 순서 혼동 여지 — 정리 권장
- QA 부산물(로컬 DB 한정): BD-100012 테스트 주문, qa-admin@beloved.test 계정

## 남은 갭 (검증 불가 사유 명시)

- **훅 순서 회귀 자동 테스트 부재**: 클라 테스트가 SSR 1-pass(renderToStaticMarkup)라 이 버그 클래스를 잡을 수 없음. jsdom+클라이언트 렌더 테스트 인프라 필요(의존성 추가라 보류)
- 결제 카드/QR 고객 화면: 입금 대기 단계 주문이 필요(제안→수락 선행) — 이번 세션 미도달. 어드민 Payments 렌더만 확인
- 리뷰 작성 제출(배송완료 주문 필요)·첨부 R2 업로드(로컬 R2 없음)·상태 메일 발송(Resend 키 없음, dev sink 캡처만 확인)
- Lighthouse/필드 성능: 위 감사와 동일 사유(로컬 백엔드 왜곡)로 라이브 기준 별도 필요. 번들 경고(index 510kB)는 기존 상태 유지
