import { useState } from "react";
import { Link } from "react-router-dom";
import { listOpsStyles } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

const CATS = ["all", "ring", "necklace", "earrings", "bangle"];

export default function StyleCatalog() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.styleCat;
  const [cat, setCat] = useState("all");
  const styles = listOpsStyles({ publishedOnly: true }).filter((st) => cat === "all" || st.category === cat);

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}<br /><span className="form-hint">{p.ftc}</span></p>

      <div className="chip-row" style={{ marginBottom: 30 }}>
        {CATS.map((c) => (
          <button key={c} className={`chip ${cat === c ? "is-active" : ""}`} onClick={() => setCat(c)}>
            {c === "all" ? p.common.all : p.opsCategories[c]}
          </button>
        ))}
      </div>

      <div className="card-grid cols-3">
        {styles.map((st) => {
          const isVideo = st.coverImage.endsWith(".mp4");
          return (
            <Link className="item-card" to={`/styles/${st.id}`} key={st.id}>
              <MediaThumb media={{ kind: isVideo ? "video" : "image", src: st.coverImage }} ratio="1 / 1.05" alt={pickI18n(st.name, locale)} />
              <div className="card-body">
                <h3>{pickI18n(st.name, locale)}</h3>
                <p className="spec">
                  {st.id} · {p.opsCategories[st.category]}
                  {!st.mediaComplete && <> · <span className="warn-note">{t.awaitingMedia}</span></>}
                </p>
                <p className="spec">{t.weight(st.estWeightG)} · {t.lead(st.leadDays)}</p>
                <p className="price">{t.start} →</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
