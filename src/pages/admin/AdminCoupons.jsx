// 쿠폰 콘솔 — settings.coupons(이벤트성 할인 코드)를 관리한다.
// 등록/삭제 즉시 서버 settings로 write-through → 모든 고객 브라우저가 부팅 시 하이드레이션.
// 위저드 예상 견적과 로컬 데모 견적(createQuote)이 이 카탈로그를 실시간으로 읽는다.
import { useState } from "react";
import { addCoupon, getSettings, listCoupons, removeCoupon, updateSettings } from "../../lib/store.js";
import { normalizeCouponCode } from "../../lib/coupons.js";
import { useDBVersion } from "../../lib/useDB.js";
import { useLocale } from "../../i18n.jsx";
import { ConsoleHead } from "./console.jsx";
import { pushSettingsToServer } from "../../lib/serverSync.js";

const COPY = {
  en: {
    title: "Coupons",
    sub: "Event discount codes honored in the wizard estimate and final proposal. Changes reach every customer immediately.",
    code: "Code", discount: "Discount", expires: "Expires", status: "Status", actions: "",
    addTitle: "New event coupon", pct: "Discount (%)", expiry: "Expiry (optional)", add: "Add",
    active: "Active", expired: "Expired", never: "—", atCost: "At-cost (0% margin)",
    added: (c) => `${c} added`, removed: (c) => `${c} removed`,
    dupe: "Code already exists or value is out of range (1–99)",
    confirmRemove: (c) => `Delete coupon ${c}?`,
    bannerTitle: "Sale banner", bannerSub: "Sitewide bar above the header. Copy per language — empty falls back to EN.",
    bannerOn: "Show banner", bannerCode: "Code shown", bannerSave: "Save banner", bannerSaved: "Banner saved",
    bannerCodeWarn: "Not in the coupon catalog below — customers can't redeem it.",
  },
  ko: {
    title: "쿠폰",
    sub: "위저드 예상 견적과 확정 제안에 반영되는 이벤트성 할인 코드입니다. 변경 즉시 모든 고객에게 적용됩니다.",
    code: "코드", discount: "할인", expires: "만료일", status: "상태", actions: "",
    addTitle: "새 이벤트 쿠폰", pct: "할인율 (%)", expiry: "만료일 (선택)", add: "등록",
    active: "활성", expired: "만료됨", never: "—", atCost: "원가 (마진 0%)",
    added: (c) => `${c} 등록됨`, removed: (c) => `${c} 삭제됨`,
    dupe: "이미 있는 코드거나 할인율 범위(1–99)를 벗어났어요",
    confirmRemove: (c) => `쿠폰 ${c}을(를) 삭제할까요?`,
    bannerTitle: "세일 배너", bannerSub: "헤더 위 전 페이지 배너입니다. 언어별 문구 — 비우면 영어로 폴백됩니다.",
    bannerOn: "배너 표시", bannerCode: "표시 코드", bannerSave: "배너 저장", bannerSaved: "배너 저장됨",
    bannerCodeWarn: "아래 쿠폰 카탈로그에 없는 코드예요 — 고객이 적용받을 수 없습니다.",
  },
  zh: {
    title: "优惠码",
    sub: "用于向导预估与正式方案的活动折扣码。更改即时对所有客户生效。",
    code: "代码", discount: "折扣", expires: "到期日", status: "状态", actions: "",
    addTitle: "新建活动优惠码", pct: "折扣率 (%)", expiry: "到期日（可选）", add: "添加",
    active: "有效", expired: "已过期", never: "—", atCost: "成本价（0% 毛利）",
    added: (c) => `已添加 ${c}`, removed: (c) => `已删除 ${c}`,
    dupe: "代码已存在或折扣率超出范围 (1–99)",
    confirmRemove: (c) => `删除优惠码 ${c}？`,
    bannerTitle: "促销横幅", bannerSub: "页头上方全站横幅。按语言填写文案——留空则回退到英文。",
    bannerOn: "显示横幅", bannerCode: "展示代码", bannerSave: "保存横幅", bannerSaved: "已保存",
    bannerCodeWarn: "下方优惠码目录中没有该代码——客户无法使用。",
  },
  es: {
    title: "Cupones",
    sub: "Códigos de descuento para eventos, aplicados en la estimación del asistente y la propuesta final. Los cambios llegan a todos los clientes al instante.",
    code: "Código", discount: "Descuento", expires: "Caduca", status: "Estado", actions: "",
    addTitle: "Nuevo cupón de evento", pct: "Descuento (%)", expiry: "Caducidad (opcional)", add: "Añadir",
    active: "Activo", expired: "Caducado", never: "—", atCost: "A coste (0% margen)",
    added: (c) => `${c} añadido`, removed: (c) => `${c} eliminado`,
    dupe: "El código ya existe o el valor está fuera de rango (1–99)",
    confirmRemove: (c) => `¿Eliminar el cupón ${c}?`,
    bannerTitle: "Banner de oferta", bannerSub: "Barra en todo el sitio sobre la cabecera. Texto por idioma — vacío usa el inglés.",
    bannerOn: "Mostrar banner", bannerCode: "Código mostrado", bannerSave: "Guardar banner", bannerSaved: "Banner guardado",
    bannerCodeWarn: "No está en el catálogo de cupones — los clientes no podrán canjearlo.",
  },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AdminCoupons() {
  useDBVersion();
  const { p, locale } = useLocale();
  const c = COPY[locale] || COPY.en;
  const coupons = listCoupons();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  // 세일 배너 드래프트 — 저장 버튼을 눌러야 로컬+서버에 반영된다
  const BANNER_LOCALES = ["en", "ko", "zh", "es"];
  const [bannerDraft, setBannerDraft] = useState(() => {
    const saved = getSettings().saleBanner || {};
    return {
      enabled: Boolean(saved.enabled),
      code: saved.code || "",
      copy: { en: "", ko: "", zh: "", es: "", ...saved.copy },
    };
  });
  const bannerCodeUnknown = Boolean(normalizeCouponCode(bannerDraft.code))
    && !coupons.some((cp) => cp.code === normalizeCouponCode(bannerDraft.code));

  function saveBanner() {
    const next = { ...bannerDraft, code: normalizeCouponCode(bannerDraft.code) };
    updateSettings({ saleBanner: next });
    pushSettingsToServer({ saleBanner: next });
    setNotice(c.bannerSaved);
  }

  function syncServer() {
    pushSettingsToServer({ coupons: listCoupons() });
  }

  function submitAdd() {
    setError("");
    const coupon = addCoupon({ code, value: pct, expiresAt: expiresAt || null });
    if (!coupon) { setError(c.dupe); return; }
    syncServer();
    setNotice(c.added(coupon.code));
    setCode(""); setPct(""); setExpiresAt("");
  }

  function submitRemove(target) {
    if (!window.confirm(c.confirmRemove(target))) return;
    if (removeCoupon(target)) {
      syncServer();
      setNotice(c.removed(target));
    }
  }

  const discountLabel = (coupon) => (coupon.kind === "margin0" ? c.atCost : `−${coupon.value}%`);

  return (
    <>
      <ConsoleHead kicker={p.opsA.menu.coupons} title={c.title} sub={c.sub}>
        {notice && <span className="con-saved-flash" role="status">{notice}</span>}
      </ConsoleHead>

      {/* 세일 배너 — 쿠폰과 한 캠페인 묶음이라 이 페이지에서 관리 */}
      <section className="con-table-panel con-narrow" style={{ padding: 18, display: "grid", gap: 12 }}>
        <div className="con-adjust" style={{ margin: 0 }}>
          <span className="con-adjust-label">{c.bannerTitle}</span>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox" checked={bannerDraft.enabled} style={{ width: "auto" }}
              onChange={(e) => setBannerDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span>{c.bannerOn}</span>
          </label>
          <label className="field"><span>{c.bannerCode}</span>
            <input
              value={bannerDraft.code} maxLength={20} placeholder="LAUNCH25"
              onChange={(e) => setBannerDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
            />
          </label>
          <button className="button primary small" type="button" onClick={saveBanner}>{c.bannerSave}</button>
        </div>
        {bannerCodeUnknown && <p className="form-error" style={{ margin: 0 }}>{c.bannerCodeWarn}</p>}
        <p className="con-note" style={{ margin: 0 }}>{c.bannerSub}</p>
        {BANNER_LOCALES.map((code) => (
          <label key={code} className="field"><span>{code.toUpperCase()}</span>
            <input
              value={bannerDraft.copy[code]}
              onChange={(e) => setBannerDraft((d) => ({ ...d, copy: { ...d.copy, [code]: e.target.value } }))}
            />
          </label>
        ))}
      </section>

      <div className="con-adjust con-narrow">
        <span className="con-adjust-label">{c.addTitle}</span>
        <label className="field"><span>{c.code}</span>
          <input
            value={code} placeholder="SUMMER20" maxLength={20}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }}
          />
        </label>
        <label className="field field-pct"><span>{c.pct}</span>
          <input
            type="number" min="1" max="99" step="1" value={pct} placeholder="10"
            onChange={(e) => setPct(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); }}
          />
        </label>
        <label className="field"><span>{c.expiry}</span>
          <input type="date" value={expiresAt} min={todayStr()} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
        <button className="button primary small" type="button" disabled={!code.trim() || !Number(pct)} onClick={submitAdd}>
          {c.add}
        </button>
      </div>
      {error && <p className="form-error con-narrow">{error}</p>}

      <div className="con-table-panel con-narrow">
        <table className="data-table">
          <thead>
            <tr><th>{c.code}</th><th>{c.discount}</th><th>{c.expires}</th><th>{c.status}</th><th>{c.actions}</th></tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => {
              const expired = Boolean(coupon.expiresAt && coupon.expiresAt < todayStr());
              return (
                <tr key={coupon.code}>
                  <th scope="row">{coupon.code}</th>
                  <td>{discountLabel(coupon)}</td>
                  <td>{coupon.expiresAt || c.never}</td>
                  <td>
                    <span className={`status-badge ${expired ? "st-CANCELLED" : "st-COMPLETED"}`}>
                      {expired ? c.expired : c.active}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="button secondary small" type="button" onClick={() => submitRemove(coupon.code)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
