import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getOpsStyle } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, withBase } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";
import { categoryMeta, getDesignSlotStyle, styleMediaGallery, styleSubcategoryKey } from "../lib/designSlots.js";
import { track } from "../lib/track.js";

function styleText(style, field, locale, fallback) {
  return pickI18n(style?.[field], locale) || fallback;
}

export default function StyleDetail() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { id } = useParams();
  const style = getOpsStyle(id) || getDesignSlotStyle(id);
  const [active, setActive] = useState(0);
  const [isMagnifying, setIsMagnifying] = useState(false);
  const [magnifyPosition, setMagnifyPosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    setActive(0);
    setIsMagnifying(false);
    setMagnifyPosition({ x: 50, y: 50 });
  }, [id]);

  // 상품 상세 조회 이벤트 — 공개된 스타일만
  useEffect(() => {
    if (style?.published) track("style_view", { path: `/designs/${id}`, entityType: "style", entityId: id });
  }, [id, style?.published]);

  // 갤러리 이웃 이미지를 미리 받아 화살표 전환이 즉시 되게 한다
  useEffect(() => {
    if (!style || !style.published) return;
    const gallery = styleMediaGallery(style, categoryMeta(style.category) || { media: [] });
    if (gallery.length < 2) return;
    [active + 1, active - 1].forEach((idx) => {
      const item = gallery[(idx + gallery.length) % gallery.length];
      if (item && item.kind !== "video" && item.src) new Image().src = withBase(item.src);
    });
  }, [style, active]);

  if (!style || !style.published) {
    return (
      <div className="page" style={{ textAlign: "center" }}>
        <p className="empty-note">{p.styleCat.title} — {p.common.notFound}</p>
        <p><Link className="button secondary" to="/designs">{p.intake.backToDesigns}</Link></p>
      </div>
    );
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
  const activeMedia = gallery[active] || gallery[0];
  const canMagnify = activeMedia?.kind !== "video";
  const categoryLine = [
    p.opsCategories[style.category],
    p.opsSubcategories?.[subcategory],
  ].filter(Boolean).join(" · ");

  function moveGallery(delta) {
    setActive((current) => (current + delta + gallery.length) % gallery.length);
    setIsMagnifying(false);
    setMagnifyPosition({ x: 50, y: 50 });
  }

  function updateMagnifyPosition(event, force = false) {
    if (!canMagnify || (!isMagnifying && !force)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setMagnifyPosition({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  }

  return (
    <div className="page detail-layout">
      <div className="detail-media">
        <div className="style-media-carousel">
          <button
            type="button"
            className={`style-media-zoom-trigger${isMagnifying ? " is-magnifying" : ""}${canMagnify ? "" : " is-video"}`}
            aria-label={`${copy.zoom || "Magnify"} ${name}`}
            aria-pressed={isMagnifying}
            onClick={(event) => {
              if (!canMagnify) return;
              updateMagnifyPosition(event, true);
              setIsMagnifying((value) => !value);
            }}
            onPointerMove={updateMagnifyPosition}
            onPointerDown={updateMagnifyPosition}
            style={{
              "--detail-magnify-x": `${magnifyPosition.x}%`,
              "--detail-magnify-y": `${magnifyPosition.y}%`,
              "--detail-magnify-scale": 3,
            }}
          >
            <MediaThumb media={activeMedia} alt={name} eager />
            {canMagnify && (
              <span className="style-media-zoom-badge">
                <Search size={16} strokeWidth={1.8} aria-hidden="true" />
                {isMagnifying ? (copy.zoomMove || "Move to inspect") : (copy.zoom || "Magnify")}
              </span>
            )}
          </button>
          {gallery.length > 1 && (
            <>
              <button className="style-carousel-button is-prev" type="button" aria-label="Previous media" onClick={() => moveGallery(-1)}>
                <ChevronLeft size={34} strokeWidth={1.35} aria-hidden="true" />
              </button>
              <button className="style-carousel-button is-next" type="button" aria-label="Next media" onClick={() => moveGallery(1)}>
                <ChevronRight size={34} strokeWidth={1.35} aria-hidden="true" />
              </button>
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
    </div>
  );
}
