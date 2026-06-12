// 센터스톤 교육 패널 — 포커스된 필드의 의미를 SVG 일러스트와 함께 설명. 표시 전용(상태 없음).
import { useLocale } from "../i18n.jsx";
import { BENCHMARK_SHAPES } from "../lib/ops.js";
import {
  COLOR_SCALE, COLOR_TINTS, CLARITY_SCALE, CLARITY_DOTS, FLUOR_LEVELS,
  CARAT_REFS, RATIO_EXAMPLES, caratDiameterMm, nearestIndex,
} from "../lib/stoneEdu.js";

/* ---------- 공용 글리프 ---------- */

// 셰이프 외곽선 (viewBox 0 0 40 48). 내부에 55% 축소 사본을 겹쳐 테이블 패싯을 암시.
const SHAPE_NODES = {
  round: <circle cx="20" cy="24" r="16" />,
  oval: <ellipse cx="20" cy="24" rx="13" ry="19" />,
  princess: <rect x="6" y="10" width="28" height="28" />,
  cushion: <rect x="6" y="10" width="28" height="28" rx="8" />,
  emerald: <polygon points="13,6 27,6 32,11 32,37 27,42 13,42 8,37 8,11" />,
  asscher: <polygon points="12,10 28,10 34,16 34,32 28,38 12,38 6,32 6,16" />,
  radiant: <polygon points="10,9 30,9 34,13 34,35 30,39 10,39 6,35 6,13" />,
  pear: <path d="M20 4 C28 14 34 22 34 31 a14 14 0 1 1 -28 0 C6 22 12 14 20 4 Z" />,
  marquise: <path d="M20 4 C30 14 34 19 34 24 C34 29 30 34 20 44 C10 34 6 29 6 24 C6 19 10 14 20 4 Z" />,
};

function ShapeGlyph({ shape, size = 22 }) {
  const node = SHAPE_NODES[shape] || SHAPE_NODES.round;
  return (
    <svg viewBox="0 0 40 48" width={size} height={size * 1.2} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        {node}
        <g transform="translate(20 24) scale(0.55) translate(-20 -24)" opacity="0.5">{node}</g>
      </g>
    </svg>
  );
}

// 측면 브릴리언트 실루엣 — 컬러 틴트/형광 표현용
function DiamondGlyph({ fill, active, size = 26 }) {
  return (
    <svg viewBox="0 0 24 22" width={size} height={size * 0.92} aria-hidden>
      <polygon points="4,1 20,1 23,8 12,21 1,8" fill={fill}
        stroke={active ? "var(--accent)" : "rgba(0,0,0,0.3)"} strokeWidth={active ? 1.4 : 0.7} />
      <polyline points="1,8 23,8" stroke="rgba(0,0,0,0.16)" strokeWidth="0.7" fill="none" />
      <polyline points="8,1 7,8 12,21 17,8 16,1" stroke="rgba(0,0,0,0.1)" strokeWidth="0.7" fill="none" />
    </svg>
  );
}

/* ---------- 필드별 비주얼 ---------- */

function ShapeVisual({ prefs }) {
  const { p } = useLocale();
  const shape = SHAPE_NODES[prefs.shape] ? prefs.shape : "round";
  return (
    <div>
      <div className="edu-shape-hero">
        <ShapeGlyph shape={shape} size={56} />
        <span>{p.shapes[shape] || shape}</span>
      </div>
      <div className="edu-shape-row">
        {BENCHMARK_SHAPES.filter((s) => s !== shape).map((s) => <ShapeGlyph key={s} shape={s} />)}
      </div>
    </div>
  );
}

function CaratVisual({ prefs }) {
  const active = nearestIndex(CARAT_REFS, prefs.carat);
  const px = (ct) => caratDiameterMm(ct) * 4.6; // mm → px (3ct ≈ 43px로 viewBox에 맞춤)
  return (
    <div className="edu-scale-row">
      {CARAT_REFS.map((ct, i) => (
        <div key={ct} className={`edu-scale-item ${i === active ? "is-active" : ""}`}>
          <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden>
            <circle cx="22" cy="22" r={px(ct) / 2} fill="none"
              stroke={i === active ? "var(--accent)" : "var(--line-strong)"} strokeWidth={i === active ? 1.6 : 1} />
          </svg>
          <span>{ct} ct</span>
        </div>
      ))}
    </div>
  );
}

function ColorVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      {COLOR_SCALE.map((g) => (
        <div key={g} className={`edu-scale-item ${g === prefs.color ? "is-active" : ""}`}>
          <DiamondGlyph fill={COLOR_TINTS[g]} active={g === prefs.color} />
          <span>{g}</span>
        </div>
      ))}
    </div>
  );
}

// 돋보기 원 안 내포물 점 — 등급이 내려갈수록 점이 늘어난다 (고정 좌표)
const INCLUSION_POS = [[13, 9], [8, 14], [15, 14], [9, 8], [12, 12]];

function ClarityVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      {CLARITY_SCALE.map((g) => (
        <div key={g} className={`edu-scale-item ${g === prefs.clarity ? "is-active" : ""}`}>
          <svg viewBox="0 0 22 22" width="30" height="30" aria-hidden>
            <circle cx="11" cy="11" r="9.5" fill="none"
              stroke={g === prefs.clarity ? "var(--accent)" : "var(--line-strong)"} strokeWidth="1.1" />
            {INCLUSION_POS.slice(0, CLARITY_DOTS[g]).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="0.9" fill="var(--muted)" />
            ))}
          </svg>
          <span>{g}</span>
        </div>
      ))}
    </div>
  );
}

function GrowthVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      <div className={`edu-scale-item edu-growth ${prefs.growth === "CVD" ? "is-active" : ""}`}>
        <svg viewBox="0 0 52 40" width="74" height="57" aria-hidden>
          {[10, 22, 34, 44].map((x, i) => <circle key={x} cx={x} cy={6 + (i % 2) * 3} r="1.2" fill="var(--quiet)" />)}
          {[27, 22, 17, 12].map((y, i) => (
            <rect key={y} x={14 + i * 1.5} y={y} width={24 - i * 3} height="3.4"
              fill="none" stroke="currentColor" strokeWidth="1" opacity={1 - i * 0.18} />
          ))}
          <rect x="12" y="32" width="28" height="3" fill="var(--quiet)" opacity="0.5" />
        </svg>
        <span>CVD</span>
      </div>
      <div className={`edu-scale-item edu-growth ${prefs.growth === "HPHT" ? "is-active" : ""}`}>
        <svg viewBox="0 0 52 40" width="74" height="57" aria-hidden>
          <polygon points="26,12 34,20 26,28 18,20" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M26 2 v6 M26 38 v-6 M6 20 h6 M46 20 h-6" stroke="var(--quiet)" strokeWidth="1.3" fill="none" />
          <path d="M23.6 6 L26 9.4 L28.4 6 M23.6 34 L26 30.6 L28.4 34 M9 17.6 L12.4 20 L9 22.4 M43 17.6 L39.6 20 L43 22.4"
            fill="none" stroke="var(--quiet)" strokeWidth="1.1" />
        </svg>
        <span>HPHT</span>
      </div>
    </div>
  );
}

function LabVisual() {
  return (
    <svg viewBox="0 0 120 44" width="100%" height="56" aria-hidden>
      <rect x="4" y="5" width="50" height="34" fill="none" stroke="var(--line-strong)" strokeWidth="1.1" />
      {[12, 18, 24].map((y) => <line key={y} x1="10" y1={y} x2="40" y2={y} stroke="var(--quiet)" strokeWidth="1.1" />)}
      <circle cx="44" cy="31" r="5" fill="none" stroke="var(--accent)" strokeWidth="1.1" />
      <polygon points="78,8 102,8 108,17 90,38 72,17" fill="none" stroke="var(--line-strong)" strokeWidth="1.1" />
      <line x1="72" y1="17" x2="108" y2="17" stroke="var(--accent)" strokeWidth="1.3" />
      <text x="90" y="14.8" textAnchor="middle" fontSize="4.6" fill="var(--accent)" fontFamily="monospace">IGI LG1234567</text>
    </svg>
  );
}

const GLOW = { none: 0, faint: 0.22, medium: 0.45 };

function FluorVisual({ prefs }) {
  return (
    <div className="edu-scale-row">
      {FLUOR_LEVELS.map((lv) => (
        <div key={lv} className={`edu-scale-item ${lv === prefs.fluorescence ? "is-active" : ""}`}>
          <svg viewBox="0 0 36 34" width="44" height="42" aria-hidden>
            {GLOW[lv] > 0 && <ellipse cx="18" cy="16" rx="15" ry="13" fill="#7da7ff" opacity={GLOW[lv]} />}
            <polygon points="10,6 26,6 30,13 18,29 6,13" fill={GLOW[lv] ? "#e7efff" : "#f5f7fb"}
              stroke={lv === prefs.fluorescence ? "var(--accent)" : "rgba(0,0,0,0.3)"}
              strokeWidth={lv === prefs.fluorescence ? 1.4 : 0.7} />
          </svg>
          <span style={{ textTransform: "capitalize" }}>{lv}</span>
        </div>
      ))}
    </div>
  );
}

function RatioVisual({ prefs }) {
  const active = nearestIndex(RATIO_EXAMPLES, prefs.lwRatio);
  return (
    <div className="edu-scale-row">
      {RATIO_EXAMPLES.map((r, i) => (
        <div key={r} className={`edu-scale-item ${i === active ? "is-active" : ""}`}>
          <svg viewBox="0 0 40 56" width="40" height="56" aria-hidden>
            <ellipse cx="20" cy="28" rx="13" ry={13 * r} fill="none"
              stroke={i === active ? "var(--accent)" : "var(--line-strong)"} strokeWidth={i === active ? 1.6 : 1} />
          </svg>
          <span>{r.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 패널 본체 ---------- */

const VISUALS = {
  shape: ShapeVisual, carat: CaratVisual, color: ColorVisual, clarity: ClarityVisual,
  growth: GrowthVisual, lab: LabVisual, fluorescence: FluorVisual, lwRatio: RatioVisual,
};

export default function StoneEduPanel({ field, prefs }) {
  const { p } = useLocale();
  const key = p.stoneEdu[field] && VISUALS[field] ? field : "shape";
  const edu = p.stoneEdu[key];
  const Visual = VISUALS[key];
  return (
    <div className="stone-edu-panel panel">
      <div className="stone-edu-kicker">{p.stoneEdu.kicker}</div>
      <h4>{edu.title}</h4>
      <div className="stone-edu-visual"><Visual prefs={prefs} /></div>
      <p className="stone-edu-body">{edu.body}</p>
      <p className="stone-edu-guide">{edu.guide}</p>
    </div>
  );
}
