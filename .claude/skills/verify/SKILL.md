---
name: verify
description: BeloveD 프론트 변경을 실제 브라우저로 검증하는 레시피 — dev 서버 기동, Playwright MCP로 플로우 구동, 로컬 스토어 폴백 주의사항
---

# BeloveD 프론트 검증 레시피

## 기동

- `npm run dev` (백그라운드) → Vite가 http://localhost:5173 에 뜬다 (수 초 내).
- API까지 필요하면 `npm run api` 별도 기동. 안 띄우면 `/v1/*`가 500을 뱉지만
  프론트는 로컬 스토어(localStorage)로 폴백하므로 대부분의 UI 플로우는 검증 가능.
  콘솔의 `/v1/settings/public`, `/v1/designs`, `/v1/chat/thread` 500 에러는 이 환경 노이즈.

## 구동 (Playwright MCP)

- 인테이크 위저드: `/custom/new` (URL 프리필: `?category=`, `?style=`, `?diamond=`).
- 인테이크 드래프트는 `localStorage["lumina-intake-draft"]`에 450ms 디바운스로 자동 저장
  (form/refs/screen). 상태 초기화는 `localStorage.clear()` 후 reload.
- 선택 카드류는 `.gflow-option-card`, 선택 표시는 `is-selected` 클래스 + `aria-selected`.
  드래프트 이어하기 배너는 `.gflow-resume` (primary=이어하기, secondary=새로 시작).
- nav "Start Custom" 링크는 3곳(데스크톱 nav/모바일 패널/푸터 Shop)에 있어 strict mode에
  걸린다 → `nav[aria-label="Primary navigation"] >> text=Start Custom`.

## 주의

- Playwright 스크린샷은 CWD(레포 루트)에 떨어진다 → 끝나면 스크래치패드로 옮기거나 삭제.
- 언어는 localStorage 초기화 시 EN으로 뜰 수 있음(로케일 저장 키가 지워져서). 한국어 확인이
  필요하면 nav의 언어 스위처로 KO 선택.
