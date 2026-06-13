import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOpsStyle } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

export default function StyleDetail() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { id } = useParams();
  const style = getOpsStyle(id);
  const [active, setActive] = useState(0);

  if (!style || !style.published) {
    return <div className="page"><p className="empty-note">{p.styleCat.title} — {p.common.notFound}</p></div>;
  }

  // 갤러리: media 배열 우선, 없으면 coverImage 단일
  const gallery = style.media?.length
    ? style.media
    : [{ kind: (style.coverImage || "").endsWith(".mp4") ? "video" : "image", src: style.coverImage }];
  const name = pickI18n(style.name, locale);

  return (
    <div className="page detail-layout">
      <div className="detail-media">
        <MediaThumb media={gallery[active] || gallery[0]} alt={name} />
        {gallery.length > 1 && (
          <div className="thumb-row">
            {gallery.map((m, i) => (
              <button key={i} className={`thumb-btn ${i === active ? "is-active" : ""}`} onClick={() => setActive(i)}>
                <MediaThumb media={m} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="detail-info">
        <h1 className="page-title">{name}</h1>
        <p className="spec">{style.id} · {p.opsCategories[style.category]}</p>
        <table className="data-table">
          <tbody>
            <tr><th scope="row">{p.opsA.styles.estW}</th><td>{style.estWeightG}g</td></tr>
            <tr><th scope="row">{p.opsA.styles.leadDays}</th><td>{p.styleCat.lead(style.leadDays)}</td></tr>
          </tbody>
        </table>
        <p className="form-hint" style={{ marginTop: 14 }}>{p.ftc}</p>

        <div className="hero-ctas" style={{ justifyContent: "flex-start" }}>
          <Link className="button primary" to={`/custom/new?style=${style.id}`}>{p.styleCat.start} →</Link>
          <Link className="button secondary" to="/styles">{p.detail.back}</Link>
        </div>
      </div>
    </div>
  );
}
