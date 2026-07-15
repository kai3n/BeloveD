// Vendor UI 白标配置。部署时可用 VITE_VENDOR_BRAND_* 覆盖，无需修改页面代码。
const BRAND_BY_LOCALE = {
  zh: {
    name: import.meta.env.VITE_VENDOR_BRAND_ZH || "得月",
    mark: import.meta.env.VITE_VENDOR_MARK_ZH || "得",
  },
  en: {
    name: import.meta.env.VITE_VENDOR_BRAND_EN || "De Lune",
    mark: import.meta.env.VITE_VENDOR_MARK_EN || "DL",
  },
  ko: {
    name: import.meta.env.VITE_VENDOR_BRAND_KO || "De Lune",
    mark: import.meta.env.VITE_VENDOR_MARK_KO || "DL",
  },
};

export function vendorBrand(locale = "zh") {
  return BRAND_BY_LOCALE[locale] || BRAND_BY_LOCALE.en;
}
