import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Diamond,
  Heart,
  Leaf,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLocale } from "../i18n.jsx";
import { withBase } from "../components/ui.jsx";

const collectionImages = ["shot-ring", "shot-necklace", "shot-earrings"];
const productImages = ["product-ring", "product-band", "product-pendant", "product-studs", "product-bracelet"];

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
          poster={withBase("/assets/diamond-noir-white-poster.png")}
        >
          <source src={withBase("/assets/diamond-noir-white.mp4")} type="video/mp4" />
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
          <Link className="button primary" to="/diamonds">
            {t.hero.primaryCta}
            <ArrowRight size={18} strokeWidth={1.7} />
          </Link>
          <Link className="button secondary" to="/custom/new">
            {t.hero.secondaryCta}
          </Link>
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
        <Link className="text-link" to="/templates">
          {t.collections.link}
          <ArrowRight size={18} strokeWidth={1.6} />
        </Link>
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
      <Link to="/templates">{t.products.detail}</Link>
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
        <Link className="text-link" to="/diamonds">
          {t.products.viewAll}
          <ArrowRight size={18} strokeWidth={1.6} />
        </Link>
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
        <img src={withBase("/assets/lab-diamond-tweezers.png")} alt={t.aria.looseDiamondAlt} />
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
        <Link className="button secondary wide" to="/guide/lab-diamond">
          {t.quality.cta}
          <ArrowRight size={18} strokeWidth={1.6} />
        </Link>
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
        <Link className="button primary" to="/custom/new">
          {t.concierge.cta}
          <ArrowRight size={18} strokeWidth={1.7} />
        </Link>
      </div>
      <div className="concierge-visual" aria-hidden="true">
        <img src={withBase("/assets/lab-diamond-tweezers.png")} alt="" />
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useLocale();

  return (
    <>
      <Hero t={t} />
      <Collections t={t} />
      <Products t={t} />
      <Quality t={t} />
      <Concierge t={t} />
    </>
  );
}
