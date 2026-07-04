// 테마 저장 규칙: 사용자가 토글로 직접 고른 값만 저장·존중한다.
// 구 키(lumina-theme)는 다크 기본 시절에 방문만 해도 "dark"가 자동 기록돼
// 기기마다 다크가 기본처럼 굳는 버그를 만들었다 → 새 키로 교체하고 구 키는 무시.
export const THEME_KEY = "beloved-theme";
export const LEGACY_THEME_KEY = "lumina-theme";

export function resolveInitialTheme(storage) {
  try {
    return storage.getItem(THEME_KEY) === "dark" ? "dark" : "day";
  } catch {
    return "day";
  }
}

export function persistThemeChoice(storage, theme) {
  try {
    storage.setItem(THEME_KEY, theme);
  } catch {
    // 프라이빗 모드 등 저장 불가 환경 — 세션 내 상태만 유지
  }
}

export function clearLegacyTheme(storage) {
  try {
    storage.removeItem(LEGACY_THEME_KEY);
  } catch {
    // 지우기 실패해도 무해 — resolveInitialTheme가 구 키를 읽지 않는다
  }
}
