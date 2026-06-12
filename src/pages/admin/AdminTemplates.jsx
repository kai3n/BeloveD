import { useState } from "react";
import { listTemplates, saveTemplate } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

const emptyForm = { name: "", category: "ring", desc: "", basePriceUsd: "" };

export default function AdminTemplates() {
  useDBVersion();
  const { p, locale } = useLocale();
  const templates = listTemplates({ includeHidden: true });
  const [form, setForm] = useState(emptyForm);
  const [media, setMedia] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function addTemplate(e) {
    e.preventDefault();
    // 어드민이 입력한 텍스트는 4개 언어 공통으로 저장 (추후 언어별 현지화 가능)
    saveTemplate({
      name: { ko: form.name, en: form.name, zh: form.name, es: form.name },
      desc: { ko: form.desc, en: form.desc, zh: form.desc, es: form.desc },
      category: form.category, basePriceUsd: Number(form.basePriceUsd) || 0, media,
    });
    setForm(emptyForm); setMedia([]);
  }

  return (
    <>
      <div className="panel" style={{ overflowX: "auto" }}>
        <h3>{p.admin.tpl.title} ({templates.length})</h3>
        <table className="data-table">
          <thead><tr><th>{p.admin.tpl.name}</th><th>{p.admin.tpl.category}</th><th>{p.admin.tpl.basePrice}</th><th>{p.admin.tpl.visibleCol}</th></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{pickI18n(t.name, locale)}</td>
                <td>{p.categories[t.category]}</td>
                <td>{usd(t.basePriceUsd)}</td>
                <td>
                  <button className={`chip ${t.visible ? "is-active" : ""}`} onClick={() => saveTemplate({ id: t.id, visible: !t.visible })}>
                    {t.visible ? p.admin.tpl.pub : p.admin.tpl.priv}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form-stack" onSubmit={addTemplate}>
        <h3>{p.admin.tpl.newTitle}</h3>
        <label className="field"><span>{p.admin.tpl.name}</span><input value={form.name} onChange={(e) => setF({ name: e.target.value })} required /></label>
        <p className="form-hint">{p.admin.tpl.nameHint}</p>
        <label className="field"><span>{p.admin.tpl.category}</span>
          <select value={form.category} onChange={(e) => setF({ category: e.target.value })}>
            {Object.entries(p.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field"><span>{p.admin.tpl.desc}</span><textarea value={form.desc} onChange={(e) => setF({ desc: e.target.value })} /></label>
        <label className="field"><span>{p.admin.tpl.basePrice}</span><input type="number" step="10" value={form.basePriceUsd} onChange={(e) => setF({ basePriceUsd: e.target.value })} /></label>
        <MediaPicker value={media} onChange={setMedia} />
        <button className="button primary" type="submit" disabled={!form.name}>{p.admin.tpl.addBtn}</button>
      </form>
    </>
  );
}
