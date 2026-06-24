import { createContext, useContext, useEffect, useState } from "react";
import { localeOptions, translations } from "./translations.js";
import { platformStrings } from "./platformStrings.js";
import { dealerStrings } from "./dealerStrings.js";
import { opsStrings } from "./opsStrings.js";

const LocaleContext = createContext(null);

// 데이터에 저장된 i18n 값({ko,en,zh,es} 또는 문자열)을 현재 언어로 해석
export function pickI18n(value, locale) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[locale] ?? value.ko ?? value.en ?? Object.values(value)[0] ?? "";
}

const VALID_LOCALES = ["en", "zh", "ko", "es"];

export function LocaleProvider({ children }) {
  // 저장값이 손상돼도 앱이 죽지 않도록 검증 후 폴백
  const [locale, setLocaleRaw] = useState(() => {
    const stored = localStorage.getItem("lumina-locale");
    return VALID_LOCALES.includes(stored) ? stored : "en";
  });
  const setLocale = (code) => { if (VALID_LOCALES.includes(code)) setLocaleRaw(code); };
  const t = { ...translations[locale], platform: { ...platformStrings[locale], ...dealerStrings[locale], ...opsStrings[locale] } };

  useEffect(() => {
    localStorage.setItem("lumina-locale", locale);
    const option = localeOptions.find((item) => item.code === locale);
    document.documentElement.lang = option?.htmlLang ?? "en";
    document.title = translations[locale].meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", translations[locale].meta.description);
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, p: t.platform }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
