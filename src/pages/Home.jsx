import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Pause,
  Play,
} from "lucide-react";
import { useLocale } from "../i18n.jsx";
import { MediaThumb, withBase } from "../components/ui.jsx";
import { listReviews } from "../lib/store.js";
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
    title: ["Design yours."],
    body: "We compose the stone, the metal, and every detail around you.",
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
    title: ["당신만의 디자인."],
    body: "스톤·메탈·디테일은 당신에게 맞춰 완성합니다.",
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
    title: ["设计你的专属。"],
    body: "钻石、金属与每一处细节，皆为你而成。",
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
    title: ["Diseña la tuya."],
    body: "Componemos la piedra, el metal y cada detalle a tu medida.",
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
        >
          <source src={withBase("/assets/hero-main-2.mp4")} type="video/mp4" />
        </video>
      </div>

      <div className="hero-noir-mid">
        <p className="hero-noir-kicker">{t.hero.kicker}</p>
        <h1>
          <span className="l1">{t.hero.title[0]}</span>
          <span className="l2">
            <em>{t.hero.title[1]}</em>
          </span>
        </h1>
        <p className="hero-noir-lede">{t.hero.sub}</p>
      </div>

      <div className="hero-noir-foot">
        <div className="hero-noir-ctas">
          <Link className="noir-btn" to="/custom/new">
            {t.hero.cta ?? p.nav.startCustom}
            <ArrowRight size={15} strokeWidth={1.6} />
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


// ── Loved & Worn: 고객 리뷰 풀블리드 피드 (4+2 하이브리드: 피드 + 시네마틱 라이트박스) ──
const lovedCopy = {
  en: { kicker: "Loved & Worn", title: "See what we're creating", sub: "@beloved — real client moments", verified: "verified reviews", verifiedOne: "Verified order", share: "Share your moment", shareNote: "Delivered orders can leave a review from the order page — photos and video first.", close: "Close" },
  ko: { kicker: "Loved & Worn", title: "고객들의 순간", sub: "@beloved — 실제 주문 인증샷", verified: "인증 리뷰", verifiedOne: "주문 인증", share: "내 순간 남기기", shareNote: "배송 완료된 주문 페이지에서 사진·영상과 함께 리뷰를 남길 수 있어요.", close: "닫기" },
  zh: { kicker: "Loved & Worn", title: "客户的真实瞬间", sub: "@beloved — 真实订单晒单", verified: "认证评价", verifiedOne: "订单认证", share: "分享你的瞬间", shareNote: "已送达的订单可在订单页面上传照片或视频留下评价。", close: "关闭" },
  es: { kicker: "Loved & Worn", title: "Momentos de nuestros clientes", sub: "@beloved — pedidos reales", verified: "reseñas verificadas", verifiedOne: "Pedido verificado", share: "Comparte tu momento", shareNote: "Los pedidos entregados pueden dejar una reseña con fotos y video desde la página del pedido.", close: "Cerrar" },
};

function LovedWorn({ locale }) {
  const copy = lovedCopy[locale] || lovedCopy.en;
  const reviews = listReviews({ publishedOnly: true });
  const [open, setOpen] = useState(null); // review | null
  const [mIdx, setMIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const trackRef = useRef(null);
  // ESC 닫기 · ←/→ 미디어 넘기기 (훅은 조기 return 이전에)
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") setMIdx((i) => (i - 1 + open.media.length) % open.media.length);
      if (e.key === "ArrowRight") setMIdx((i) => (i + 1) % open.media.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (reviews.length === 0) return null;
  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  // iOS에서 scroll-snap mandatory와 scrollBy(smooth)가 충돌해 안 움직인다 → 셀 offsetLeft로 정확히 이동
  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const cells = [...el.querySelectorAll(".lw-cell")];
    if (cells.length === 0) return;
    const width = cells[0].offsetWidth + 10;
    const idx = Math.round(el.scrollLeft / width);
    const next = Math.min(Math.max(idx + dir, 0), cells.length - 1);
    el.scrollTo({ left: cells[next].offsetLeft - el.offsetLeft, behavior: "smooth" });
  };
  const active = open ? (open.media[mIdx] || open.media[0]) : null;
  return (
    <section className="lw-section" aria-label={copy.title}>
      <div className="lw-head">
        <p className="section-label">{copy.kicker}</p>
        <h2>{copy.title}</h2>
        <p className="lw-at">{copy.sub}</p>
        <div className="lw-agg"><strong>{avg}</strong><span className="lw-stars">{"★".repeat(5)}</span><span>{reviews.length} {copy.verified}</span></div>
      </div>
      <div className="lw-feed">
        <div className="lw-nav">
          <button className="lw-arrow" type="button" aria-label="Previous" onClick={() => scroll(-1)}>‹</button>
          <button className="lw-arrow" type="button" aria-label="Next" onClick={() => scroll(1)}>›</button>
        </div>
        <div
          className="lw-track"
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const max = el.scrollWidth - el.clientWidth;
            setProgress(max > 0 ? el.scrollLeft / max : 0);
          }}
        >
          {reviews.map((review) => (
            <button className="lw-cell" type="button" key={review.id} onClick={() => { setOpen(review); setMIdx(0); }}>
              <MediaThumb media={review.media[0]} ratio="4 / 5" alt={review.quote} />
              <span className="lw-veil">
                <span className="lw-stars">{"★".repeat(review.rating)}</span>
                <q>{review.quote}</q>
                <span className="lw-who"><b>{review.name}</b>{review.location ? ` · ${review.location}` : ""}</span>
                <span className="lw-verified">{copy.verifiedOne}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="lw-progress" aria-hidden="true"><i style={{ width: `${Math.max(progress * 100, 25)}%` }} /></div>
      </div>
      <div className="lw-cta">
        <Link className="noir-btn" to="/reviews/new">{copy.share}<ArrowRight size={15} strokeWidth={1.6} /></Link>
        <p>{copy.shareNote}</p>
      </div>

      {open && (
        <div className="lw-lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="lw-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="lw-lightbox-media">
              <MediaThumb media={active} ratio="4 / 5" alt={open.quote} eager />
              {open.media.length > 1 && (
                <div className="lw-lightbox-nav">
                  <button type="button" onClick={() => setMIdx((i) => (i - 1 + open.media.length) % open.media.length)}>‹</button>
                  <span>{mIdx + 1} / {open.media.length}</span>
                  <button type="button" onClick={() => setMIdx((i) => (i + 1) % open.media.length)}>›</button>
                </div>
              )}
            </div>
            <div className="lw-lightbox-copy">
              <span className="lw-stars">{"★".repeat(open.rating)}</span>
              <blockquote>“{open.quote}”</blockquote>
              {open.body && <p>{open.body}</p>}
              <span className="lw-who"><b>{open.name}</b>{open.location ? ` · ${open.location}` : ""}</span>
              <span className="lw-verified">{copy.verifiedOne}</span>
              <button className="button secondary small" type="button" onClick={() => setOpen(null)}>{copy.close}</button>
            </div>
          </div>
        </div>
      )}
    </section>
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
      <LovedWorn locale={locale} />
      <MobileDock locale={locale} p={p} />
    </>
  );
}
