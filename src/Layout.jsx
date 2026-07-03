import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BadgeCheck, ChevronDown, Facebook, Instagram, LogOut, Menu, Moon, RotateCcw, ShieldCheck, Sun, Truck, UserRound, X } from "lucide-react";
import { localeOptions } from "./translations.js";
import { footerGroups, infoNav, social, trustStrip } from "./lib/infoContent.js";
import { useLocale } from "./i18n.jsx";
import { useAuth } from "./lib/auth.jsx";
import { pendingCount } from "./lib/store.js";
import { useDBVersion } from "./lib/useDB.js";
import { useTheme } from "./theme.jsx";
import { withBase } from "./components/ui.jsx";

// 비즈니스 로고 — 원본에서 배경을 키잉한 투명 PNG (글자만 얹혀 어떤 배경에서도 박스가 없다)
function BrandLogo() {
  return <img className="brand-logo" src={withBase("/assets/brand-word.png")} alt="BeloveD" />;
}

function roleHome(user) {
  if (!user) return "/sign-in";
  if (user.role === "admin") return "/bo-4q9z7m/live";
  return "/account";
}

// 네이티브 <select>는 펼친 목록을 OS가 그려 디자인 불가 → 커스텀 드롭다운
function LanguageMenu({ locale, setLocale, label, up = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = localeOptions.find((o) => o.code === locale) ?? localeOptions[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // EscapeBack(뒤로가기) 발동 방지 — 메뉴만 닫기
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className={`lang-menu ${open ? "is-open" : ""} ${up ? "drops-up" : ""}`} ref={ref}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current.label}</span>
        <ChevronDown className="lang-caret" size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      <ul className="lang-list" role="listbox" aria-label={label} hidden={!open}>
        {localeOptions.map((o) => (
          <li key={o.code} role="option" aria-selected={o.code === locale}>
            <button
              type="button"
              className={o.code === locale ? "is-active" : ""}
              onClick={() => { setLocale(o.code); setOpen(false); }}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Header() {
  useDBVersion();
  const { locale, setLocale, t, p } = useLocale();
  const { user, logout } = useAuth();
  const { isDay, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pending = pendingCount(user); // 역할별 "내 차례" 수 — 알림 대신 배지
  const panelRef = useRef(null);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  function closeMobilePanel({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }

  // 모바일 메뉴: 패널·햄버거 바깥을 터치/클릭하면 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        menuButtonRef.current && !menuButtonRef.current.contains(e.target)
      ) {
        closeMobilePanel();
      }
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeMobilePanel({ restoreFocus: true });
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const navItems = [
    { to: "/designs", label: p.nav.designs },
    { to: "/process", label: p.nav.process },
    { to: "/guide", label: p.nav.guide },
    { to: "/custom/new", label: p.nav.startCustom },
  ];

  return (
    <header className="site-header">
      <button
        ref={menuButtonRef}
        className="mobile-menu-button"
        aria-label={t.aria.openMenu}
        aria-controls="mobile-nav-panel"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={22} strokeWidth={1.7} />
      </button>

      <Link className="brand" to="/" aria-label="BeloveD home"><BrandLogo /></Link>

      <nav className="desktop-nav" aria-label={t.aria.primaryNav}>
        {navItems.map((item) => (
          <NavLink to={item.to} key={item.to}>{item.label}</NavLink>
        ))}
      </nav>

      <div className="header-actions">
        <LanguageMenu locale={locale} setLocale={setLocale} label={t.aria.language} />
        <button className="icon-button theme-toggle" aria-label={isDay ? t.aria.switchToDark : t.aria.switchToDay} onClick={toggleTheme}>
          {isDay ? <Moon size={20} strokeWidth={1.7} /> : <Sun size={20} strokeWidth={1.7} />}
        </button>
        <span className="header-divider" aria-hidden="true" />
        {user ? (
          <>
            <button className="icon-button" aria-label={p.nav.account} onClick={() => navigate(roleHome(user))} style={{ position: "relative" }}>
              <UserRound size={20} strokeWidth={1.7} />
              {pending > 0 && <span className="nav-badge">{pending}</span>}
            </button>
            <button className="icon-button logout-button" aria-label={p.nav.logout} onClick={() => { navigate("/"); logout(); }}>
              <LogOut size={20} strokeWidth={1.7} />
            </button>
          </>
        ) : (
          <button className="button small ghost" onClick={() => navigate("/sign-in")}>
            {p.nav.login}
          </button>
        )}
      </div>

      <div
        ref={panelRef}
        id="mobile-nav-panel"
        className={`mobile-panel ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        hidden={!open}
      >
        <button ref={closeButtonRef} className="icon-button close-button" aria-label={t.aria.closeMenu} onClick={() => closeMobilePanel({ restoreFocus: true })}>
          <X size={20} strokeWidth={1.7} />
        </button>
        {navItems.map((item) => (
          <NavLink to={item.to} key={item.to} onClick={() => closeMobilePanel()}>{item.label}</NavLink>
        ))}
        <NavLink to={roleHome(user)} onClick={() => closeMobilePanel()}>
          {user?.role === "admin" ? p.nav.admin : user ? p.nav.account : p.nav.login}
        </NavLink>
        <div className="mobile-panel-actions">
          <LanguageMenu locale={locale} setLocale={setLocale} label={t.aria.language} up />
          <button className="icon-button theme-toggle" aria-label={isDay ? t.aria.switchToDark : t.aria.switchToDay} onClick={toggleTheme}>
            {isDay ? <Moon size={20} strokeWidth={1.7} /> : <Sun size={20} strokeWidth={1.7} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { locale, t, p } = useLocale();
  const f = t.footer;
  const g = footerGroups[locale] ?? footerGroups.en;
  const n = infoNav[locale] ?? infoNav.en;
  const trust = trustStrip[locale] ?? trustStrip.en;
  const trustIcons = [Truck, RotateCcw, ShieldCheck, BadgeCheck];
  // 헤더의 가로 태스크바와 역할 분리 — 푸터는 브랜드 앵커 + 그룹 디렉토리 + 신뢰 스트립
  // GitHub Pages 하위 경로에서도 동작하도록 router Link 사용
  const columns = [
    {
      title: g.shop,
      links: [
        { to: "/designs", label: p.nav.designs },
        { to: "/custom/new", label: p.nav.startCustom },
      ],
    },
    {
      title: g.learn,
      links: [
        { to: "/process", label: n.howItWorks },
        { to: "/guide/lab-diamond", label: n.labGrown },
        { to: "/guide/4c", label: n.fourC },
      ],
    },
    {
      title: g.care,
      links: [
        { to: "/contact", label: n.contact },
        { to: "/shipping", label: n.shipping },
        { to: "/returns", label: n.returns },
        { to: "/warranty", label: n.warranty },
        { to: "/faq", label: n.faq },
      ],
    },
    {
      title: g.company,
      links: [
        { to: "/about", label: n.about },
        { to: "/track", label: p.portal.guestTitle },
        { to: "/sign-in", label: p.nav.login },
      ],
    },
  ];
  return (
    <footer className="footer">
      <div className="trust-strip">
        {trust.map((label, i) => {
          const Icon = trustIcons[i] ?? BadgeCheck;
          return (
            <div className="trust-item" key={label}>
              <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
              <span>{label}</span>
            </div>
          );
        })}
      </div>
      <div className="footer-top">
        <div className="footer-brand">
          <Link className="brand" to="/" aria-label="BeloveD home"><BrandLogo /></Link>
          {f.tagline ? <p className="footer-tagline">{f.tagline}</p> : null}
          {f.cert ? <span className="footer-cert">{f.cert}</span> : null}
          <div className="footer-social-row">
            <a
              className="footer-social"
              href={social.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram — ${social.instagram.handle}`}
            >
              <Instagram size={20} strokeWidth={1.6} aria-hidden="true" />
            </a>
            <a
              className="footer-social"
              href={social.facebook.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Facebook — ${social.facebook.handle}`}
            >
              <Facebook size={20} strokeWidth={1.6} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="footer-cols">
          {columns.map((col) => (
            <nav className="footer-col" key={col.title} aria-label={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((link) => <Link to={link.to} key={link.to}>{link.label}</Link>)}
            </nav>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <span>{f.copyright}</span>
      </div>
    </footer>
  );
}

// ESC = 뒤로가기. 입력 중에는 포커스 해제만 (폼 작성 중 페이지 이탈 방지),
// 모바일 메뉴가 열려 있으면 무시, 히스토리가 없으면 홈으로, 홈에서는 아무 동작 안 함.
function EscapeBack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (pathname === "/custom/new") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) {
        el.blur();
        return;
      }
      if (document.querySelector(".mobile-panel.is-open")) return;
      if (pathname === "/") return;
      if (window.history.state?.idx > 0) navigate(-1);
      else navigate("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, pathname]);
  return null;
}

// 라우트 이동 시 맨 위로, 해시가 있으면 해당 섹션으로
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function Layout() {
  return (
    <>
      <ScrollManager />
      <EscapeBack />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
