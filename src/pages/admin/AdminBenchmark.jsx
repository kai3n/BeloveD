import { useState } from "react";
import { BENCHMARK_SHAPES, CARAT_TIERS } from "../../lib/ops.js";
import { adjustBenchmark, getBenchmark, getSettings, setBenchmarkPrice, updateSettings } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";
import { ConsoleHead } from "./console.jsx";
import { pushSettingsToServer } from "../../lib/serverSync.js";

// 일괄 조정 바 카피 — 벤치마크 페이지 전용
const BULK_COPY = {
  en: { bulk: "Bulk adjust", shape: "Shape", tier: "Carat tier", all: "All", pct: "Change (%)", apply: "Apply", applied: (n, pct) => `${pct}% applied to ${n} cells` },
  ko: { bulk: "일괄 조정", shape: "셰입", tier: "캐럿 티어", all: "전체", pct: "조정률 (%)", apply: "적용", applied: (n, pct) => `${n}개 칸에 ${pct}% 적용됨` },
  zh: { bulk: "批量调整", shape: "形状", tier: "克拉档", all: "全部", pct: "调整率 (%)", apply: "应用", applied: (n, pct) => `已对 ${n} 个单元格应用 ${pct}%` },
  es: { bulk: "Ajuste masivo", shape: "Forma", tier: "Rango de quilates", all: "Todos", pct: "Cambio (%)", apply: "Aplicar", applied: (n, pct) => `${pct}% aplicado a ${n} celdas` },
};

// 멜리(멀티스톤) 단가 카피 — 총캐럿 견적용
const MELEE_COPY = {
  en: { title: "Melee rate", unit: "USD / ct (total)", hint: "Multi-stone estimates = total carats × this rate × multiplier." },
  ko: { title: "멜리 단가", unit: "USD / ct (합계)", hint: "멀티스톤 견적 = 총 캐럿 × 이 단가 × 멀티플라이어." },
  zh: { title: "碎钻单价", unit: "USD / 克拉（总计）", hint: "多钻预估 = 总克拉 × 此单价 × 倍数。" },
  es: { title: "Tarifa melee", unit: "USD / ct (total)", hint: "Estimación multi-piedra = quilates totales × esta tarifa × multiplicador." },
};

export default function AdminBenchmark() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.opsA.bench;
  const b = BULK_COPY[locale] || BULK_COPY.en;
  const rows = getBenchmark();
  const [savedCell, setSavedCell] = useState("");
  const [bulk, setBulk] = useState({ shape: "", tier: "", pct: "" });
  const cell = (shape, tier) => rows.find((r) => r.shape === shape && r.tier === tier);
  const m = MELEE_COPY[locale] || MELEE_COPY.en;
  const meleeUsdPerCt = getSettings().meleeUsdPerCt ?? 150;

  function commitMelee(value) {
    const v = Number(value);
    if (!v || v === meleeUsdPerCt) return;
    updateSettings({ meleeUsdPerCt: v });
    pushSettingsToServer({ meleeUsdPerCt: v });
    setSavedCell(`${t.saved} — ${m.title}`);
  }

  function commit(shape, tier, prev, value) {
    const v = Number(value);
    if (!v || v === prev) return;
    setBenchmarkPrice(shape, tier, v);
    pushSettingsToServer({ diamondPricing: getBenchmark() });
    setSavedCell(`${t.saved} — ${p.shapes[shape] || shape} · ${tier}`);
  }

  function applyBulk() {
    const pct = Number(bulk.pct);
    if (!pct) return;
    const count = adjustBenchmark({ shape: bulk.shape || null, tier: bulk.tier || null, pct });
    pushSettingsToServer({ diamondPricing: getBenchmark() });
    const signed = `${pct > 0 ? "+" : ""}${pct}`;
    setSavedCell(b.applied(count, signed));
    setBulk((current) => ({ ...current, pct: "" }));
  }

  return (
    <>
      <ConsoleHead kicker={p.opsA.menu.benchmark} title={t.title} sub={t.note}>
        {savedCell && <span className="con-saved-flash" role="status">{savedCell}</span>}
      </ConsoleHead>

      <div className="con-adjust">
        <span className="con-adjust-label">{b.bulk}</span>
        <label className="field"><span>{b.shape}</span>
          <select value={bulk.shape} onChange={(e) => setBulk({ ...bulk, shape: e.target.value })}>
            <option value="">{b.all}</option>
            {BENCHMARK_SHAPES.map((shape) => <option key={shape} value={shape}>{p.shapes[shape] || shape}</option>)}
          </select>
        </label>
        <label className="field"><span>{b.tier}</span>
          <select value={bulk.tier} onChange={(e) => setBulk({ ...bulk, tier: e.target.value })}>
            <option value="">{b.all}</option>
            {CARAT_TIERS.map((tier) => <option key={tier.key} value={tier.key}>{tier.key}</option>)}
          </select>
        </label>
        <label className="field field-pct"><span>{b.pct}</span>
          <input
            type="number" step="0.5" value={bulk.pct} placeholder="+5 / -3"
            onChange={(e) => setBulk({ ...bulk, pct: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") applyBulk(); }}
          />
        </label>
        <button className="button primary small" type="button" disabled={!Number(bulk.pct)} onClick={applyBulk}>
          {b.apply}
        </button>
      </div>

      {/* 멜리 단가 — 멀티스톤(테니스류) 총캐럿 견적의 $/ct */}
      <div className="con-adjust">
        <span className="con-adjust-label">{m.title}</span>
        <label className="field field-pct"><span>{m.unit}</span>
          <input
            type="number" step="5" min="1"
            defaultValue={meleeUsdPerCt} key={meleeUsdPerCt}
            onBlur={(e) => commitMelee(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          />
        </label>
        <span className="con-note" style={{ margin: 0 }}>{m.hint}</span>
      </div>

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
