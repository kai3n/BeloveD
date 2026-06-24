import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listOpsStyles } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";
import { DESIGN_CATEGORIES, categoryMeta, designCategoryCards } from "../lib/designSlots.js";

const CATS = ["all", "ring", "earrings", "bangle", "necklace"];
const catLabel = (p, c) => (c === "all" ? p.common.all : categoryMeta(c)?.label || p.opsCategories[c]);

export default function StyleCatalog() {
  useDBVersion();
  const { p, locale } = useLocale();
  const [params, setParams] = useSearchParams();
  const requestedCat = params.get("category");
  const [cat, setCat] = useState(CATS.includes(requestedCat) ? requestedCat : "all");
  const styles = listOpsStyles({ publishedOnly: true });
  const visibleCategories = cat === "all" ? DESIGN_CATEGORIES : [categoryMeta(cat)].filter(Boolean);

  function chooseCategory(nextCat) {
    setCat(nextCat);
    setParams(nextCat === "all" ? {} : { category: nextCat });
  }

  return (
    <div className="page designs-page">
      <section className="designs-page-head">
        <p className="section-label">CUSTOM DESIGNS</p>
        <h1 className="page-title">Choose a starting point.</h1>
        <p className="page-sub">Pick a silhouette first. Stone, metal, and details are customized after.</p>
      </section>

      <div className="chip-row design-category-tabs" aria-label="Design categories">
        {CATS.map((c) => (
          <button key={c} className={`chip ${cat === c ? "is-active" : ""}`} onClick={() => chooseCategory(c)}>
            {catLabel(p, c)}
          </button>
        ))}
      </div>

      <div className="catalog-category-stack">
        {visibleCategories.map((category) => (
          <section className={`catalog-category ${cat !== "all" ? "is-focused" : ""}`} key={category.key}>
            <div className="category-block-head">
              <h2>{category.label}</h2>
              <p>{category.target} starter designs. Customize stone, metal, and finish.</p>
            </div>
            <div className="design-shop-grid">
              {designCategoryCards(styles, category, locale, pickI18n).map((card) => {
                const ctaHref = card.ctaHref || `/custom/new?category=${category.key}&design=${encodeURIComponent(card.title)}`;

                return (
                  <article className={`design-shop-card ${card.state === "slot" ? "is-slot" : ""}`} key={card.id}>
                    {card.href ? (
                      <Link to={card.href} className="design-shop-media">
                        <MediaThumb media={card.media} ratio="1.15 / 1" alt={card.title} />
                      </Link>
                    ) : (
                      <div className="design-shop-media">
                        <MediaThumb media={card.media} ratio="1.15 / 1" alt={card.title} />
                      </div>
                    )}
                    <div className="design-shop-body">
                      <span>{category.shortLabel}</span>
                      <h3>{card.title}</h3>
                      <p>{card.price}</p>
                      <Link to={ctaHref}>Customize</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
