import { Link } from "react-router-dom";
import { useLocale } from "../i18n.jsx";

export function GuideHub() {
  return (
    <div className="page guide-hub">
      <p className="section-label">DIAMOND GUIDE</p>
      <h1 className="page-title">Choose with confidence.</h1>
      <p className="page-sub">
        Short, practical notes for lab-grown diamond quality, stone preferences, and custom production decisions.
      </p>
      <div className="card-grid cols-3">
        <Link className="item-card guide-card" to="/guide/lab-diamond">
          <div className="card-body">
            <p className="section-label">LAB-GROWN</p>
            <h3>Same fire. Smarter origin.</h3>
            <p className="spec">How lab-grown diamonds compare and what disclosures matter.</p>
          </div>
        </Link>
        <Link className="item-card guide-card" to="/guide/4c">
          <div className="card-body">
            <p className="section-label">4C</p>
            <h3>Cut, color, clarity, carat.</h3>
            <p className="spec">The practical way to prioritize visible brilliance.</p>
          </div>
        </Link>
        <Link className="item-card guide-card" to="/process">
          <div className="card-body">
            <p className="section-label">CUSTOM</p>
            <h3>From brief to final QC.</h3>
            <p className="spec">What happens after you start a custom order.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export function GuideLabDiamond() {
  const { p } = useLocale();
  const g = p.guide.lab;
  return (
    <div className="page page-narrow guide-page">
      <h1 className="page-title">{g.title}</h1>
      <p>{g.p1}</p>
      <h3>{g.h1}</h3>
      <p>{g.p2}</p>
      <h3>{g.h2}</h3>
      <p>{g.p3}</p>
      <h3>{g.h3}</h3>
      <p>{g.p4}</p>
      <p><Link className="button primary" to="/custom/new">{g.cta}</Link></p>
      <p><Link className="text-link" to="/guide/4c">{g.next}</Link></p>
    </div>
  );
}

export function Guide4C() {
  const { p } = useLocale();
  const g = p.guide.fourc;
  return (
    <div className="page page-narrow guide-page">
      <h1 className="page-title">{g.title}</h1>
      <h3>{g.caratH}</h3>
      <p>{g.caratP}</p>
      <h3>{g.cutH}</h3>
      <p>{g.cutP}</p>
      <h3>{g.colorH}</h3>
      <p>{g.colorP}</p>
      <h3>{g.clarityH}</h3>
      <p>{g.clarityP}</p>
      <p className="form-hint">{g.tip}</p>
      <p><Link className="button primary" to="/custom/new">{g.cta}</Link></p>
    </div>
  );
}
