// 빌드 타임 플래그 — vite.config.js의 define(__WITH_BACKOFFICE__) 참조.
// 공개 배포(GitHub Pages)에서는 false로 치환되어 어드민·스태프 화면이
// 라우트와 번들에서 함께 제거된다. 테스트 등 define이 없는 환경은 true.
export const WITH_BACKOFFICE = typeof __WITH_BACKOFFICE__ !== "undefined" ? __WITH_BACKOFFICE__ : true;

// Insecure demo credentials and visible development OTPs are opt-in only.
// They must never appear just because Vite is running in development mode.
export const DEMO_AUTH_ENABLED = import.meta.env?.VITE_ENABLE_DEMO_AUTH === "true";
export const DEMO_AUTH_PASSWORD = DEMO_AUTH_ENABLED ? String(import.meta.env?.VITE_DEMO_AUTH_PASSWORD || "") : "";
