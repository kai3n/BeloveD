// 결제 설정 콘솔 — Zelle/Venmo 수취 계정·안내 문구·디파짓 비율.
// 고객 결제 카드(PaymentCard)가 settings.payment를 읽는다 — 서버 write-through로
// 모든 고객 브라우저에 반영된다 (부팅 하이드레이션 경유).
import { useState } from "react";
import { getSettings, updateSettings } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";
import { ConsoleHead } from "./console.jsx";
import { pushSettingsToServer } from "../../lib/serverSync.js";

const COPY = {
  en: {
    title: "Payment Channels",
    sub: "Recipient accounts shown on the customer deposit and balance cards. Transfers are confirmed manually.",
    zelle: "Zelle recipient", venmo: "Venmo handle",
    note: "Extra note under the handles (optional)",
    depositTitle: "Deposit rate",
    depositLbl: "Deposit (%)",
    depositHint: "Default deposit share of the total when a proposal doesn't set its own amount.",
    saved: "Saved",
  },
  ko: {
    title: "결제 채널",
    sub: "고객 디파짓·잔금 카드에 표시되는 수취 계정입니다. 입금은 수동으로 확인합니다.",
    zelle: "Zelle 수취 계정", venmo: "Venmo 핸들",
    note: "계정 아래 추가 안내 (선택)",
    depositTitle: "디파짓 비율",
    depositLbl: "디파짓 (%)",
    depositHint: "제안에서 금액을 따로 정하지 않았을 때 적용되는 기본 디파짓 비율입니다.",
    saved: "저장됨",
  },
  zh: {
    title: "收款渠道",
    sub: "显示在客户定金与尾款卡片上的收款账户。到账需人工确认。",
    zelle: "Zelle 收款账户", venmo: "Venmo 账号",
    note: "账号下方的附加说明（可选）",
    depositTitle: "定金比例",
    depositLbl: "定金 (%)",
    depositHint: "方案未单独设置金额时适用的默认定金比例。",
    saved: "已保存",
  },
  es: {
    title: "Canales de Pago",
    sub: "Cuentas receptoras mostradas en las tarjetas de depósito y saldo del cliente. Los pagos se confirman manualmente.",
    zelle: "Cuenta Zelle", venmo: "Usuario Venmo",
    note: "Nota adicional bajo las cuentas (opcional)",
    depositTitle: "Porcentaje de depósito",
    depositLbl: "Depósito (%)",
    depositHint: "Porcentaje por defecto cuando la propuesta no fija su propio monto.",
    saved: "Guardado",
  },
};

export default function AdminPayments() {
  useDBVersion();
  const { p, locale } = useLocale();
  const c = COPY[locale] || COPY.en;
  const settings = getSettings();
  const payment = settings.payment || { zelle: "", venmo: "", note: "" };
  const [notice, setNotice] = useState("");

  function savePayment(patch) {
    const next = { ...payment, ...patch };
    updateSettings({ payment: next });
    pushSettingsToServer({ payment: next });
    setNotice(c.saved);
  }

  function saveDepositRate(value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 10 || v > 90) return;
    const rate = v / 100;
    if (rate === settings.opsDepositRate) return;
    updateSettings({ opsDepositRate: rate });
    pushSettingsToServer({ opsDepositRate: rate });
    setNotice(`${c.saved} — ${c.depositLbl}`);
  }

  return (
    <>
      <ConsoleHead kicker={p.opsA.menu.payments} title={c.title} sub={c.sub}>
        {notice && <span className="con-saved-flash" role="status">{notice}</span>}
      </ConsoleHead>

      <div className="con-table-panel con-narrow" style={{ padding: "18px 18px 20px" }}>
        <div className="con-grid con-grid-2">
          <label className="field"><span>{c.zelle}</span>
            <input
              defaultValue={payment.zelle}
              key={`zelle-${payment.zelle}`}
              placeholder="you@bank-email.com"
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== payment.zelle) savePayment({ zelle: v }); }}
            />
          </label>
          <label className="field"><span>{c.venmo}</span>
            <input
              defaultValue={payment.venmo}
              key={`venmo-${payment.venmo}`}
              placeholder="@Your-Handle"
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== payment.venmo) savePayment({ venmo: v }); }}
            />
          </label>
          <label className="field field-wide"><span>{c.note}</span>
            <input
              defaultValue={payment.note}
              key={`paynote-${payment.note}`}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== payment.note) savePayment({ note: v }); }}
            />
          </label>
        </div>
      </div>

      <div className="con-section-label"><h3>{c.depositTitle}</h3></div>
      <div className="con-table-panel con-narrow" style={{ padding: "16px 18px 18px" }}>
        <label className="field" style={{ maxWidth: 220 }}><span>{c.depositLbl}</span>
          <input
            type="number" min="10" max="90" step="5"
            defaultValue={Math.round(settings.opsDepositRate * 100)}
            key={settings.opsDepositRate}
            onBlur={(e) => saveDepositRate(e.target.value)}
          />
        </label>
        <p className="con-note">{c.depositHint}</p>
      </div>
    </>
  );
}
