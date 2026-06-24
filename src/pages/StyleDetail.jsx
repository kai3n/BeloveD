import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOpsStyle } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

const startingPrice = { ring: "$1,900+", earrings: "$1,200+", necklace: "$1,500+", bangle: "$2,400+" };
const detailCopy = {
  en: {
    label: "CUSTOM STARTER DESIGN",
    from: (price) => `From ${price}`,
    quote: "quote on request",
    intro: "Start here, then customize metal, stone profile, proportions, and finishing with the atelier before production.",
    estimatedMetal: "Estimated metal",
    leadTime: "Lead time",
    flexible: "Flexible",
    flexibleValue: "Metal, stone, size, profile",
    beforeProduction: "Before production",
    beforeProductionValue: "Quote and CAD approval",
    start: "Start custom order",
  },
  ko: {
    label: "맞춤 시작 디자인",
    from: (price) => `${price}부터`,
    quote: "견적 문의",
    intro: "여기서 시작해 제작 전 아틀리에와 메탈, 스톤 프로필, 비율, 마감을 맞춤 조정합니다.",
    estimatedMetal: "예상 메탈",
    leadTime: "제작 기간",
    flexible: "조정 가능",
    flexibleValue: "메탈, 스톤, 사이즈, 프로필",
    beforeProduction: "제작 전",
    beforeProductionValue: "견적 및 CAD 승인",
    start: "주문제작 시작",
  },
  zh: {
    label: "定制起始设计",
    from: (price) => `${price} 起`,
    quote: "询价",
    intro: "从这款开始，在生产前与工坊确认金属、主石比例、尺寸和收尾细节。",
    estimatedMetal: "预估金属",
    leadTime: "制作周期",
    flexible: "可调整",
    flexibleValue: "金属、钻石、尺寸、轮廓",
    beforeProduction: "生产前",
    beforeProductionValue: "报价与 CAD 确认",
    start: "开始定制",
  },
  es: {
    label: "DISEÑO BASE A MEDIDA",
    from: (price) => `Desde ${price}`,
    quote: "cotización a pedido",
    intro: "Empieza aquí y ajusta metal, perfil de piedra, proporciones y acabado con el atelier antes de producir.",
    estimatedMetal: "Metal estimado",
    leadTime: "Plazo",
    flexible: "Flexible",
    flexibleValue: "Metal, piedra, talla, perfil",
    beforeProduction: "Antes de producir",
    beforeProductionValue: "Cotización y aprobación CAD",
    start: "Crear pedido",
  },
};

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
  const copy = detailCopy[locale] ?? detailCopy.en;

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
        <p className="section-label">{copy.label}</p>
        <h1 className="page-title">{name}</h1>
        <p className="spec">{style.id} · {p.opsCategories[style.category]}</p>
        <p className="detail-price">{startingPrice[style.category] ? copy.from(startingPrice[style.category]) : copy.quote}</p>
        <p className="page-sub" style={{ marginBottom: 22 }}>
          {copy.intro}
        </p>
        <table className="data-table">
          <tbody>
            <tr><th scope="row">{copy.estimatedMetal}</th><td>{style.estWeightG}g</td></tr>
            <tr><th scope="row">{copy.leadTime}</th><td>{p.styleCat.lead(style.leadDays)}</td></tr>
            <tr><th scope="row">{copy.flexible}</th><td>{copy.flexibleValue}</td></tr>
            <tr><th scope="row">{copy.beforeProduction}</th><td>{copy.beforeProductionValue}</td></tr>
          </tbody>
        </table>
        <p className="form-hint" style={{ marginTop: 14 }}>{p.ftc}</p>

        <div className="hero-ctas" style={{ justifyContent: "flex-start" }}>
          <Link className="button primary" to={`/custom/new?style=${style.id}`}>{copy.start} →</Link>
          <Link className="button secondary" to="/designs">{p.intake.backToDesigns}</Link>
        </div>
      </div>
    </div>
  );
}
