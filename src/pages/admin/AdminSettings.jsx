import { getDB, getSettings, resetDB, saveChip, updateSettings } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";

export default function AdminSettings() {
  useDBVersion();
  const { p } = useLocale();
  const settings = getSettings();

  return (
    <>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.admin.settings.payTitle}</h3>
        <label className="field"><span>{p.admin.settings.depositPct}</span>
          <input
            type="number" min="10" max="90" step="5" defaultValue={Math.round(settings.opsDepositRate * 100)} key={settings.opsDepositRate}
            onBlur={(e) => updateSettings({ opsDepositRate: Number(e.target.value) / 100 })}
          /></label>
        <label className="field"><span>{p.opsA.orders.lossRate}</span>
          <input
            type="number" step="0.5" defaultValue={settings.defaultLossRatePct} key={settings.defaultLossRatePct}
            onBlur={(e) => updateSettings({ defaultLossRatePct: Number(e.target.value) })}
          /></label>
        <p className="form-hint">{p.admin.settings.applyNote}</p>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.opsA.orders.metalRef}</h3>
        <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {Object.entries(settings.metalRefUsdPerG).map(([metal, price]) => (
            <label className="field" key={metal}><span>{p.opsMetals[metal] || metal}</span>
              <input type="number" step="0.5" defaultValue={price} key={`${metal}-${price}`}
                onBlur={(e) => updateSettings({ metalRefUsdPerG: { ...settings.metalRefUsdPerG, [metal]: Number(e.target.value) } })} />
            </label>
          ))}
        </div>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.admin.settings.heroTitle}</h3>
        <p className="form-hint">{p.admin.settings.heroNote}</p>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.visual.chipTitle}</h3>
        {getDB().chipCatalog.map((c) => (
          <div className="row-actions" key={c.key}>
            <button className={`chip ${c.active !== false ? "is-active" : ""}`}
              onClick={() => saveChip({ key: c.key, active: c.active === false })}>
              {c.labels.ko} / {c.labels.zh}
            </button>
            <span className="form-hint">{c.key} · {(c.parts || ["all"]).join(",")} · {c.valueType}</span>
          </div>
        ))}
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.admin.settings.demoTitle}</h3>
        <button className="button danger" onClick={() => { if (confirm(p.admin.settings.resetAsk)) resetDB(); }}>
          {p.admin.settings.resetBtn}
        </button>
      </div>
    </>
  );
}
