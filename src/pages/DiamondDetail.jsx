import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDiamond } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, usd } from "../components/ui.jsx";
import { useLocale } from "../i18n.jsx";

export default function DiamondDetail() {
  useDBVersion();
  const { p } = useLocale();
  const { id } = useParams();
  const diamond = getDiamond(id);
  const [active, setActive] = useState(0);

  if (!diamond || !diamond.visible) {
    return <div className="page"><p className="empty-note">{p.detail.notFound}</p></div>;
  }

  const specs = [
    [p.detail.shape, p.shapes[diamond.shape]],
    [p.detail.carat, `${diamond.carat.toFixed(2)}ct`],
    [p.detail.cut, diamond.cut],
    [p.detail.color, diamond.color],
    [p.detail.clarity, diamond.clarity],
    [p.detail.certOrg, diamond.certOrg],
    [p.detail.certNo, diamond.certNo],
  ];

  return (
    <div className="page detail-layout">
      <div className="detail-media">
        <MediaThumb media={diamond.media[active]} alt={`${p.shapes[diamond.shape]} ${diamond.carat}ct`} />
        {diamond.media.length > 1 && (
          <div className="thumb-row">
            {diamond.media.map((m, i) => (
              <button key={i} className={`thumb-btn ${i === active ? "is-active" : ""}`} onClick={() => setActive(i)}>
                <MediaThumb media={m} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="detail-info">
        <h1 className="page-title">{p.shapes[diamond.shape]} {diamond.carat.toFixed(1)}ct</h1>
        <p className="price detail-price">{usd(diamond.priceUsd)}</p>

        <table className="data-table">
          <tbody>
            {specs.map(([k, v]) => (
              <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>
            ))}
          </tbody>
        </table>

        <p className="form-hint" style={{ marginTop: 14 }}>
          {p.detail.certNote(diamond.certOrg, diamond.certNo)}
        </p>
        <p className="form-hint" style={{ marginTop: 6 }}>{p.ftc}</p>

        <div className="hero-ctas" style={{ justifyContent: "flex-start" }}>
          <Link className="button primary" to={`/custom/new?diamond=${diamond.id}`}>
            {p.detail.orderCta}
          </Link>
          <Link className="button secondary" to="/diamonds">{p.detail.back}</Link>
        </div>
      </div>
    </div>
  );
}
