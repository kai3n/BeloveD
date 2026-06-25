// 카테고리별 사이즈/디자인 가이드 — RingSizeHelp과 동일한 패널 스타일. 표시 전용.
// 링은 기존 RingSizeHelp 재사용, 목걸이/팔찌/귀걸이는 i18n 가이드 객체를 표로 렌더.
import { useLocale } from "../i18n.jsx";
import RingSizeHelp from "./RingSizeHelp.jsx";

function NecklaceGlyph() {
  return (
    <svg viewBox="0 0 120 70" width="100%" height="84" aria-hidden>
      <path d="M30 12 C 45 56, 75 56, 90 12" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      <line x1="60" y1="51" x2="60" y2="46" stroke="var(--silver)" strokeWidth="1.4" />
      <circle cx="60" cy="56" r="5" fill="none" stroke="var(--silver)" strokeWidth="1.6" />
    </svg>
  );
}

function BraceletGlyph() {
  return (
    <svg viewBox="0 0 120 70" width="100%" height="84" aria-hidden>
      <ellipse cx="60" cy="35" rx="34" ry="23" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <ellipse cx="60" cy="35" rx="28" ry="17" fill="none" stroke="var(--silver)" strokeWidth="1.4" />
      <line x1="32" y1="35" x2="88" y2="35" stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M32 35 l6 -4 v8 z" fill="var(--muted)" />
      <path d="M88 35 l-6 -4 v8 z" fill="var(--muted)" />
    </svg>
  );
}

function EarringGlyph() {
  return (
    <svg viewBox="0 0 120 70" width="100%" height="84" aria-hidden>
      <path d="M52 14 C 38 14, 36 40, 52 46 C 60 49, 60 40, 56 38" fill="none" stroke="var(--silver)" strokeWidth="1.6" />
      <circle cx="54" cy="46" r="3.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <line x1="54" y1="49" x2="54" y2="59" stroke="var(--accent)" strokeWidth="1.4" />
      <circle cx="54" cy="62" r="3" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
    </svg>
  );
}

function GuidePanel({ guide, glyph }) {
  if (!guide) return null;
  return (
    <div className="stone-edu-panel panel">
      <div className="stone-edu-kicker">{guide.kicker}</div>
      <h4>{guide.title}</h4>
      {glyph && <div className="stone-edu-visual">{glyph}</div>}
      {guide.how.map((line, i) => (
        <p key={i} className="stone-edu-body" style={i ? { marginTop: 4 } : undefined}>· {line}</p>
      ))}
      {guide.cols && guide.rows && (
        <table className="data-table" style={{ marginTop: 12, fontSize: 12 }}>
          <thead><tr>{guide.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {guide.rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CategoryGuide({ category }) {
  const { p } = useLocale();
  const t = p.intake;
  if (category === "ring") return <RingSizeHelp />;
  if (category === "necklace") return <GuidePanel guide={t.necklaceHelp} glyph={<NecklaceGlyph />} />;
  if (category === "bangle") return <GuidePanel guide={t.braceletHelp} glyph={<BraceletGlyph />} />;
  if (category === "earrings") return <GuidePanel guide={t.earringHelp} glyph={<EarringGlyph />} />;
  return null;
}
