import { BENCHMARK_SHAPES, CARAT_TIERS } from "../../lib/ops.js";
import { getBenchmark, setBenchmarkPrice } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";

export default function AdminBenchmark() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.opsA.bench;
  const rows = getBenchmark();
  const cell = (shape, tier) => rows.find((r) => r.shape === shape && r.tier === tier);

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <h3>{t.title}</h3>
      <p className="form-hint" style={{ marginBottom: 14 }}>{t.note}</p>
      <table className="data-table">
        <thead>
          <tr><th /> {CARAT_TIERS.map((tier) => <th key={tier.key}>{tier.key}</th>)}</tr>
        </thead>
        <tbody>
          {BENCHMARK_SHAPES.map((shape) => (
            <tr key={shape}>
              <th>{p.shapes[shape] || shape}</th>
              {CARAT_TIERS.map((tier) => {
                const r = cell(shape, tier.key);
                return (
                  <td key={tier.key}>
                    <input type="number" style={{ width: 72 }} defaultValue={r?.unitUsdPerCt} key={`${shape}-${tier.key}-${r?.unitUsdPerCt}`}
                      onBlur={(e) => { const v = Number(e.target.value); if (v && v !== r?.unitUsdPerCt) setBenchmarkPrice(shape, tier.key, v); }} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="form-hint" style={{ marginTop: 10 }}>{t.quoted}: {rows[0]?.quoteDate}</p>
    </div>
  );
}
