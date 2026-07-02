import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "lumina-theme";

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // 기본 테마는 day(화사한 갤러리 화이트) — 사용자가 직접 고른 값만 존중
    if (typeof window === "undefined") return "day";
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "day";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "day" ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDay: theme === "day",
      setTheme: (nextTheme) => setThemeState(nextTheme === "day" ? "day" : "dark"),
      toggleTheme: () => setThemeState((current) => (current === "day" ? "dark" : "day")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
