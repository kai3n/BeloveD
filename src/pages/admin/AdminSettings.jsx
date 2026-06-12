import { getSettings, resetDB, updateSettings } from "../../lib/store.js";
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
            type="number" min="10" max="90" step="5" defaultValue={Math.round(settings.depositRate * 100)} key={settings.depositRate}
            onBlur={(e) => updateSettings({ depositRate: Number(e.target.value) / 100 })}
          /></label>
        <p className="form-hint">{p.admin.settings.applyNote}</p>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.admin.settings.stagesTitle}</h3>
        <p className="form-hint">{settings.shippingStages.map((s) => p.stages[s] || s).join(" → ")}</p>
      </div>
      <div className="panel form-stack" style={{ maxWidth: 480 }}>
        <h3>{p.admin.settings.heroTitle}</h3>
        <p className="form-hint">{p.admin.settings.heroNote}</p>
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
