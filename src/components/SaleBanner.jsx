// 상단 세일 배너 — 브릴리언스식 풀폭 다크 바. settings.saleBanner(서버 write-through)로 전 고객 제어.
// 고정 헤더 위에 앉으므로 실측 높이를 --sale-banner-h로 내려 헤더(top)와 본문(margin-top)을 민다.
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLocale } from "../i18n.jsx";
import { getSettings } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { resolveSaleBanner } from "../lib/saleBanner.js";

// 어드민·게이트 경로에서는 숨김 (ChatWidget과 동일 규칙)
const BLOCKED = (path) => path.startsWith("/bo-") || path.startsWith("/gate-") || path.startsWith("/admin");

export default function SaleBanner() {
  useDBVersion();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const banner = BLOCKED(pathname) ? null : resolveSaleBanner(getSettings().saleBanner, locale);
  const ref = useRef(null);

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

  if (!banner) return null;
  return (
    <Link ref={ref} className="sale-banner" to="/designs">
      <span>{banner.text}</span>
      {banner.code && <span className="sale-banner-code">Code: {banner.code}</span>}
    </Link>
  );
}
