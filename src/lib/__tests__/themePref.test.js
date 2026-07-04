import { describe, expect, it } from "vitest";
import {
  LEGACY_THEME_KEY,
  THEME_KEY,
  clearLegacyTheme,
  persistThemeChoice,
  resolveInitialTheme,
} from "../themePref.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

describe("resolveInitialTheme", () => {
  it("빈 저장소(첫 방문)는 day", () => {
    expect(resolveInitialTheme(fakeStorage())).toBe("day");
  });

  it("다크 기본 시절에 자동 기록된 구 키(lumina-theme=dark)는 무시하고 day", () => {
    const storage = fakeStorage({ [LEGACY_THEME_KEY]: "dark" });
    expect(resolveInitialTheme(storage)).toBe("day");
  });

  it("사용자가 직접 고른 다크(beloved-theme=dark)만 존중", () => {
    const storage = fakeStorage({ [THEME_KEY]: "dark" });
    expect(resolveInitialTheme(storage)).toBe("dark");
  });

  it("알 수 없는 값은 day로 정규화", () => {
    const storage = fakeStorage({ [THEME_KEY]: "noir" });
    expect(resolveInitialTheme(storage)).toBe("day");
  });

  it("저장소 접근이 막혀도(프라이빗 모드 등) day", () => {
    const storage = {
      getItem() {
        throw new Error("denied");
      },
    };
    expect(resolveInitialTheme(storage)).toBe("day");
  });
});

describe("persistThemeChoice", () => {
  it("사용자 선택을 새 키에 기록한다", () => {
    const storage = fakeStorage();
    persistThemeChoice(storage, "dark");
    expect(storage.getItem(THEME_KEY)).toBe("dark");
  });

  it("저장 실패는 조용히 무시한다", () => {
    const storage = {
      setItem() {
        throw new Error("quota");
      },
    };
    expect(() => persistThemeChoice(storage, "day")).not.toThrow();
  });
});

describe("clearLegacyTheme", () => {
  it("오염된 구 키를 지우고 새 키는 건드리지 않는다", () => {
    const storage = fakeStorage({ [LEGACY_THEME_KEY]: "dark", [THEME_KEY]: "dark" });
    clearLegacyTheme(storage);
    expect(storage.getItem(LEGACY_THEME_KEY)).toBe(null);
    expect(storage.getItem(THEME_KEY)).toBe("dark");
  });
});
