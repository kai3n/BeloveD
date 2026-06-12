import { useState } from "react";
import { Link } from "react-router-dom";
import { listTemplates } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, usd } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

const CATEGORIES = ["all", "ring", "necklace", "earring", "bracelet"];

export default function Templates() {
  useDBVersion();
  const { p, locale } = useLocale();
  const [category, setCategory] = useState("all");
  const templates = listTemplates().filter((t) => category === "all" || t.category === category);

  return (
    <div className="page">
      <h1 className="page-title">{p.templates.title}</h1>
      <p className="page-sub">{p.templates.sub}<br /><span className="form-hint">{p.ftc}</span></p>

      <div className="chip-row" style={{ marginBottom: 30 }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${category === c ? "is-active" : ""}`} onClick={() => setCategory(c)}>
            {c === "all" ? p.common.all : p.categories[c]}
          </button>
        ))}
      </div>

      <div className="card-grid cols-3">
        {templates.map((t) => (
          <Link className="item-card" to={`/custom/new?template=${t.id}`} key={t.id}>
            <MediaThumb media={t.media[0]} ratio="1 / 1.05" alt={pickI18n(t.name, locale)} />
            <div className="card-body">
              <h3>{pickI18n(t.name, locale)}</h3>
              <p className="spec">{p.categories[t.category]} · {pickI18n(t.desc, locale)}</p>
              <p className="price">{t.basePriceUsd > 0 ? p.templates.fromPrice(usd(t.basePriceUsd)) : p.templates.quote}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
