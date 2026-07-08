// 상단 세일 배너 — 브릴리언스식 풀폭 다크 바. settings.saleBanner(서버 write-through)로 전 고객 제어.
// 고정 헤더 위에 앉으므로 실측 높이를 --sale-banner-h로 내려 헤더(top)와 본문(margin-top)을 민다.
// 코드가 있으면 클릭 = 코드 복사(+피드백), 코드가 없으면 디자인 카탈로그 링크.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLocale } from "../i18n.jsx";
import { getSettings } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { resolveSaleBanner } from "../lib/saleBanner.js";

// 어드민·게이트 경로에서는 숨김 (ChatWidget과 동일 규칙)
const BLOCKED = (path) => path.startsWith("/bo-") || path.startsWith("/gate-") || path.startsWith("/admin");

const COPIED_LABEL = { en: "Copied ✓", ko: "복사됨 ✓", zh: "已复制 ✓", es: "Copiado ✓" };

export default function SaleBanner() {
  useDBVersion();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const banner = BLOCKED(pathname) ? null : resolveSaleBanner(getSettings().saleBanner, locale);
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el) {
      root.style.setProperty("--sale-banner-h", "0px");
      return undefined;
    }
    const apply = () => root.style.setProperty("--sale-banner-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply); // 모바일 두 줄 래핑도 실측이라 어긋나지 않는다
    ro.observe(el);
    return () => { ro.disconnect(); root.style.setProperty("--sale-banner-h", "0px"); };
  }, [banner?.text, banner?.code]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(banner.code);
    } catch {
      return; // 클립보드 미지원(구형/비보안 컨텍스트) — 조용히 무시
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!banner) return null;
  if (!banner.code) {
    return (
      <Link ref={ref} className="sale-banner" to="/designs">
        <span>{banner.text}</span>
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" className="sale-banner" onClick={copyCode}>
      <span>{banner.text}</span>
      <span className={`sale-banner-code${copied ? " is-copied" : ""}`}>
        {copied ? COPIED_LABEL[locale] || COPIED_LABEL.en : `Code: ${banner.code}`}
      </span>
    </button>
  );
}
