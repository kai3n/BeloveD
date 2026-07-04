import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLocale } from "../i18n.jsx";
import { BENCHMARK_SHAPES } from "../lib/ops.js";
import { ShapeSilhouette } from "../components/intake/pickers.jsx";

// 허브 카드 표지 — 화이트 배경 실사(디자인 카탈로그와 같은 관례라 양 테마 모두 안전)
const hubCards = [
  { key: "lab", to: "/guide/lab-diamond", image: "/assets/diamond-hero-white-poster.webp" },
  { key: "fourc", to: "/guide/4c", image: "/assets/designs/RIGTXR01745-WG-RB-WH-150-M0.jpg" },
  { key: "shapes", to: "/guide/shapes", image: "/assets/designs/RIGTXR06263-2.50-GW4-1-NEW.jpg" },
];

export function GuideHub() {
  const { p } = useLocale();
  const g = p.guide.hub;
  return (
    <div className="page guide-noir-page">
      <section className="guide-noir-head">
        <span className="noir-eyebrow">{g.kicker}</span>
        <h1>{g.title}</h1>
        <p className="guide-noir-sub">{g.sub}</p>
      </section>
      <div className="guide-noir-gallery">
        {hubCards.map(({ key, to, image }) => {
          const card = g.cards[key];
          return (
            <Link className="guide-noir-piece" to={to} key={key}>
              <span className="guide-noir-ph" style={{ backgroundImage: `url(${image})` }} aria-hidden="true" />
              <span className="guide-noir-meta">
                <span className="guide-noir-kicker">{card.kicker}</span>
                <span className="guide-noir-name">{card.title}</span>
                <span className="guide-noir-cap">{card.body}</span>
                <span className="guide-noir-discover">
                  {p.common.view}
                  <ArrowRight size={14} strokeWidth={1.8} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function GuideLabDiamond() {
  const { p } = useLocale();
  const g = p.guide.lab;
  return (
    <div className="page page-narrow guide-noir-article">
      <span className="noir-eyebrow">{p.guide.hub.cards.lab.kicker}</span>
      <h1>{g.title}</h1>
      <p className="guide-noir-lede">{g.p1}</p>
      <h3>{g.h1}</h3>
      <p>{g.p2}</p>
      <h3>{g.h2}</h3>
      <p>{g.p3}</p>
      <h3>{g.h3}</h3>
      <p>{g.p4}</p>
      <div className="guide-noir-actions">
        <Link className="noir-btn" to="/custom/new">
          {g.cta}
          <ArrowRight size={15} strokeWidth={1.6} />
        </Link>
        <Link className="noir-link" to="/guide/4c">{g.next}</Link>
      </div>
    </div>
  );
}

export function Guide4C() {
  const { p } = useLocale();
  const g = p.guide.fourc;
  return (
    <div className="page page-narrow guide-noir-article">
      <span className="noir-eyebrow">{p.guide.hub.cards.fourc.kicker}</span>
      <h1>{g.title}</h1>
      <h3>{g.caratH}</h3>
      <p>{g.caratP}</p>
      <h3>{g.cutH}</h3>
      <p>{g.cutP}</p>
      <h3>{g.colorH}</h3>
      <p>{g.colorP}</p>
      <h3>{g.clarityH}</h3>
      <p>{g.clarityP}</p>
      <p className="guide-noir-tip">{g.tip}</p>
      <div className="guide-noir-actions">
        <Link className="noir-btn" to="/custom/new">
          {g.cta}
          <ArrowRight size={15} strokeWidth={1.6} />
        </Link>
        <Link className="noir-link" to="/guide/shapes">{g.next}</Link>
      </div>
    </div>
  );
}

export function GuideShapes() {
  const { p } = useLocale();
  const g = p.guide.shapes;
  return (
    <div className="page page-narrow guide-noir-article">
      <span className="noir-eyebrow">{p.guide.hub.cards.shapes.kicker}</span>
      <h1>{g.title}</h1>
      <p className="guide-noir-lede">{g.lede}</p>
      <h3>{g.introH}</h3>
      <p>{g.introP}</p>
      <div className="guide-noir-shapes">
        {BENCHMARK_SHAPES.map((key) => (
          <article className="guide-noir-shape" key={key}>
            <span className="guide-noir-shape-ic" aria-hidden="true"><ShapeSilhouette shape={key} /></span>
            <div>
              <h4>{p.shapes[key]}</h4>
              <p>{g.notes[key]}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="guide-noir-tip">{g.tip}</p>
      <div className="guide-noir-actions">
        <Link className="noir-btn" to="/custom/new">
          {g.cta}
          <ArrowRight size={15} strokeWidth={1.6} />
        </Link>
      </div>
    </div>
  );
}
