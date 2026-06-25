import { useLocale } from "../i18n.jsx";

function LayoutGlyph() {
  return (
    <svg viewBox="0 0 140 78" width="100%" height="92" aria-hidden>
      <g fill="none" stroke="var(--accent)" strokeWidth="1.7">
        <circle cx="70" cy="38" r="12" />
        <circle cx="70" cy="38" r="5.5" opacity="0.55" />
      </g>
      <g fill="none" stroke="var(--silver)" strokeWidth="1.25" opacity="0.9">
        {[
          [42, 38], [48, 25], [48, 51], [58, 17], [58, 59],
          [82, 17], [82, 59], [92, 25], [92, 51], [98, 38],
        ].map(([cx, cy], index) => (
          <circle key={index} cx={cx} cy={cy} r="4.2" />
        ))}
      </g>
      <path d="M34 66 C 50 58, 90 58, 106 66" stroke="var(--line-strong)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export default function MultiStoneGuide() {
  const { p } = useLocale();
  const guide = p.intake.multiGuide;
  if (!guide) return null;
  return (
    <div className="stone-edu-panel multi-stone-guide panel">
      <div className="stone-edu-kicker">{guide.kicker}</div>
      <h4>{guide.title}</h4>
      <div className="stone-edu-visual"><LayoutGlyph /></div>
      <p className="stone-edu-body">{guide.body}</p>
      <div className="multi-guide-grid">
        {guide.cards.map((card) => (
          <div key={card.label} className="multi-guide-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>
      <div className="multi-guide-examples">
        <span>{guide.exampleLabel}</span>
        {guide.examples.map((example) => <p key={example}>{example}</p>)}
      </div>
      <ul className="multi-guide-list">
        {guide.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </div>
  );
}
