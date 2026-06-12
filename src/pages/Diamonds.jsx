import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listDiamonds } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { MediaThumb, usd } from "../components/ui.jsx";
import { useLocale } from "../i18n.jsx";

const SHAPES = ["round", "oval", "princess", "emerald", "pear", "marquise", "cushion", "radiant", "asscher", "heart"];
const COLORS = ["D", "E", "F", "G", "H"];
const CLARITIES = ["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"];
const CUTS = ["Excellent", "Very Good", "Good"];
const CERTS = ["IGI", "GIA"];
const SORT_FNS = {
  "price-asc": (a, b) => a.priceUsd - b.priceUsd,
  "price-desc": (a, b) => b.priceUsd - a.priceUsd,
  "carat-desc": (a, b) => b.carat - a.carat,
};

const initialFilters = { shape: null, caratMin: "", caratMax: "", priceMax: "", cut: "", color: "", clarity: "", cert: "" };

export default function Diamonds() {
  const dbVersion = useDBVersion();
  const { p } = useLocale();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ ...initialFilters, shape: params.get("shape") || null });
  const [sort, setSort] = useState("price-asc");
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const results = useMemo(() => {
    let list = listDiamonds();
    if (filters.shape) list = list.filter((d) => d.shape === filters.shape);
    if (filters.caratMin) list = list.filter((d) => d.carat >= Number(filters.caratMin));
    if (filters.caratMax) list = list.filter((d) => d.carat <= Number(filters.caratMax));
    if (filters.priceMax) list = list.filter((d) => d.priceUsd <= Number(filters.priceMax));
    if (filters.cut) list = list.filter((d) => d.cut === filters.cut);
    if (filters.color) list = list.filter((d) => d.color === filters.color);
    if (filters.clarity) list = list.filter((d) => d.clarity === filters.clarity);
    if (filters.cert) list = list.filter((d) => d.certOrg === filters.cert);
    return [...list].sort(SORT_FNS[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, dbVersion]);

  const sortOptions = [
    { key: "price-asc", label: p.diamonds.sortPriceAsc },
    { key: "price-desc", label: p.diamonds.sortPriceDesc },
    { key: "carat-desc", label: p.diamonds.sortCaratDesc },
  ];

  return (
    <div className="page">
      <h1 className="page-title">{p.diamonds.title}</h1>
      <p className="page-sub">{p.diamonds.sub}</p>

      <div className="panel form-stack">
        <div className="chip-row" role="group">
          {SHAPES.map((s) => (
            <button key={s} className={`chip ${filters.shape === s ? "is-active" : ""}`}
              onClick={() => set({ shape: filters.shape === s ? null : s })}>{p.shapes[s]}</button>
          ))}
        </div>
        <div className="filter-grid">
          <label className="field"><span>{p.diamonds.caratMin}</span>
            <input type="number" step="0.1" value={filters.caratMin} onChange={(e) => set({ caratMin: e.target.value })} /></label>
          <label className="field"><span>{p.diamonds.caratMax}</span>
            <input type="number" step="0.1" value={filters.caratMax} onChange={(e) => set({ caratMax: e.target.value })} /></label>
          <label className="field"><span>{p.diamonds.maxPrice}</span>
            <input type="number" step="100" value={filters.priceMax} onChange={(e) => set({ priceMax: e.target.value })} /></label>
          <label className="field"><span>{p.diamonds.cut}</span>
            <select value={filters.cut} onChange={(e) => set({ cut: e.target.value })}>
              <option value="">{p.common.all}</option>{CUTS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>{p.diamonds.color}</span>
            <select value={filters.color} onChange={(e) => set({ color: e.target.value })}>
              <option value="">{p.common.all}</option>{COLORS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>{p.diamonds.clarity}</span>
            <select value={filters.clarity} onChange={(e) => set({ clarity: e.target.value })}>
              <option value="">{p.common.all}</option>{CLARITIES.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>{p.diamonds.cert}</span>
            <select value={filters.cert} onChange={(e) => set({ cert: e.target.value })}>
              <option value="">{p.common.all}</option>{CERTS.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <label className="field"><span>{p.diamonds.sort}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {sortOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></label>
        </div>
        <button className="text-link" onClick={() => setFilters(initialFilters)}>{p.diamonds.reset}</button>
      </div>

      <p className="page-sub" style={{ margin: "26px 0 18px" }}>{p.diamonds.count(results.length)}</p>
      {results.length === 0 ? (
        <p className="empty-note">{p.diamonds.empty}</p>
      ) : (
        <div className="card-grid">
          {results.map((d) => (
            <Link className="item-card" to={`/diamonds/${d.id}`} key={d.id}>
              <MediaThumb media={d.media[0]} alt={`${p.shapes[d.shape]} ${d.carat}ct`} />
              <div className="card-body">
                <h3>{p.shapes[d.shape]} {d.carat.toFixed(1)}ct</h3>
                <p className="spec">{d.cut} · {d.color} · {d.clarity} · {d.certOrg}</p>
                <p className="price">{usd(d.priceUsd)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
