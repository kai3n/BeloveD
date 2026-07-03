import { getDB, getSettings, resetDB, saveChip, updateSettings } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";

// 결제 채널(디파짓/잔금 수동 확인) 설정 카피
const PAYMENT_SETTINGS_COPY = {
  en: { title: "Payment channels (Zelle / Venmo)", note: "Shown to customers on the deposit and balance cards. Payments are confirmed manually.", extraNote: "Extra note shown under the handles (optional)" },
  ko: { title: "결제 채널 (Zelle / Venmo)", note: "고객 디파짓·잔금 카드에 표시됩니다. 입금은 수동으로 확인합니다.", extraNote: "계정 아래 표시할 추가 안내 (선택)" },
  zh: { title: "收款渠道 (Zelle / Venmo)", note: "显示在客户的定金与尾款卡片上。到账需手动确认。", extraNote: "账号下方的附加说明（可选）" },
  es: { title: "Canales de pago (Zelle / Venmo)", note: "Se muestran al cliente en las tarjetas de depósito y saldo. Los pagos se confirman manualmente.", extraNote: "Nota adicional bajo las cuentas (opcional)" },
};

export default function AdminSettings() {
  useDBVersion();
  const { p, locale } = useLocale();
  const settings = getSettings();
  const payment = settings.payment || { zelle: "", venmo: "", note: "" };
  const payCopy = PAYMENT_SETTINGS_COPY[locale] || PAYMENT_SETTINGS_COPY.en;
  const setPayment = (patch) => updateSettings({ payment: { ...payment, ...patch } });

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
        <h3>{payCopy.title}</h3>
        <p className="form-hint">{payCopy.note}</p>
        <label className="field"><span>Zelle</span>
          <input defaultValue={payment.zelle} key={`zelle-${payment.zelle}`}
            onBlur={(e) => setPayment({ zelle: e.target.value.trim() })} placeholder="alan20062006@vip.qq.com" />
        </label>
        <label className="field"><span>Venmo</span>
          <input defaultValue={payment.venmo} key={`venmo-${payment.venmo}`}
            onBlur={(e) => setPayment({ venmo: e.target.value.trim() })} placeholder="@Belove-Dia" />
        </label>
        <label className="field"><span>{payCopy.extraNote}</span>
          <input defaultValue={payment.note} key={`paynote-${payment.note}`}
            onBlur={(e) => setPayment({ note: e.target.value.trim() })} />
        </label>
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
