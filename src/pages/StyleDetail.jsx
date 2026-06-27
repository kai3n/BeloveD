import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getOpsStyle } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, MediaZoomModal } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";
import { categoryMeta, getDesignSlotStyle, styleMediaGallery, styleSubcategoryKey } from "../lib/designSlots.js";

function styleText(style, field, locale, fallback) {
  return pickI18n(style?.[field], locale) || fallback;
}

export default function StyleDetail() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { id } = useParams();
  const style = getOpsStyle(id) || getDesignSlotStyle(id);
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    setActive(0);
    setZoomOpen(false);
  }, [id]);

  if (!style || !style.published) {
    return <div className="page"><p className="empty-note">{p.styleCat.title} — {p.common.notFound}</p></div>;
  }

  const category = categoryMeta(style.category);
  const gallery = styleMediaGallery(style, category || { media: [] });
  const name = pickI18n(style.name, locale);
  const copy = p.styleDetail;
  const label = styleText(style, "detailLabel", locale, copy.label);
  const intro = styleText(style, "description", locale, copy.intro);
  const flexibleValue = styleText(style, "flexibleText", locale, copy.flexibleValue);
  const beforeProductionValue = styleText(style, "beforeProductionText", locale, copy.beforeProductionValue);
  const subcategory = styleSubcategoryKey(style);
  const categoryLine = [
    p.opsCategories[style.category],
    p.opsSubcategories?.[subcategory],
  ].filter(Boolean).join(" · ");

  function moveGallery(delta) {
    setActive((current) => (current + delta + gallery.length) % gallery.length);
  }

  return (
    <div className="page detail-layout">
      <div className="detail-media">
        <div className="style-media-carousel">
          <button
            type="button"
            className="style-media-zoom-trigger"
            aria-label={`${copy.zoom || "Magnify"} ${name}`}
            onClick={() => setZoomOpen(true)}
          >
            <MediaThumb media={gallery[active] || gallery[0]} alt={name} eager />
            <span className="style-media-zoom-badge">
              <Search size={16} strokeWidth={1.8} aria-hidden="true" />
              {copy.zoom || "Magnify"}
            </span>
          </button>
          {gallery.length > 1 && (
            <>
              <button className="style-carousel-button is-prev" type="button" aria-label="Previous media" onClick={() => moveGallery(-1)}>
                <ChevronLeft size={22} strokeWidth={1.7} aria-hidden="true" />
              </button>
              <button className="style-carousel-button is-next" type="button" aria-label="Next media" onClick={() => moveGallery(1)}>
                <ChevronRight size={22} strokeWidth={1.7} aria-hidden="true" />
              </button>
              <span className="style-carousel-count">{active + 1} / {gallery.length}</span>
            </>
          )}
        </div>
      </div>

      <div className="detail-info">
        <p className="section-label">{label}</p>
        <h1 className="page-title detail-title">{name}</h1>
        <p className="detail-category">{categoryLine}</p>
        <p className="page-sub detail-intro">
          {intro}
        </p>
        <table className="data-table detail-spec-table">
          <tbody>
            <tr><th scope="row">{copy.estimatedMetal}</th><td>{style.estWeightG}g</td></tr>
            <tr><th scope="row">{copy.leadTime}</th><td>{p.styleCat.lead(style.leadDays)}</td></tr>
            <tr><th scope="row">{copy.flexible}</th><td>{flexibleValue}</td></tr>
            <tr><th scope="row">{copy.beforeProduction}</th><td>{beforeProductionValue}</td></tr>
          </tbody>
        </table>
        <p className="form-hint" style={{ marginTop: 14 }}>{p.ftc}</p>

        <div className="hero-ctas detail-actions">
          <Link className="button primary" to={`/custom/new?style=${style.id}`}>{copy.start} →</Link>
          <Link className="button secondary" to="/designs">{p.intake.backToDesigns}</Link>
        </div>
      </div>
      {zoomOpen && (
        <MediaZoomModal
          mediaItems={gallery}
          activeIndex={active}
          onActiveIndexChange={setActive}
          onClose={() => setZoomOpen(false)}
          alt={name}
        />
      )}
    </div>
  );
}
