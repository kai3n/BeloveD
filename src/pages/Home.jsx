import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Pause,
  Play,
} from "lucide-react";
import { useLocale } from "../i18n.jsx";
import { withBase } from "../components/ui.jsx";
import { useDBVersion } from "../lib/useDB.js";
import { DESIGN_CATEGORIES } from "../lib/designSlots.js";

const collectionImageClass = {
  ring: "shot-ring",
  earrings: "shot-earrings",
  bangle: "shot-bracelet",
  necklace: "shot-necklace",
};

const collectionCopy = {
  en: {
    label: "THE ATELIER",
    title: ["The atelier", "of you."],
    body: "Choose a silhouette. We compose the stone, the metal, and every detail around you.",
    viewAll: "Explore all",
    shopLabel: (name) => `Shop ${name.toLowerCase()}`,
    items: {
      ring: { label: "Rings", short: "ring", body: "Engagement rings and signature settings." },
      earrings: { label: "Earrings", short: "earrings", body: "Studs, drops, and daily diamonds." },
      bangle: { label: "Bracelets", short: "bracelet", body: "Tennis bracelets and refined wrist pieces." },
      necklace: { label: "Necklaces", short: "necklace", body: "Pendants and clean diamond necklaces." },
    },
  },
  ko: {
    label: "아틀리에",
    title: ["당신만의", "아틀리에."],
    body: "실루엣을 고르면, 스톤·메탈·디테일을 당신에게 맞춰 완성합니다.",
    viewAll: "전체 둘러보기",
    shopLabel: (name) => `${name} 보기`,
    items: {
      ring: { label: "링", short: "링", body: "프로포즈 링과 시그니처 세팅." },
      earrings: { label: "이어링", short: "이어링", body: "스터드, 드롭, 데일리 다이아몬드." },
      bangle: { label: "브레이슬릿", short: "브레이슬릿", body: "테니스 브레이슬릿과 정제된 손목 피스." },
      necklace: { label: "네크리스", short: "네크리스", body: "펜던트와 클린한 다이아몬드 네크리스." },
    },
  },
  zh: {
    label: "工坊",
    title: ["你的专属", "工坊。"],
    body: "先选轮廓，钻石、金属与每一处细节，皆为你而成。",
    viewAll: "浏览全部",
    shopLabel: (name) => `查看${name}`,
    items: {
      ring: { label: "戒指", short: "戒指", body: "订婚戒指与经典主石镶嵌。" },
      earrings: { label: "耳环", short: "耳环", body: "耳钉、垂坠款与日常钻饰。" },
      bangle: { label: "手链", short: "手链", body: "网球手链与精致腕间钻饰。" },
      necklace: { label: "项链", short: "项链", body: "吊坠与简洁钻石项链。" },
    },
  },
  es: {
    label: "EL ATELIER",
    title: ["Tu atelier", "a medida."],
    body: "Elige la silueta. Componemos la piedra, el metal y cada detalle a tu medida.",
    viewAll: "Explorar todo",
    shopLabel: (name) => `Ver ${name.toLowerCase()}`,
    items: {
      ring: { label: "Anillos", short: "anillo", body: "Anillos de compromiso y monturas signature." },
      earrings: { label: "Aretes", short: "aretes", body: "Studs, caídas y diamantes diarios." },
      bangle: { label: "Pulseras", short: "pulsera", body: "Pulseras tenis y piezas refinadas de muñeca." },
      necklace: { label: "Collares", short: "collar", body: "Colgantes y collares de diamante limpios." },
    },
  },
};

const quoteBoardCopy = {
  en: {
    label: "PRICE CHECK",
    stoneTitle: ["Choose the stone.", "See the spread."],
    boardTitle: ["Retail markup,", "made visible."],
    body: "Comparable 1ct lab-grown diamond ranges, shown against BeloveD direct custom quotes.",
    belovedSpec: "Comparable 1.00ct / VS+ / Ideal",
    browse: "Start a request",
    custom: "Start custom order",
    stonePanelAria: "BeloveD diamond pricing reference",
    chipsAria: "Comparison stone specification",
    listAria: "Lab diamond price range comparison",
    chips: ["1.00ct", "VS+", "Ideal", "IGI / GIA"],
    savingsPill: "BeloveD starts at $320",
    saveBadge: "Lowest range",
    saveLine: "Up to $560 less than Blue Nile",
    note: "Example loose-stone ranges. Final quote depends on live inventory, certificate, setting, and metal.",
    stats: [
      { value: "$320+", label: "Entry loose-stone quote" },
      { value: "1.00ct", label: "Comparable lab-grown example" },
      { value: "VS+", label: "Clean everyday clarity target" },
    ],
  },
  ko: {
    label: "가격 비교",
    stoneTitle: ["스톤을 고르고", "차이를 보세요."],
    boardTitle: ["리테일 마크업을", "눈에 보이게."],
    body: "1캐럿 랩다이아몬드 기준 비교 범위를 BeloveD 직접 견적과 나란히 보여드립니다.",
    belovedSpec: "동급 1.00ct / VS+ / Ideal",
    browse: "요청 시작하기",
    custom: "주문제작 시작",
    stonePanelAria: "BeloveD 다이아몬드 가격 비교",
    chipsAria: "비교 스톤 사양",
    listAria: "랩다이아몬드 가격 범위 비교",
    chips: ["1.00ct", "VS+", "Ideal", "IGI / GIA"],
    savingsPill: "BeloveD는 $320부터",
    saveBadge: "가장 낮은 범위",
    saveLine: "Blue Nile 대비 최대 $560 낮게",
    note: "루스 스톤 예시 범위입니다. 최종 견적은 실시간 재고, 인증서, 세팅, 메탈에 따라 달라집니다.",
    stats: [
      { value: "$320+", label: "루스 스톤 시작 견적" },
      { value: "1.00ct", label: "비교 기준 랩다이아" },
      { value: "VS+", label: "데일리로 깨끗한 등급" },
    ],
  },
  zh: {
    label: "价格对比",
    stoneTitle: ["先选主石", "再看差价。"],
    boardTitle: ["零售溢价", "一眼看清。"],
    body: "以 1 克拉培育钻石为例，对比 BeloveD 直接定制报价与常见零售区间。",
    belovedSpec: "同级 1.00ct / VS+ / Ideal",
    browse: "开始需求",
    custom: "开始定制",
    stonePanelAria: "BeloveD 钻石价格参考",
    chipsAria: "对比钻石规格",
    listAria: "培育钻石价格区间对比",
    chips: ["1.00ct", "VS+", "Ideal", "IGI / GIA"],
    savingsPill: "BeloveD $320 起",
    saveBadge: "更低区间",
    saveLine: "比 Blue Nile 最高低 $560",
    note: "裸石价格为示例区间。最终报价取决于实时库存、证书、镶嵌和金属。",
    stats: [
      { value: "$320+", label: "裸石起始报价" },
      { value: "1.00ct", label: "培育钻石对比规格" },
      { value: "VS+", label: "日常佩戴净度目标" },
    ],
  },
  es: {
    label: "COMPARA PRECIO",
    stoneTitle: ["Elige la piedra.", "Mira la diferencia."],
    boardTitle: ["El margen retail,", "a la vista."],
    body: "Rangos comparables de diamantes lab-grown de 1 ct frente a una cotización directa BeloveD.",
    belovedSpec: "Equivalente 1.00ct / VS+ / Ideal",
    browse: "Iniciar solicitud",
    custom: "Crear pedido",
    stonePanelAria: "Referencia de precio de diamantes BeloveD",
    chipsAria: "Especificación de piedra comparable",
    listAria: "Comparación de rangos de precio lab-grown",
    chips: ["1.00ct", "VS+", "Ideal", "IGI / GIA"],
    savingsPill: "BeloveD desde $320",
    saveBadge: "Rango más bajo",
    saveLine: "Hasta $560 menos que Blue Nile",
    note: "Rangos de piedra suelta como ejemplo. La cotización final depende de inventario, certificado, montura y metal.",
    stats: [
      { value: "$320+", label: "Cotización inicial" },
      { value: "1.00ct", label: "Ejemplo comparable" },
      { value: "VS+", label: "Claridad limpia diaria" },
    ],
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

function Hero({ t, p }) {
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

  const specs = (t.hero.sub2 || "")
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <section className={`hero-noir ${playing ? "is-playing" : "is-paused"}`} id="top">
      <div className="hero-noir-media" aria-hidden="true">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={withBase("/assets/diamond-hero-white-poster.webp")}
        >
          <source src={withBase("/assets/diamond-hero-white.mp4")} type="video/mp4" />
        </video>
      </div>

      <div className="hero-noir-frame" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <span className="hero-noir-vlabel" aria-hidden="true">Est. 2026</span>

      <div className="hero-noir-mid">
        <p className="hero-noir-kicker">{t.hero.kicker}</p>
        <h1>
          <span className="l1">{t.hero.title[0]}</span>
          <span className="l2">
            <em>{t.hero.title[1]}</em>
          </span>
        </h1>
        <span className="hero-noir-rule" aria-hidden="true" />
        <p className="hero-noir-lede">{t.hero.sub}</p>
      </div>

      <div className="hero-noir-foot">
        {specs.length > 0 && (
          <div className="hero-noir-spec">
            {specs.map((spec) => (
              <span key={spec}>{spec}</span>
            ))}
          </div>
        )}
        <div className="hero-noir-ctas">
          <Link className="noir-btn" to="/custom/new">
            {t.hero.cta ?? p.nav.startCustom}
            <ArrowRight size={15} strokeWidth={1.6} />
          </Link>
          <Link className="noir-link" to="/designs">
            {t.collections.link}
          </Link>
        </div>
      </div>

      <button
        className="control-button hero-noir-pause"
        aria-label={playing ? t.aria.pauseHero : t.aria.playHero}
        onClick={() => setPlaying((current) => !current)}
      >
        {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
      </button>
    </section>
  );
}

function Collections({ locale }) {
  const copy = collectionCopy[locale] ?? collectionCopy.en;

  return (
    <section className="coll-noir" id="collections">
      <div className="coll-noir-head">
        <span className="coll-noir-eyebrow">{copy.label}</span>
        <h2>{renderLines(copy.title)}</h2>
        <p className="coll-noir-sub">{copy.body}</p>
      </div>

      <div className="coll-noir-gallery">
        {DESIGN_CATEGORIES.map((category) => {
          const item = copy.items[category.key] ?? collectionCopy.en.items[category.key];
          return (
            <Link
              className="coll-noir-piece"
              key={category.key}
              to={`/designs?category=${category.key}`}
              aria-label={item.label}
            >
              <span className={`coll-noir-ph ${collectionImageClass[category.key]}`} aria-hidden="true" />
              <span className="coll-noir-meta">
                <span className="coll-noir-name">{item.label}</span>
                <span className="coll-noir-cap">{item.body}</span>
                <span className="coll-noir-discover">
                  {copy.shopLabel(item.short)}
                  <ArrowRight size={14} strokeWidth={1.8} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function HomeCore({ locale }) {
  const copy = quoteBoardCopy[locale] ?? quoteBoardCopy.en;
  const comparisons = [
    {
      seller: "Blue Nile",
      range: "$650-$950",
      spec: "1.00ct D-F / VS1-VS2 / Ideal",
      cert: "GIA / IGI",
      width: "100%",
    },
    {
      seller: "Brilliant Earth",
      range: "$520-$820",
      spec: "1.00ct F-G / VS1-VS2 / Ideal",
      cert: "IGI / GIA",
      width: "82%",
    },
    {
      seller: "BeloveD",
      range: "$320-$390",
      spec: copy.belovedSpec,
      cert: "IGI / GIA",
      width: "41%",
    },
  ];

  return (
    <section className="spread-noir" id="beloved-way">
      <div className="spread-noir-head">
        <span className="noir-eyebrow">{copy.label}</span>
        <h2>{renderLines(copy.boardTitle)}</h2>
        <p className="noir-sub">{copy.body}</p>
        <span className="spread-noir-pill">{copy.savingsPill}</span>
      </div>

      <div className="spread-noir-chips" aria-label={copy.chipsAria}>
        {copy.chips.map((chip) => <span key={chip}>{chip}</span>)}
      </div>

      <div className="spread-noir-bars" role="list" aria-label={copy.listAria}>
        {comparisons.map(({ seller, range, spec, cert, width }) => {
          const isBeloved = seller === "BeloveD";
          return (
            <article className={`spread-noir-row ${isBeloved ? "is-beloved" : ""}`} role="listitem" key={seller}>
              <div className="spread-noir-rowtop">
                <div className="spread-noir-brand">
                  <strong>{seller}</strong>
                  {isBeloved ? <em>{copy.saveBadge}</em> : null}
                </div>
                <span className="spread-noir-range">{range}</span>
              </div>
              <div className="spread-noir-track" aria-hidden="true">
                <span className="spread-noir-fill" style={{ "--bar-width": width }} />
              </div>
              <div className="spread-noir-rowfoot">
                <p>{spec} · {cert}</p>
                {isBeloved ? <strong>{copy.saveLine}</strong> : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="spread-noir-stats">
        {copy.stats.map((stat) => (
          <div className="spread-noir-stat" key={stat.value}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <p className="spread-noir-note">{copy.note}</p>
      <div className="spread-noir-actions">
        <Link className="noir-btn" to="/custom/new">
          {copy.browse}
          <ArrowRight size={15} strokeWidth={1.6} />
        </Link>
        <Link className="noir-link" to="/custom/new">
          {copy.custom}
        </Link>
      </div>
    </section>
  );
}

const dockCopy = {
  en: { title: "Design yours", note: "No payment until you accept the quote" },
  ko: { title: "당신의 디자인", note: "견적 수락 전까지 결제 없음" },
  zh: { title: "为你定制", note: "接受报价前无需付款" },
  es: { title: "Diseña la tuya", note: "Sin pago hasta aceptar la cotización" },
};

function MobileDock({ locale, p }) {
  const copy = dockCopy[locale] ?? dockCopy.en;
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Link className={`noir-dock ${show ? "show" : ""}`} to="/custom/new" aria-hidden={!show}>
      <span className="noir-dock-lab">
        <b>{copy.title}</b>
        <span>{copy.note}</span>
      </span>
      <span className="noir-dock-go">
        {p.nav.startCustom}
        <ArrowRight size={14} strokeWidth={1.6} />
      </span>
    </Link>
  );
}

export default function Home() {
  useDBVersion();
  const { locale, t, p } = useLocale();

  return (
    <>
      {/* day 모드 아이보리 갤러리 — 제품컷 검은 배경을 휘도→알파로 키잉해 아이보리 위에 띄움 */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
        <filter id="keyBlack" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0.299 0.587 0.114 0 0" />
          <feComponentTransfer>
            <feFuncA type="gamma" amplitude="1" exponent="1.7" offset="0" />
          </feComponentTransfer>
        </filter>
      </svg>
      <Hero t={t} p={p} />
      <Collections locale={locale} />
      <HomeCore locale={locale} />
      <MobileDock locale={locale} p={p} />
    </>
  );
}
