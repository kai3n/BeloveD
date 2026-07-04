// 메탈 시세 콘솔 — settings.metalRefUsdPerG($/g)를 관리한다.
// 견적 프리필(quoteEstimate·quote builder)이 이 값을 실시간으로 읽는다. 과거 견적은 스냅샷이라 영향 없음.
import { useState } from "react";
import { adjustMetalPricing, getSettings, setMetalPrice, updateSettings } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";
import { ConsoleHead } from "./console.jsx";
import { pushSettingsToServer } from "../../lib/serverSync.js";

const COPY = {
  en: {
    title: "Metal Reference ($/g)",
    sub: "Per-gram metal reference used to prefill quotes and the customer price estimate. Past quotes keep their snapshot.",
    bulk: "Bulk adjust", pct: "Change (%)", apply: "Apply", all: "All metals",
    metal: "Metal", price: "$/g",
    saved: "Saved", applied: (n, pct) => `${pct}% applied to ${n} metals`,
    autoHint: "Prices save automatically when you leave a cell", quoted: "Updated",
    lossTitle: "Default loss rate", lossHint: "Casting loss % applied on top of metal weight in every new quote.",
  },
  ko: {
    title: "메탈 시세 ($/g)",
    sub: "견적 프리필과 고객 견적 추정에 실시간으로 쓰이는 그램당 기준가입니다. 과거 견적은 스냅샷이라 영향받지 않습니다.",
    bulk: "일괄 조정", pct: "조정률 (%)", apply: "적용", all: "전체 메탈",
    metal: "메탈", price: "$/g",
    saved: "저장됨", applied: (n, pct) => `${n}개 메탈에 ${pct}% 적용됨`,
    autoHint: "칸을 벗어나면 자동 저장됩니다", quoted: "업데이트",
    lossTitle: "기본 로스율", lossHint: "새 견적마다 메탈 중량에 가산되는 주조 로스 %입니다.",
  },
  zh: {
    title: "金属基准价 ($/g)",
    sub: "用于报价预填与客户估价的每克基准价，实时生效。历史报价保留快照，不受影响。",
    bulk: "批量调整", pct: "调整率 (%)", apply: "应用", all: "全部金属",
    metal: "金属", price: "$/g",
    saved: "已保存", applied: (n, pct) => `已对 ${n} 种金属应用 ${pct}%`,
    autoHint: "离开单元格后自动保存", quoted: "更新",
    lossTitle: "默认损耗率", lossHint: "每份新报价在金属重量上附加的铸造损耗 %。",
  },
  es: {
    title: "Referencia de Metal ($/g)",
    sub: "Precio por gramo usado para prellenar cotizaciones y la estimación del cliente. Las cotizaciones pasadas conservan su snapshot.",
    bulk: "Ajuste masivo", pct: "Cambio (%)", apply: "Aplicar", all: "Todos los metales",
    metal: "Metal", price: "$/g",
    saved: "Guardado", applied: (n, pct) => `${pct}% aplicado a ${n} metales`,
    autoHint: "Se guarda automáticamente al salir de la celda", quoted: "Actualizado",
    lossTitle: "Merma por defecto", lossHint: "% de merma de fundición añadido al peso del metal en cada cotización nueva.",
  },
};

export default function AdminMetals() {
  useDBVersion();
  const { p, locale } = useLocale();
  const c = COPY[locale] || COPY.en;
  const settings = getSettings();
  const metals = settings.metalRefUsdPerG || {};
  const [notice, setNotice] = useState("");
  const [pct, setPct] = useState("");

  function commit(metal, prev, value) {
    const v = Number(value);
    if (!v || v === prev) return;
    setMetalPrice(metal, v);
    const next = getSettings();
    pushSettingsToServer({ metalRefUsdPerG: next.metalRefUsdPerG, metalQuotedDate: next.metalQuotedDate || null });
    setNotice(`${c.saved} — ${p.opsMetals[metal] || metal}`);
  }

  function applyBulk() {
    const delta = Number(pct);
    if (!delta) return;
    const count = adjustMetalPricing(delta);
    const next = getSettings();
    pushSettingsToServer({ metalRefUsdPerG: next.metalRefUsdPerG, metalQuotedDate: next.metalQuotedDate || null });
    setNotice(c.applied(count, `${delta > 0 ? "+" : ""}${delta}`));
    setPct("");
  }

  return (
    <>
      <ConsoleHead kicker={p.opsA.menu.metals} title={c.title} sub={c.sub}>
        {notice && <span className="con-saved-flash" role="status">{notice}</span>}
      </ConsoleHead>

      <div className="con-adjust con-narrow">
        <span className="con-adjust-label">{c.bulk} · {c.all}</span>
        <label className="field field-pct"><span>{c.pct}</span>
          <input
            type="number" step="0.5" value={pct} placeholder="+5 / -3"
            onChange={(e) => setPct(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyBulk(); }}
          />
        </label>
        <button className="button primary small" type="button" disabled={!Number(pct)} onClick={applyBulk}>
          {c.apply}
        </button>
      </div>

      <div className="con-table-panel con-bench con-narrow">
        <table className="data-table">
          <thead>
            <tr><th>{c.metal}</th><th>{c.price}</th></tr>
          </thead>
          <tbody>
            {Object.entries(metals).map(([metal, price]) => (
              <tr key={metal}>
                <th scope="row">{p.opsMetals[metal] || metal}</th>
                <td>
                  <input
                    type="number" step="0.1"
                    defaultValue={price}
                    key={`${metal}-${price}`}
                    aria-label={p.opsMetals[metal] || metal}
                    onBlur={(e) => commit(metal, price, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="con-note con-narrow">
        {c.autoHint}
        {settings.metalQuotedDate ? ` · ${c.quoted}: ${settings.metalQuotedDate}` : ""}
      </p>

      <div className="con-section-label"><h3>{c.lossTitle}</h3></div>
      <div className="con-table-panel con-narrow" style={{ padding: "16px 18px 18px" }}>
        <label className="field" style={{ maxWidth: 220 }}><span>{p.opsA.orders.lossRate}</span>
          <input
            type="number" step="0.5" min="0" max="30"
            defaultValue={settings.defaultLossRatePct}
            key={settings.defaultLossRatePct}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== settings.defaultLossRatePct) {
                updateSettings({ defaultLossRatePct: v });
                pushSettingsToServer({ defaultLossRatePct: v });
                setNotice(`${c.saved} — ${p.opsA.orders.lossRate}`);
              }
            }}
          />
        </label>
        <p className="con-note">{c.lossHint}</p>
      </div>
    </>
  );
}
