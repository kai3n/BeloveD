// 링 사이즈 도움말 — StoneEduPanel과 동일한 패널 스타일. 측정 그림 + US/둘레/지름 환산표. 표시 전용.
import { useLocale } from "../i18n.jsx";

// US 사이즈 → 안지름(mm) / 안둘레(mm) — 만국 공통 수치
const RING_SIZES = [
  { us: 4, dia: 14.9, circ: 46.8 },
  { us: 5, dia: 15.7, circ: 49.3 },
  { us: 6, dia: 16.5, circ: 51.9 },
  { us: 7, dia: 17.3, circ: 54.4 },
  { us: 8, dia: 18.2, circ: 57.2 },
  { us: 9, dia: 19.0, circ: 59.5 },
  { us: 10, dia: 19.8, circ: 62.3 },
  { us: 11, dia: 20.7, circ: 65.0 },
];

// 손가락 단면 + 안지름 캘리퍼 + 반지 밴드
function MeasureGlyph() {
  return (
    <svg viewBox="0 0 120 70" width="100%" height="84" aria-hidden>
      {/* 반지 밴드 (바깥/안 원) */}
      <circle cx="60" cy="35" r="26" fill="none" stroke="var(--accent)" strokeWidth="3" />
      {/* 손가락 단면 */}
      <circle cx="60" cy="35" r="20" fill="none" stroke="var(--silver)" strokeWidth="1.4" />
      {/* 안지름 캘리퍼 화살표 */}
      <line x1="40" y1="35" x2="80" y2="35" stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />
      <path d="M40 35 l6 -4 v8 z" fill="var(--muted)" />
      <path d="M80 35 l-6 -4 v8 z" fill="var(--muted)" />
      <text x="60" y="31" textAnchor="middle" fontSize="7" fill="var(--muted)">⌀</text>
    </svg>
  );
}

export default function RingSizeHelp() {
  const { p } = useLocale();
  const t = p.intake.ringHelp;
  return (
    <div className="stone-edu-panel panel">
      <div className="stone-edu-kicker">{t.kicker}</div>
      <h4>{t.title}</h4>
      <div className="stone-edu-visual"><MeasureGlyph /></div>
      <p className="stone-edu-body">· {t.how1}</p>
      <p className="stone-edu-body" style={{ marginTop: 4 }}>· {t.how2}</p>
      <table className="data-table" style={{ marginTop: 12, fontSize: 12 }}>
        <thead><tr><th>{t.colUs}</th><th>{t.colCirc}</th><th>{t.colDia}</th></tr></thead>
        <tbody>
          {RING_SIZES.map((r) => (
            <tr key={r.us}><td>{r.us}</td><td>{r.circ}</td><td>{r.dia}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
