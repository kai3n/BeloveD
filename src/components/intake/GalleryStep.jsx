import { useEffect, useId, useRef } from "react";

// 풀스크린 한 화면 한 질문 셸 — 진행 도트 + 질문 + 답변 슬롯 + 뒤로/건너뛰기
export default function GalleryStep({
  index,
  total,
  kicker,
  title,
  hint,
  onBack,
  onSkip,
  backLabel = "Back",
  skipLabel = "Skip",
  skipDisabled = false,
  children,
}) {
  const titleId = useId();
  const titleRef = useRef(null);

  // A route does not change between wizard questions, so explicitly move focus
  // to the new question instead of leaving keyboard/screen-reader users on a
  // control that just disappeared.
  useEffect(() => {
    titleRef.current?.focus();
  }, [index, title]);

  return (
    <section className="gflow-step" aria-labelledby={titleId}>
      <div className="gflow-progress" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />
        ))}
      </div>
      <div className="gflow-body">
        {kicker && <p className="gflow-kicker">{kicker}</p>}
        <h2 id={titleId} ref={titleRef} className="gflow-title" tabIndex={-1}>{title}</h2>
        {hint && <p className="gflow-hint">{hint}</p>}
        <div className="gflow-answers">{children}</div>
      </div>
      <div className="gflow-footer">
        {onBack ? <button type="button" className="gflow-ghost" onClick={onBack}>← {backLabel}</button> : <span />}
        {onSkip ? <button type="button" className="gflow-ghost" disabled={skipDisabled} onClick={onSkip}>{skipLabel} →</button> : <span />}
      </div>
    </section>
  );
}
