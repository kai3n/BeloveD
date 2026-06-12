import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Diamond,
  Heart,
  Languages,
  Leaf,
  Menu,
  Pause,
  Play,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

const localeOptions = [
  { code: "en", label: "EN", name: "English", htmlLang: "en" },
  { code: "zh", label: "中文", name: "Chinese", htmlLang: "zh-CN" },
  { code: "ko", label: "KO", name: "Korean", htmlLang: "ko" },
  { code: "es", label: "ES", name: "Spanish", htmlLang: "es" },
];

const productNavItems = [
  { key: "rings", href: "#products" },
  { key: "necklaces", href: "#products" },
  { key: "earrings", href: "#products" },
  { key: "bracelets", href: "#products" },
];

const mobileNavItems = [
  ...productNavItems,
  { key: "labDiamond", href: "#lab-diamond" },
  { key: "concierge", href: "#concierge" },
];

const collectionImages = ["shot-ring", "shot-necklace", "shot-earrings"];
const productImages = ["product-ring", "product-band", "product-pendant", "product-studs", "product-bracelet"];

const translations = {
  en: {
    meta: {
      title: "LUMINA LAB | Lab Diamond Jewelry",
      description: "LUMINA LAB luxury lab-grown diamond jewelry concept store.",
    },
    aria: {
      primaryNav: "Primary navigation",
      language: "Select language",
      search: "Search",
      account: "Account",
      shoppingBag: "Shopping bag",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      heroMedia: "Hero media control",
      pauseHero: "Pause hero motion",
      playHero: "Play hero motion",
      footerNav: "Footer navigation",
      looseDiamondAlt: "A loose lab diamond held by black jeweler tweezers",
      wishlist: (name) => `${name} wishlist`,
    },
    nav: {
      rings: "Rings",
      necklaces: "Necklaces",
      earrings: "Earrings",
      bracelets: "Bracelets",
      labDiamond: "Lab Diamond",
      concierge: "Concierge",
    },
    hero: {
      kicker: "Lab-Grown Diamond Maison",
      sub: "A perfect diamond — without digging the earth.",
      sub2: "Same properties as mined · IGI certified · Half the price",
      primaryCta: "Shop diamonds",
      secondaryCta: "Build a ring",
      scroll: "Scroll",
    },
    collections: {
      label: "COLLECTIONS",
      title: ["Essential", "diamond pieces"],
      body: "Rings, pendants, and studs built around certified stones.",
      link: "View collections",
      items: [
        { name: "AURORA", copy: "Solitaire rings" },
        { name: "LUCENT", copy: "Diamond pendants" },
        { name: "ECLAT", copy: "Stud earrings" },
      ],
    },
    products: {
      label: "BEST SELLERS",
      title: "Best Sellers",
      viewAll: "Shop all",
      detail: "Shop now",
      items: [
        { name: "Lumina Solitaire Ring 1.0ct", price: "₩2,190,000" },
        { name: "Eternity Band Ring", price: "₩1,690,000" },
        { name: "Lumina Pendant 1.0ct", price: "₩1,290,000" },
        { name: "Classic Stud Earrings 1.0ct", price: "₩1,090,000" },
        { name: "Tennis Bracelet", price: "₩2,590,000" },
      ],
    },
    quality: {
      label: "LAB-GROWN. CERTIFIED. REAL.",
      title: ["Certified diamonds.", "Clearer value."],
      body: "Same optical and chemical properties. Verified stones. Transparent pricing.",
      cta: "Learn about lab diamonds",
      points: [
        { title: "IGI certified", copy: "Verified grading" },
        { title: "Lab-grown", copy: "No mining needed" },
        { title: "Lifetime care", copy: "Service included" },
        { title: "Clear pricing", copy: "No mined markup" },
      ],
    },
    concierge: {
      title: ["Private", "diamond sourcing"],
      body: "Tell us the shape, carat, and budget. We will shortlist the stones.",
      cta: "Book a private appointment",
    },
    footer: {
      links: ["About", "Diamond Guide", "Client Care", "Store Visit"],
      copyright: "© 2026 LUMINA LAB. All Rights Reserved.",
    },
  },
  zh: {
    meta: {
      title: "LUMINA LAB | 培育钻石珠宝",
      description: "LUMINA LAB 高级培育钻石珠宝概念店。",
    },
    aria: {
      primaryNav: "主导航",
      language: "选择语言",
      search: "搜索",
      account: "账户",
      shoppingBag: "购物袋",
      openMenu: "打开菜单",
      closeMenu: "关闭菜单",
      heroMedia: "首页媒体控制",
      pauseHero: "暂停首页动效",
      playHero: "播放首页动效",
      footerNav: "页脚导航",
      looseDiamondAlt: "黑色珠宝镊夹着一颗裸培育钻石",
      wishlist: (name) => `收藏 ${name}`,
    },
    nav: {
      rings: "戒指",
      necklaces: "项链",
      earrings: "耳环",
      bracelets: "手链",
      labDiamond: "培育钻石",
      concierge: "礼宾服务",
    },
    hero: {
      kicker: "Lab-Grown Diamond Maison",
      sub: "不开采地球，也能拥有完美钻石",
      sub2: "与天然同质 · IGI 认证 · 一半的价格",
      primaryCta: "选购钻石",
      secondaryCta: "定制戒指",
      scroll: "向下探索",
    },
    collections: {
      label: "系列",
      title: ["经典钻饰", "日常佩戴"],
      body: "戒指、吊坠与耳钉，以认证钻石为核心。",
      link: "浏览系列",
      items: [
        { name: "AURORA", copy: "主石戒指" },
        { name: "LUCENT", copy: "精致吊坠" },
        { name: "ECLAT", copy: "日常耳钉" },
      ],
    },
    products: {
      label: "畅销臻选",
      title: "人气之选",
      viewAll: "查看全部",
      detail: "查看详情",
      items: [
        { name: "Lumina 单钻戒 1.0ct", price: "₩2,190,000" },
        { name: "Eternity 排钻戒圈", price: "₩1,690,000" },
        { name: "Lumina 吊坠 1.0ct", price: "₩1,290,000" },
        { name: "经典钻石耳钉 1.0ct", price: "₩1,090,000" },
        { name: "Tennis 钻石手链", price: "₩2,590,000" },
      ],
    },
    quality: {
      label: "实验室培育。认证真钻。",
      title: ["认证钻石", "价值更清楚"],
      body: "相同光学与化学性质，证书清晰，价格透明。",
      cta: "了解培育钻石",
      points: [
        { title: "IGI 认证", copy: "等级清楚" },
        { title: "实验室培育", copy: "无需矿采" },
        { title: "长期养护", copy: "售后支持" },
        { title: "透明定价", copy: "少一点溢价" },
      ],
    },
    concierge: {
      title: ["私人选钻", "按预算匹配"],
      body: "告诉我们形状、克拉与预算，我们帮你筛选合适钻石。",
      cta: "预约私人顾问",
    },
    footer: {
      links: ["品牌介绍", "钻石指南", "客户服务", "门店预约"],
      copyright: "© 2026 LUMINA LAB. 保留所有权利。",
    },
  },
  ko: {
    meta: {
      title: "LUMINA LAB | 랩다이아몬드 주얼리",
      description: "LUMINA LAB 럭셔리 랩그로운 다이아몬드 주얼리 콘셉트 스토어.",
    },
    aria: {
      primaryNav: "주요 내비게이션",
      language: "언어 선택",
      search: "검색",
      account: "계정",
      shoppingBag: "쇼핑백",
      openMenu: "메뉴 열기",
      closeMenu: "메뉴 닫기",
      heroMedia: "히어로 미디어 컨트롤",
      pauseHero: "히어로 모션 일시정지",
      playHero: "히어로 모션 재생",
      footerNav: "푸터 내비게이션",
      looseDiamondAlt: "블랙 주얼러 트위저에 고정된 루스 랩다이아몬드",
      wishlist: (name) => `${name} 위시리스트`,
    },
    nav: {
      rings: "링",
      necklaces: "네크리스",
      earrings: "이어링",
      bracelets: "브레이슬릿",
      labDiamond: "랩 다이아몬드",
      concierge: "콘시어지",
    },
    hero: {
      kicker: "Lab-Grown Diamond Maison",
      sub: "지구를 캐지 않은, 완벽한 다이아몬드",
      sub2: "천연과 동일한 물성 · IGI 인증 · 절반의 가격",
      primaryCta: "다이아몬드 쇼핑하기",
      secondaryCta: "나만의 링 세팅",
      scroll: "아래로 살펴보기",
    },
    collections: {
      label: "COLLECTIONS",
      title: ["기본에 가까운", "다이아몬드 피스"],
      body: "인증 스톤을 중심으로 만든 링, 펜던트, 이어링.",
      link: "컬렉션 보기",
      items: [
        { name: "AURORA", copy: "솔리테어 링" },
        { name: "LUCENT", copy: "데일리 펜던트" },
        { name: "ECLAT", copy: "스터드 이어링" },
      ],
    },
    products: {
      label: "BEST SELLERS",
      title: "가장 사랑받는 피스",
      viewAll: "전체 보기",
      detail: "자세히 보기",
      items: [
        { name: "루미나 솔리테어 링 1.0ct", price: "₩2,190,000" },
        { name: "이터니티 다이아 밴드", price: "₩1,690,000" },
        { name: "루미나 펜던트 1.0ct", price: "₩1,290,000" },
        { name: "클래식 스터드 이어링 1.0ct", price: "₩1,090,000" },
        { name: "테니스 브레이슬릿", price: "₩2,590,000" },
      ],
    },
    quality: {
      label: "랩그로운. 인증된 진짜 다이아몬드.",
      title: ["인증된 다이아몬드.", "더 명확한 가치."],
      body: "동일한 광학·화학적 특성, 검증된 스톤, 투명한 가격.",
      cta: "랩 다이아몬드 알아보기",
      points: [
        { title: "IGI 인증", copy: "등급이 분명한 스톤" },
        { title: "랩그로운", copy: "채굴 없이 완성" },
        { title: "평생 케어", copy: "구매 후 관리" },
        { title: "투명한 가격", copy: "불필요한 프리미엄 없이" },
      ],
    },
    concierge: {
      title: ["프라이빗", "다이아몬드 소싱"],
      body: "형태, 캐럿, 예산만 알려주세요. 어울리는 스톤을 선별해드립니다.",
      cta: "프라이빗 상담 예약",
    },
    footer: {
      links: ["브랜드 소개", "다이아몬드 가이드", "고객 서비스", "스토어 안내"],
      copyright: "© 2026 LUMINA LAB. All Rights Reserved.",
    },
  },
  es: {
    meta: {
      title: "LUMINA LAB | Joyería de diamantes de laboratorio",
      description: "Tienda conceptual de joyería de lujo con diamantes cultivados en laboratorio.",
    },
    aria: {
      primaryNav: "Navegación principal",
      language: "Seleccionar idioma",
      search: "Buscar",
      account: "Cuenta",
      shoppingBag: "Bolsa de compra",
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
      heroMedia: "Control del video principal",
      pauseHero: "Pausar movimiento principal",
      playHero: "Reproducir movimiento principal",
      footerNav: "Navegación del pie de página",
      looseDiamondAlt: "Un diamante de laboratorio suelto sostenido por pinzas negras de joyería",
      wishlist: (name) => `Guardar ${name}`,
    },
    nav: {
      rings: "Anillos",
      necklaces: "Collares",
      earrings: "Aretes",
      bracelets: "Pulseras",
      labDiamond: "Diamante Lab",
      concierge: "Concierge",
    },
    hero: {
      kicker: "Lab-Grown Diamond Maison",
      sub: "Un diamante perfecto, sin excavar la tierra.",
      sub2: "Idéntico al natural · Certificado IGI · La mitad del precio",
      primaryCta: "Ver diamantes",
      secondaryCta: "Crear anillo",
      scroll: "Explorar",
    },
    collections: {
      label: "COLECCIONES",
      title: ["Piezas esenciales", "con diamantes"],
      body: "Anillos, colgantes y aretes creados alrededor de piedras certificadas.",
      link: "Ver colecciones",
      items: [
        { name: "AURORA", copy: "Anillos solitarios" },
        { name: "LUCENT", copy: "Colgantes" },
        { name: "ECLAT", copy: "Aretes" },
      ],
    },
    products: {
      label: "MÁS VENDIDOS",
      title: "Favoritos de la casa",
      viewAll: "Ver todo",
      detail: "Ver pieza",
      items: [
        { name: "Anillo solitario Lumina 1.0ct", price: "₩2,190,000" },
        { name: "Anillo Eternity Band", price: "₩1,690,000" },
        { name: "Colgante Lumina 1.0ct", price: "₩1,290,000" },
        { name: "Aretes clásicos 1.0ct", price: "₩1,090,000" },
        { name: "Pulsera tenis", price: "₩2,590,000" },
      ],
    },
    quality: {
      label: "LAB-GROWN. CERTIFICADO. REAL.",
      title: ["Diamantes certificados.", "Valor más claro."],
      body: "Las mismas propiedades ópticas y químicas. Piedras verificadas. Precio transparente.",
      cta: "Conocer nuestros diamantes",
      points: [
        { title: "Certificación IGI", copy: "Grado verificado" },
        { title: "Lab-grown", copy: "Sin minería" },
        { title: "Cuidado de por vida", copy: "Servicio incluido" },
        { title: "Precio claro", copy: "Sin margen de mina" },
      ],
    },
    concierge: {
      title: ["Selección privada", "de diamantes"],
      body: "Dinos la forma, el quilataje y el presupuesto. Te enviaremos una selección curada.",
      cta: "Reservar cita privada",
    },
    footer: {
      links: ["Marca", "Guía de diamantes", "Atención al cliente", "Visita la tienda"],
      copyright: "© 2026 LUMINA LAB. Todos los derechos reservados.",
    },
  },
};

function renderLines(lines) {
  return lines.map((line, index) => (
    <span className="title-line" key={line}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function getLocalizedCollections(t) {
  return t.collections.items.map((item, index) => ({
    ...item,
    imageClass: collectionImages[index],
  }));
}

function getLocalizedProducts(t) {
  return t.products.items.map((item, index) => ({
    ...item,
    imageClass: productImages[index],
  }));
}

function Header({ locale, onLocaleChange, t }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <button className="mobile-menu-button" aria-label={t.aria.openMenu} onClick={() => setOpen(true)}>
        <Menu size={22} strokeWidth={1.7} />
      </button>

      <a className="brand" href="#top" aria-label="LUMINA LAB home">
        LUMINA LAB
      </a>

      <nav className="desktop-nav" aria-label={t.aria.primaryNav}>
        {productNavItems.map((item) => (
          <a href={item.href} key={item.key}>
            {t.nav[item.key]}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <label className="language-control">
          <Languages size={16} strokeWidth={1.7} aria-hidden="true" />
          <select
            aria-label={t.aria.language}
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value)}
          >
            {localeOptions.map((option) => (
              <option value={option.code} key={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className="icon-button" aria-label={t.aria.search}>
          <Search size={20} strokeWidth={1.7} />
        </button>
        <button className="icon-button" aria-label={t.aria.account}>
          <UserRound size={20} strokeWidth={1.7} />
        </button>
        <button className="icon-button" aria-label={t.aria.shoppingBag}>
          <ShoppingBag size={20} strokeWidth={1.7} />
        </button>
      </div>

      <div className={`mobile-panel ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <button className="icon-button close-button" aria-label={t.aria.closeMenu} onClick={() => setOpen(false)}>
          <X size={20} strokeWidth={1.7} />
        </button>
        {mobileNavItems.map((item) => (
          <a href={item.href} key={item.key} onClick={() => setOpen(false)}>
            {t.nav[item.key]}
          </a>
        ))}
      </div>
    </header>
  );
}

function Hero({ t }) {
  const [playing, setPlaying] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (playing) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing]);

  return (
    <section className={`hero ${playing ? "is-playing" : "is-paused"}`} id="top">
      <div className="hero-media" aria-hidden="true">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/assets/diamond-noir-white-poster.png"
        >
          <source src="/assets/diamond-noir-white.mp4" type="video/mp4" />
        </video>
      </div>
      <span className="spark sparkle-one" aria-hidden="true" />
      <span className="spark sparkle-two" aria-hidden="true" />
      <span className="spark sparkle-three" aria-hidden="true" />

      <div className="hero-copy-top">
        <p className="hero-kicker">{t.hero.kicker}</p>
        <h1>
          GROWN,
          <br />
          <em>not mined.</em>
        </h1>
      </div>

      <div className="hero-copy-bottom">
        <p className="hero-sub">{t.hero.sub}</p>
        <p className="hero-sub2">{t.hero.sub2}</p>
        <div className="hero-ctas">
          <a className="button primary" href="#collections">
            {t.hero.primaryCta}
            <ArrowRight size={18} strokeWidth={1.7} />
          </a>
          <a className="button secondary" href="#concierge">
            {t.hero.secondaryCta}
          </a>
        </div>
      </div>

      <button
        className="control-button hero-pause"
        aria-label={playing ? t.aria.pauseHero : t.aria.playHero}
        onClick={() => setPlaying((current) => !current)}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>

      <a className="scroll-cue" href="#collections">
        {t.hero.scroll}
        <ChevronDown size={18} strokeWidth={1.6} />
      </a>
    </section>
  );
}

function Collections({ t }) {
  const collections = getLocalizedCollections(t);

  return (
    <section className="section collections" id="collections">
      <div className="section-copy">
        <p className="section-label">{t.collections.label}</p>
        <h2>{renderLines(t.collections.title)}</h2>
        <p>{t.collections.body}</p>
        <a className="text-link" href="#products">
          {t.collections.link}
          <ArrowRight size={18} strokeWidth={1.6} />
        </a>
      </div>

      <div className="collection-grid">
        {collections.map((collection) => (
          <article className="collection-tile" key={collection.name}>
            <div className={`lineup-crop ${collection.imageClass}`} role="img" aria-label={`${collection.name} collection jewelry`} />
            <h3>{collection.name}</h3>
            <p>{collection.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductCard({ product, t }) {
  const [favorite, setFavorite] = useState(false);

  return (
    <article className="product-card">
      <button
        className={`favorite ${favorite ? "is-active" : ""}`}
        aria-label={t.aria.wishlist(product.name)}
        onClick={() => setFavorite((current) => !current)}
      >
        <Heart size={18} strokeWidth={1.5} fill={favorite ? "currentColor" : "none"} />
      </button>
      <div className={`product-image ${product.imageClass}`} role="img" aria-label={product.name} />
      <h3>{product.name}</h3>
      <p>{product.price}</p>
      <a href="#concierge">{t.products.detail}</a>
    </article>
  );
}

function Products({ t }) {
  const products = getLocalizedProducts(t);

  return (
    <section className="section products" id="products">
      <div className="section-heading">
        <div>
          <p className="section-label">{t.products.label}</p>
          <h2>{t.products.title}</h2>
        </div>
        <a className="text-link" href="#products">
          {t.products.viewAll}
          <ArrowRight size={18} strokeWidth={1.6} />
        </a>
      </div>

      <div className="product-row">
        {products.map((product) => (
          <ProductCard product={product} t={t} key={product.name} />
        ))}
      </div>
    </section>
  );
}

function Quality({ t }) {
  const pointIcons = [Diamond, Leaf, ShieldCheck, Sparkles];
  const points = t.quality.points.map((point, index) => ({
    ...point,
    icon: pointIcons[index],
  }));

  return (
    <section className="quality" id="lab-diamond">
      <div className="quality-image">
        <img src="/assets/lab-diamond-tweezers.png" alt={t.aria.looseDiamondAlt} />
      </div>
      <div className="quality-copy">
        <p className="section-label">{t.quality.label}</p>
        <h2>{renderLines(t.quality.title)}</h2>
        <p>{t.quality.body}</p>
        <div className="quality-points">
          {points.map(({ icon: Icon, title, copy }) => (
            <div className="quality-point" key={title}>
              <Icon size={26} strokeWidth={1.35} />
              <strong>{title}</strong>
              <span>{copy}</span>
            </div>
          ))}
        </div>
        <a className="button secondary wide" href="#lab-diamond">
          {t.quality.cta}
          <ArrowRight size={18} strokeWidth={1.6} />
        </a>
      </div>
    </section>
  );
}

function Concierge({ t }) {
  return (
    <section className="concierge" id="concierge">
      <div className="concierge-copy">
        <h2>{renderLines(t.concierge.title)}</h2>
        <p>{t.concierge.body}</p>
        <a className="button primary" href="mailto:concierge@luminalab.example">
          {t.concierge.cta}
          <ArrowRight size={18} strokeWidth={1.7} />
        </a>
      </div>
      <div className="concierge-visual" aria-hidden="true">
        <img src="/assets/lab-diamond-tweezers.png" alt="" />
      </div>
    </section>
  );
}

function Footer({ t }) {
  const footerLinks = [
    { href: "#collections", label: t.footer.links[0] },
    { href: "#lab-diamond", label: t.footer.links[1] },
    { href: "#concierge", label: t.footer.links[2] },
    { href: "#products", label: t.footer.links[3] },
  ];

  return (
    <footer className="footer">
      <span className="brand">LUMINA LAB</span>
      <nav aria-label={t.aria.footerNav}>
        {footerLinks.map((link) => (
          <a href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <span>{t.footer.copyright}</span>
    </footer>
  );
}

export default function App() {
  const [locale, setLocale] = useState("en");
  const t = translations[locale];

  useEffect(() => {
    const option = localeOptions.find((item) => item.code === locale);
    document.documentElement.lang = option?.htmlLang ?? "en";
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
  }, [locale, t.meta.description, t.meta.title]);

  return (
    <>
      <Header locale={locale} onLocaleChange={setLocale} t={t} />
      <main>
        <Hero t={t} />
        <Collections t={t} />
        <Products t={t} />
        <Quality t={t} />
        <Concierge t={t} />
      </main>
      <Footer t={t} />
    </>
  );
}
