import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSettings, listOpsStyles } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, withBase } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";
import {
  DESIGN_CATEGORIES,
  categoryMeta,
  designCategoryCards,
  styleSubcategoryKey,
  subcategoryKeysFor,
} from "../lib/designSlots.js";

const CATS = ["all", "ring", "earrings", "bangle", "necklace"];
const catLabel = (p, c) => (c === "all" ? p.common.all : p.opsCategories[c] || categoryMeta(c)?.label);

function CatalogMediaCarousel({ card }) {
  const mediaItems = (Array.isArray(card.mediaItems) && card.mediaItems.length > 0 ? card.mediaItems : [card.media]).filter(Boolean);
  const [active, setActive] = useState(0);
  const media = mediaItems[active] || mediaItems[0];
  const hasGallery = mediaItems.length > 1;

  // 화살표를 누르기 전에 이웃 이미지를 미리 받아 전환이 즉시 되게 한다
  useEffect(() => {
    if (!hasGallery) return;
    [active + 1, active - 1].forEach((idx) => {
      const item = mediaItems[(idx + mediaItems.length) % mediaItems.length];
      if (item && item.kind !== "video" && item.src) new Image().src = withBase(item.src);
    });
  }, [active, hasGallery, mediaItems]);

  function shift(event, delta) {
    event.preventDefault();
    event.stopPropagation();
    setActive((current) => (current + delta + mediaItems.length) % mediaItems.length);
  }

  const mediaContent = (
    <MediaThumb media={media} ratio="1.15 / 1" alt={card.title} />
  );

  return (
    <div className="design-shop-media-frame">
      {card.href ? (
        <Link to={card.href} className="design-shop-media" aria-label={card.title}>
          {mediaContent}
        </Link>
      ) : (
        <div className="design-shop-media">
          {mediaContent}
        </div>
      )}
      {hasGallery && (
        <>
          <button
            type="button"
            className="design-media-arrow is-left"
            aria-label="Previous media"
            onClick={(event) => shift(event, -1)}
          >
            <ChevronLeft size={28} strokeWidth={1.45} />
          </button>
          <button
            type="button"
            className="design-media-arrow is-right"
            aria-label="Next media"
            onClick={(event) => shift(event, 1)}
          >
            <ChevronRight size={28} strokeWidth={1.45} />
          </button>
        </>
      )}
    </div>
  );
}

export default function StyleCatalog() {
  useDBVersion();
  const { p, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const requestedCat = params.get("category");
  const requestedSubcat = params.get("subcategory");
  const [cat, setCat] = useState(CATS.includes(requestedCat) ? requestedCat : "all");
  const [subcat, setSubcat] = useState(() => (
    CATS.includes(requestedCat) && subcategoryKeysFor(requestedCat).includes(requestedSubcat)
      ? requestedSubcat
      : "all"
  ));
  const styles = listOpsStyles({ publishedOnly: true });
  const catalogCopy = getSettings().designCopy?.[locale] || {};
  const visibleCategories = cat === "all" ? DESIGN_CATEGORIES : [categoryMeta(cat)].filter(Boolean);
  const subcategoryKeys = cat === "all" ? [] : subcategoryKeysFor(cat);

  function chooseCategory(nextCat) {
    setCat(nextCat);
    setSubcat("all");
    setParams(nextCat === "all" ? {} : { category: nextCat });
  }

  function chooseSubcategory(nextSubcat) {
    setSubcat(nextSubcat);
    setParams(nextSubcat === "all" ? { category: cat } : { category: cat, subcategory: nextSubcat });
  }

  function categoryNote(category, count = category.target) {
    if (catalogCopy.categoryNote) {
      return catalogCopy.categoryNote.replaceAll("{count}", String(count));
    }
    return p.styleCat.categoryNote?.(count) || `${count} starter designs.`;
  }

  function categoryLabel(category) {
    return p.opsCategories[category.key] || category.label;
  }

  function subcategoryLabel(key) {
    return key === "all" ? p.common.all : p.opsSubcategories?.[key] || key;
  }

  return (
    <div className="page designs-page">
      <section className="designs-page-head">
        <p className="section-label">{catalogCopy.kicker || p.styleCat.kicker || "CUSTOM DESIGNS"}</p>
        <h1 className="page-title">{catalogCopy.heroTitle || p.styleCat.heroTitle || p.styleCat.title}</h1>
        <p className="page-sub">{catalogCopy.sub || p.styleCat.sub}</p>
      </section>

      <div className="chip-row design-category-tabs" aria-label="Design categories">
        {CATS.map((c) => (
          <button key={c} className={`chip ${cat === c ? "is-active" : ""}`} onClick={() => chooseCategory(c)}>
            {catLabel(p, c)}
          </button>
        ))}
      </div>
      {subcategoryKeys.length > 0 && (
        <div className="chip-row design-subcategory-tabs" aria-label="Design subcategories">
          {["all", ...subcategoryKeys].map((key) => (
            <button key={key} className={`chip ${subcat === key ? "is-active" : ""}`} onClick={() => chooseSubcategory(key)}>
              {subcategoryLabel(key)}
            </button>
          ))}
        </div>
      )}

      <div className="catalog-category-stack">
        {visibleCategories.map((category) => {
          const sectionStyles = subcat === "all"
            ? styles
            : styles.filter((style) => styleSubcategoryKey(style) === subcat);
          const cards = designCategoryCards(sectionStyles, category, locale, pickI18n, { fillSlots: subcat === "all" });

          return (
            <section className={`catalog-category ${cat !== "all" ? "is-focused" : ""}`} key={category.key}>
              <div className="category-block-head">
                <h2>{categoryLabel(category)}</h2>
                <p>{categoryNote(category, cards.length)}</p>
              </div>
              {cards.length === 0 ? (
                <p className="empty-note">{p.styleCat.noStyles || p.styleCat.awaitingMedia}</p>
              ) : (
                <div className="design-shop-grid">
                  {cards.map((card) => {
                    const ctaHref = card.ctaHref || `/custom/new?category=${category.key}&design=${encodeURIComponent(card.title)}`;
                    const cardSubcategory = p.opsSubcategories?.[card.subcategory];

                    return (
                      <article className={`design-shop-card ${card.state === "slot" ? "is-slot" : ""}`} key={card.id}>
                        <CatalogMediaCarousel card={card} />
                        <div className="design-shop-body">
                          <span>{cardSubcategory ? `${categoryLabel(category)} · ${cardSubcategory}` : categoryLabel(category)}</span>
                          <h3>{card.title}</h3>
                          <Link to={ctaHref}>{p.styleCat.start}</Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
