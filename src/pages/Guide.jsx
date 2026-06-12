import { Link } from "react-router-dom";
import { useLocale } from "../i18n.jsx";

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
      <p><Link className="button primary" to="/diamonds">{g.cta}</Link></p>
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
