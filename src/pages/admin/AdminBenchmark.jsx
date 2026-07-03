import { useState } from "react";
import { BENCHMARK_SHAPES, CARAT_TIERS } from "../../lib/ops.js";
import { getBenchmark, setBenchmarkPrice } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";
import { ConsoleHead } from "./console.jsx";

export default function AdminBenchmark() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.opsA.bench;
  const rows = getBenchmark();
  const [savedCell, setSavedCell] = useState("");
  const cell = (shape, tier) => rows.find((r) => r.shape === shape && r.tier === tier);

  function commit(shape, tier, prev, value) {
    const v = Number(value);
    if (!v || v === prev) return;
    setBenchmarkPrice(shape, tier, v);
    setSavedCell(`${p.shapes[shape] || shape} · ${tier}`);
  }

  return (
    <>
      <ConsoleHead kicker={p.opsA.menu.benchmark} title={t.title} sub={t.note}>
        {savedCell && <span className="con-saved-flash" role="status">{t.saved} — {savedCell}</span>}
      </ConsoleHead>
      <div className="con-table-panel con-bench">
        <table className="data-table">
          <thead>
            <tr><th /> {CARAT_TIERS.map((tier) => <th key={tier.key}>{tier.key}</th>)}</tr>
          </thead>
          <tbody>
            {BENCHMARK_SHAPES.map((shape) => (
              <tr key={shape}>
                <th scope="row">{p.shapes[shape] || shape}</th>
                {CARAT_TIERS.map((tier) => {
                  const r = cell(shape, tier.key);
                  return (
                    <td key={tier.key}>
                      <input
                        type="number"
                        defaultValue={r?.unitUsdPerCt}
                        key={`${shape}-${tier.key}-${r?.unitUsdPerCt}`}
                        aria-label={`${p.shapes[shape] || shape} ${tier.key}`}
                        onBlur={(e) => commit(shape, tier.key, r?.unitUsdPerCt, e.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="con-note">{t.autoHint} · {t.quoted}: {rows[0]?.quoteDate}</p>
    </>
  );
}
