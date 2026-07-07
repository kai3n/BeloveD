// 리뷰 단계 — 선택한 세팅 기준 예상 견적 + 경쟁사 비교(막대). 표시 전용.
import { useLocale } from "../i18n.jsx";
import { estimateQuoteRange } from "../lib/quoteEstimate.js";

const usd = (n) => `$${Math.round(n).toLocaleString()}`;

export default function QuoteCompare({ form }) {
  const { p } = useLocale();
  const t = p.intake.estimate;
  const est = estimateQuoteRange(form);
  const rows = [
    ...est.competitors,
    { name: "BeloveD", low: est.beloved.low, high: est.beloved.high, lowest: true },
  ];
  const maxHigh = Math.max(...rows.map((r) => r.high));

  return (
    <div className="quote-compare">
      <div className="qc-head">
        <div>
          <div className="qc-kicker">{est.solitaire ? t.kickerStone : t.kicker}</div>
          <div className="qc-total">{usd(est.beloved.low)} – {usd(est.beloved.high)}</div>
          {est.coupon && (
            <div className="qc-kicker" style={{ marginTop: 4 }}>{t.couponLine(est.coupon.code, usd(est.coupon.savedUsd))}</div>
          )}
        </div>
        {est.savingsTop > 0 && (
          <div className="qc-savings">{t.savings(usd(est.savingsTop), est.topName)}</div>
        )}
      </div>
      <div className="qc-rows">
        {rows.map((r) => (
          <div key={r.name} className={`qc-row ${r.lowest ? "is-lowest" : ""}`}>
            <div className="qc-name">
              <span>{r.name}</span>
              {r.lowest && <span className="qc-badge">{t.lowest}</span>}
            </div>
            <div className="qc-track">
              <div className="qc-bar" style={{ width: `${Math.max(8, Math.round((r.high / maxHigh) * 100))}%` }} />
            </div>
            <div className="qc-range">{usd(r.low)}–{usd(r.high)}</div>
          </div>
        ))}
      </div>
      <p className="qc-note">{t.note}</p>
    </div>
  );
}
