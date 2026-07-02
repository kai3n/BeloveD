// 풀스크린 한 화면 한 질문 셸 — 진행 도트 + 질문 + 답변 슬롯 + 뒤로/건너뛰기
export default function GalleryStep({ index, total, kicker, title, hint, onBack, onSkip, backLabel = "Back", skipLabel = "Skip", children }) {
  return (
    <div className="gflow-step" key={`${index}-${title}`}>
      <div className="gflow-progress" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />
        ))}
      </div>
      <div className="gflow-body">
        {kicker && <p className="gflow-kicker">{kicker}</p>}
        <h2 className="gflow-title">{title}</h2>
        {hint && <p className="gflow-hint">{hint}</p>}
        <div className="gflow-answers">{children}</div>
      </div>
      <div className="gflow-footer">
        {onBack ? <button type="button" className="gflow-ghost" onClick={onBack}>← {backLabel}</button> : <span />}
        {onSkip ? <button type="button" className="gflow-ghost" onClick={onSkip}>{skipLabel} →</button> : <span />}
      </div>
    </div>
  );
}
