import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLocale } from "../i18n.jsx";
import { BENCHMARK_SHAPES } from "../lib/ops.js";
import { ShapeSilhouette } from "../components/intake/pickers.jsx";

// 허브 카드 표지 — 다크 배경 실사(트위저 랩다이아·브릴리언트 링) + 셰입 실루엣 그래픽.
// 셋 다 다크+샴페인골드 톤으로 통일. 이전 fourc/shapes는 삭제된 옛 카탈로그 SKU를 참조해 깨져 있었음.
const hubCards = [
  { key: "lab", to: "/guide/lab-diamond", image: "/assets/lab-diamond-tweezers.webp" },
  { key: "fourc", to: "/guide/4c", image: "/assets/hero-diamond-ring-crisp.png" },
  { key: "shapes", to: "/guide/shapes", image: "/assets/diamond-shapes-noir.png" },
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
