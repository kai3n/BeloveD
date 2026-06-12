import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Languages, LogOut, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { localeOptions } from "./translations.js";
import { useLocale } from "./i18n.jsx";
import { useAuth } from "./lib/auth.jsx";

function roleHome(user) {
  if (!user) return "/login";
  if (user.role === "vendor") return "/vendor";
  if (user.role === "dealer") return "/dealer";
  if (user.role === "admin") return "/admin";
  return "/account";
}

export function Header() {
  const { locale, setLocale, t, p } = useLocale();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navItems = [
    { to: "/diamonds", label: p.nav.diamonds },
    { to: "/templates", label: p.nav.gallery },
    { to: "/custom/new", label: p.nav.custom },
    { to: "/guide/lab-diamond", label: p.nav.guide },
  ];

  return (
    <header className="site-header">
      <button className="mobile-menu-button" aria-label={t.aria.openMenu} onClick={() => setOpen(true)}>
        <Menu size={22} strokeWidth={1.7} />
      </button>

      <Link className="brand" to="/" aria-label="LUMINA LAB home">LUMINA LAB</Link>

      <nav className="desktop-nav" aria-label={t.aria.primaryNav}>
        {navItems.map((item) => (
          <NavLink to={item.to} key={item.to}>{item.label}</NavLink>
        ))}
      </nav>

      <div className="header-actions">
        <label className="language-control">
          <Languages size={16} strokeWidth={1.7} aria-hidden="true" />
          <select aria-label={t.aria.language} value={locale} onChange={(e) => setLocale(e.target.value)}>
            {localeOptions.map((o) => <option value={o.code} key={o.code}>{o.label}</option>)}
          </select>
        </label>
        <button className="icon-button" aria-label={t.aria.search} onClick={() => navigate("/diamonds")}>
          <Search size={20} strokeWidth={1.7} />
        </button>
        <button className="icon-button" aria-label={user ? p.nav.account : p.nav.login} onClick={() => navigate(roleHome(user))}>
          <UserRound size={20} strokeWidth={1.7} />
        </button>
        {user ? (
          <button className="icon-button" aria-label={p.nav.logout} onClick={() => { logout(); navigate("/"); }}>
            <LogOut size={20} strokeWidth={1.7} />
          </button>
        ) : (
          <button className="icon-button" aria-label={t.aria.shoppingBag} onClick={() => navigate("/account")}>
            <ShoppingBag size={20} strokeWidth={1.7} />
          </button>
        )}
      </div>

      <div className={`mobile-panel ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <button className="icon-button close-button" aria-label={t.aria.closeMenu} onClick={() => setOpen(false)}>
          <X size={20} strokeWidth={1.7} />
        </button>
        {navItems.map((item) => (
          <NavLink to={item.to} key={item.to} onClick={() => setOpen(false)}>{item.label}</NavLink>
        ))}
        <NavLink to={roleHome(user)} onClick={() => setOpen(false)}>
          {user ? (user.role === "vendor" ? p.nav.vendorPortal : user.role === "dealer" ? p.dealer.title : user.role === "admin" ? p.nav.admin : p.nav.account) : p.nav.login}
        </NavLink>
      </div>
    </header>
  );
}

export function Footer() {
  const { t, p } = useLocale();
  // GitHub Pages 하위 경로에서도 동작하도록 router Link 사용
  const footerLinks = [
    { to: "/#collections", label: t.footer.links[0] },
    { to: "/guide/lab-diamond", label: t.footer.links[1] },
    { to: "/#concierge", label: t.footer.links[2] },
    { to: "/#products", label: t.footer.links[3] },
    { to: "/dealers/apply", label: p.dealerApply.title },
  ];
  return (
    <footer className="footer">
      <span className="brand">LUMINA LAB</span>
      <nav aria-label={t.aria.footerNav}>
        {footerLinks.map((link) => <Link to={link.to} key={link.to}>{link.label}</Link>)}
      </nav>
      <span>{t.footer.copyright}</span>
    </footer>
  );
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
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
