import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearLegacyTheme, persistThemeChoice, resolveInitialTheme } from "./lib/themePref.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // 기본 테마는 day(화사한 갤러리 화이트) — 사용자가 직접 고른 값만 존중
    if (typeof window === "undefined") return "day";
    return resolveInitialTheme(window.localStorage);
  });

  useEffect(() => {
    // 다크 기본 시절의 구 키가 남아 기기별로 다크가 굳는 것을 청소
    clearLegacyTheme(window.localStorage);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "day" ? "light" : "dark";
  }, [theme]);

  const value = useMemo(() => {
    const applyUserChoice = (nextTheme) => {
      const normalized = nextTheme === "dark" ? "dark" : "day";
      setThemeState(normalized);
      persistThemeChoice(window.localStorage, normalized);
    };
    return {
      theme,
      isDay: theme === "day",
      setTheme: applyUserChoice,
      toggleTheme: () => applyUserChoice(theme === "day" ? "dark" : "day"),
    };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
