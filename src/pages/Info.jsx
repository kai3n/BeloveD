import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLocale } from "../i18n.jsx";
import { infoPages } from "../lib/infoContent.js";

// Returns / Warranty / Shipping / About / Contact / FAQ 를 하나의 템플릿으로 렌더
export default function InfoPage({ page }) {
  const { locale } = useLocale();
  const data = infoPages[page]?.[locale] ?? infoPages[page]?.en;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  if (!data) return null;
  const title = Array.isArray(data.title) ? data.title : [data.title];

  return (
    <article className="info-page">
      <header className="info-head">
        <span className="noir-eyebrow">{data.eyebrow}</span>
        <h1>
          {title.map((line, i) => (
            <span className="title-line" key={line}>
              {line}
              {i < title.length - 1 ? <br /> : null}
            </span>
          ))}
        </h1>
        {data.intro ? <p className="info-intro">{data.intro}</p> : null}
      </header>

      {data.sections ? (
        <div className="info-sections">
          {data.sections.map((s) => (
            <section className="info-section" key={s.h}>
              <h2>{s.h}</h2>
              <p>{s.p}</p>
            </section>
          ))}
        </div>
      ) : null}

      {data.channels ? (
        <div className="info-channels">
          {data.channels.map((c) => (
            <div className="info-channel" key={c.label}>
              <span className="info-channel-label">{c.label}</span>
              {c.to ? (
                <Link className="info-channel-link" to={c.to}>
                  {c.value}
                  <ArrowRight size={14} strokeWidth={1.7} />
                </Link>
              ) : (
                <span className="info-channel-value">{c.value}</span>
              )}
              {c.note ? <span className="info-channel-note">{c.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {data.faq ? (
        <div className="info-faq">
          {data.faq.map((item) => (
            <details className="info-faq-item" key={item.q}>
              <summary>
                <span>{item.q}</span>
                <span className="info-faq-mark" aria-hidden="true" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      ) : null}

      {data.note ? <p className="info-note">{data.note}</p> : null}
    </article>
  );
}
