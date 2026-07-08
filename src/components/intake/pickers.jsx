// Gallery Flow 인테이크의 이미지 선택 프리미티브 — 텍스트 대신 사진·실루엣·스와치로 답한다
import { BENCHMARK_SHAPES, OPS_METALS } from "../../lib/ops.js";
import { MediaThumb } from "../ui.jsx";

// 9개 벤치마크 셰입 실루엣 (viewBox 0 0 48 48, currentColor stroke)
const SHAPE_PATHS = {
  round: <><circle cx="24" cy="24" r="17" /><path d="M24 7v34M7 24h34M12 12l24 24M36 12L12 36" opacity=".4" /></>,
  oval: <><ellipse cx="24" cy="24" rx="12.5" ry="18" /><path d="M24 6v36M11.5 24h25" opacity=".4" /></>,
  princess: <><rect x="9" y="9" width="30" height="30" /><path d="M9 9l30 30M39 9L9 39" opacity=".4" /></>,
  emerald: <><path d="M15 8h18l7 7v18l-7 7H15l-7-7V15z" /><path d="M18 12h12l6 6v12l-6 6H18l-6-6V18z" opacity=".4" /></>,
  pear: <><path d="M24 6C29 15 37 20 37 29a13 13 0 0 1-26 0C11 20 19 15 24 6z" /><path d="M24 6v36" opacity=".4" /></>,
  marquise: <><path d="M24 5c8 7 12 13 12 19s-4 12-12 19c-8-7-12-13-12-19S16 12 24 5z" /><path d="M24 5v38" opacity=".4" /></>,
  cushion: <><rect x="9" y="9" width="30" height="30" rx="9" /><path d="M11 11l26 26M37 11L11 37" opacity=".4" /></>,
  radiant: <><path d="M15 9h18l6 6v18l-6 6H15l-6-6V15z" /><path d="M9 15l15 9 15-9M9 33l15-9 15 9" opacity=".4" /></>,
  asscher: <><path d="M16 9h16l7 7v16l-7 7H16l-9-7V16z" /><path d="M19 13h10l6 6v10l-6 6H19l-6-6V19z" opacity=".4" /></>,
};

export function ShapeSilhouette({ shape }) {
  return (
    <svg className="gflow-shape-svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      {SHAPE_PATHS[shape] || SHAPE_PATHS.round}
    </svg>
  );
}

export function ShapeTiles({ value, onSelect, labels = {} }) {
  return (
    <div className="gflow-shape-grid" role="listbox" aria-label="shape">
      {BENCHMARK_SHAPES.map((shape) => (
        <button
          key={shape}
          type="button"
          role="option"
          aria-selected={value === shape}
          className={`gflow-shape-tile ${value === shape ? "is-selected" : ""}`}
          onClick={() => onSelect(shape)}
        >
          <ShapeSilhouette shape={shape} />
          <span>{labels[shape] || shape}</span>
        </button>
      ))}
    </div>
  );
}

// 사진 타일 그리드 — options: [{ value, label, sub?, media: {kind,src} | null }]
export function ImageOptionGrid({ options, value, onSelect, columns = 4 }) {
  return (
    <div className={`gflow-option-grid cols-${columns}`} role="listbox">
      {options.map((option) => (
        <button
          key={option.value || "__none"}
          type="button"
          role="option"
          aria-selected={value === option.value}
          className={`gflow-option-card ${value === option.value ? "is-selected" : ""} ${option.media ? "" : "is-text"}`}
          onClick={() => onSelect(option.value)}
        >
          {option.media && (
            <span className="gflow-option-media">
              <MediaThumb media={option.media} alt={option.label} ratio="1 / 1" />
            </span>
          )}
          <span className="gflow-option-label">{option.label}</span>
          {option.sub && <span className="gflow-option-sub">{option.sub}</span>}
        </button>
      ))}
    </div>
  );
}

const METAL_DOT_CLASS = {
  "14ky": "m-14ky", "18ky": "m-18ky", "14kr": "m-14kr", "18kr": "m-18kr", "18kw": "m-18kw", pt: "m-pt",
};

export function MetalSwatches({ value, onSelect, labels = {} }) {
  return (
    <div className="gflow-metal-row" role="listbox" aria-label="metal">
      {OPS_METALS.map((metal) => (
        <button
          key={metal}
          type="button"
          role="option"
          aria-selected={value === metal}
          className={`gflow-metal-chip ${value === metal ? "is-selected" : ""}`}
          onClick={() => onSelect(metal)}
        >
          <span className={`gflow-metal-dot ${METAL_DOT_CLASS[metal] || ""}`} aria-hidden="true" />
          <span>{labels[metal] || metal}</span>
        </button>
      ))}
    </div>
  );
}

// 캐럿 슬라이더 — 실물 비율 스톤 프리뷰
export function CaratSlider({ value, onChange, min = 0.5, max = 4, step = 0.1, shape = "round" }) {
  const ct = Number(value) || min;
  const px = Math.round(34 + Math.sqrt(ct) * 22);
  return (
    <div className="gflow-carat">
      <div className="gflow-carat-visual">
        {/* 스톤 프리뷰는 고객이 고른 셰입을 따른다 — 원 고정이면 선택이 반영 안 된 것처럼 보인다 */}
        <span className="gflow-carat-stone" style={{ width: px, height: px }} aria-hidden="true">
          <ShapeSilhouette shape={shape} />
        </span>
        <span className="gflow-carat-readout"><strong>{ct.toFixed(2)}</strong><small>carat</small></span>
      </div>
      <input
        className="gflow-carat-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={ct}
        aria-label="carat"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// 등급 range 슬라이더 — 브릴리언스식 듀얼 핸들. 겹친 두 개의 네이티브 range 인풋으로
// 키보드 접근성을 공짜로 얻고, 썸만 포인터를 받는다. 값은 [하한, 상한] 등급 문자열.
export function GradeRangeSlider({ scale, value, onChange, ariaLabel = "" }) {
  const loRaw = scale.indexOf(value?.[0]);
  const hiRaw = scale.indexOf(value?.[1]);
  const lo = loRaw < 0 ? 0 : loRaw;
  const hi = hiRaw < 0 ? scale.length - 1 : hiRaw;
  const maxIdx = scale.length - 1;
  const pct = (i) => (maxIdx === 0 ? 0 : (i / maxIdx) * 100);
  const commit = (nextLo, nextHi) => onChange([scale[nextLo], scale[nextHi]]);
  return (
    <div className="gflow-grange" role="group" aria-label={ariaLabel}>
      <div className="gflow-grange-track">
        <span className="gflow-grange-fill" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} aria-hidden="true" />
        <input
          type="range" min="0" max={maxIdx} step="1" value={lo}
          aria-label={`${ariaLabel} min`}
          onChange={(e) => commit(Math.min(Number(e.target.value), hi), hi)}
        />
        <input
          type="range" min="0" max={maxIdx} step="1" value={hi}
          aria-label={`${ariaLabel} max`}
          onChange={(e) => commit(lo, Math.max(Number(e.target.value), lo))}
        />
      </div>
      <div className="gflow-grange-labels" aria-hidden="true">
        {scale.map((grade, i) => (
          <span key={grade} className={i >= lo && i <= hi ? "is-active" : ""}>{grade}</span>
        ))}
      </div>
    </div>
  );
}

// 총 캐럿 슬라이더 — 멀티스톤은 합계 중량이라 실물 프리뷰 없이 리드아웃만 (CaratSlider 비주얼 문법 재사용)
export function TotalCaratSlider({ value, onChange, min, max, step, unitLabel = "ct total" }) {
  const ct = Number(value) || min;
  return (
    <div className="gflow-carat">
      <div className="gflow-carat-visual">
        <span className="gflow-carat-readout"><strong>{ct.toFixed(2)}</strong><small>{unitLabel}</small></span>
      </div>
      <input
        className="gflow-carat-range"
        type="range" min={min} max={max} step={step} value={ct}
        aria-label="total carat"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// 등급 스케일 (컬러/클래리티) — options: [{ value, label?, sub? }]
export function ScalePicker({ options, value, onSelect, ariaLabel = "" }) {
  return (
    <div className="gflow-scale" role="listbox" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={value === option.value}
          className={`gflow-scale-step ${value === option.value ? "is-selected" : ""}`}
          onClick={() => onSelect(option.value)}
        >
          <strong>{option.label || option.value}</strong>
          {option.sub && <span>{option.sub}</span>}
        </button>
      ))}
    </div>
  );
}
