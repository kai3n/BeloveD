import { useMemo, useState } from "react";
import {
  deleteOpsStyle,
  deleteStyleSpec,
  listOpsStyles,
  listStyleSpecs,
  saveOpsStyle,
  saveStyleSpec,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

const FALLBACK_MEDIA = "/assets/lab-diamond-tweezers.webp";

const emptyDraft = {
  id: "",
  nameEn: "",
  nameKo: "",
  nameZh: "",
  nameEs: "",
  category: "ring",
  estWeightG: "",
  laborUsd: "",
  leadDays: "",
  published: true,
  availableForSale: true,
  media: [],
};

function mediaFromStyle(style) {
  if (Array.isArray(style.media) && style.media.length > 0) return style.media;
  if (style.coverImage) return [{ kind: style.coverImage.endsWith(".mp4") ? "video" : "image", src: style.coverImage }];
  return [];
}

function draftFromStyle(style) {
  return {
    id: style.id,
    nameEn: style.name?.en || pickI18n(style.name, "en"),
    nameKo: style.name?.ko || pickI18n(style.name, "ko"),
    nameZh: style.name?.zh || pickI18n(style.name, "zh"),
    nameEs: style.name?.es || pickI18n(style.name, "es"),
    category: style.category || "ring",
    estWeightG: String(style.estWeightG ?? ""),
    laborUsd: String(style.laborUsd ?? ""),
    leadDays: String(style.leadDays ?? ""),
    published: Boolean(style.published),
    availableForSale: Boolean(style.availableForSale),
    media: mediaFromStyle(style),
  };
}

function styleFromDraft(draft) {
  const media = draft.media || [];
  return {
    ...(draft.id ? { id: draft.id } : {}),
    name: {
      en: draft.nameEn || draft.nameKo || draft.nameZh || draft.nameEs,
      ko: draft.nameKo || draft.nameEn || draft.nameZh || draft.nameEs,
      zh: draft.nameZh || draft.nameEn || draft.nameKo || draft.nameEs,
      es: draft.nameEs || draft.nameEn || draft.nameKo || draft.nameZh,
    },
    category: draft.category,
    coverImage: media[0]?.src || FALLBACK_MEDIA,
    media,
    mediaComplete: media.length > 0,
    metalOptions: ["18kw", "18ky", "pt"],
    estWeightG: Number(draft.estWeightG) || 0,
    laborUsd: Number(draft.laborUsd) || 0,
    leadDays: Number(draft.leadDays) || 0,
    published: draft.published,
    availableForSale: draft.availableForSale,
  };
}

export default function AdminOpsStyles() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.opsA.styles;
  const styles = listOpsStyles();
  const specs = listStyleSpecs();
  const [draft, setDraft] = useState(emptyDraft);
  const [sp, setSp] = useState({ styleId: "", metal: "18kw", size: "", centerStoneSpec: "", estWeightG: "", variancePct: 6, laborUsd: "", materialsUsd: "" });
  const selected = useMemo(() => styles.find((style) => style.id === draft.id) || null, [draft.id, styles]);
  const isEditing = Boolean(draft.id);

  function setDraftField(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function submitStyle(e) {
    e.preventDefault();
    const saved = saveOpsStyle(styleFromDraft(draft));
    setDraft(draftFromStyle(saved));
  }

  function removeStyle(style) {
    if (!confirm(`Delete ${style.id}?`)) return;
    deleteOpsStyle(style.id);
    if (draft.id === style.id) setDraft(emptyDraft);
  }

  function submitSpec() {
    saveStyleSpec({
      ...sp,
      estWeightG: Number(sp.estWeightG),
      variancePct: Number(sp.variancePct),
      laborUsd: Number(sp.laborUsd),
      materialsUsd: Number(sp.materialsUsd) || 0,
    });
    setSp({ styleId: sp.styleId, metal: "18kw", size: "", centerStoneSpec: "", estWeightG: "", variancePct: 6, laborUsd: "", materialsUsd: "" });
  }

  return (
    <>
      <div className="admin-editor-grid">
        <div className="panel" style={{ overflowX: "auto" }}>
          <div className="admin-panel-head">
            <div>
              <h3>{t.title} ({styles.length})</h3>
              <p className="form-hint">Add, edit, publish, delete, and manage sample photos/videos.</p>
            </div>
            <button className="button secondary small" type="button" onClick={() => setDraft(emptyDraft)}>
              {p.common.add}
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Media</th>
                <th>ID</th>
                <th>{p.admin.tpl.name}</th>
                <th>{p.admin.tpl.category}</th>
                <th>{t.estW}</th>
                <th>{t.labor}</th>
                <th>{t.leadDays}</th>
                <th>{t.available}</th>
                <th>{t.published}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {styles.map((st) => (
                <tr key={st.id}>
                  <td style={{ width: 78 }}>
                    <div className="admin-media-mini">
                      <MediaThumb media={mediaFromStyle(st)[0] || { kind: "image", src: FALLBACK_MEDIA }} alt={pickI18n(st.name, locale)} />
                    </div>
                  </td>
                  <td>{st.id}</td>
                  <td>{pickI18n(st.name, locale)}</td>
                  <td>{p.opsCategories[st.category] || st.category}</td>
                  <td>{st.estWeightG}g</td>
                  <td>{usd(st.laborUsd)}</td>
                  <td>{st.leadDays}</td>
                  <td>
                    <button className={`chip ${st.availableForSale ? "is-active" : ""}`} onClick={() => saveOpsStyle({ id: st.id, availableForSale: !st.availableForSale })}>
                      {st.availableForSale ? t.available : p.admin.dia.priv}
                    </button>
                  </td>
                  <td>
                    <button className={`chip ${st.published ? "is-active" : ""}`} onClick={() => saveOpsStyle({ id: st.id, published: !st.published })}>
                      {st.published ? t.published : p.admin.dia.priv}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button small" type="button" onClick={() => setDraft(draftFromStyle(st))}>{p.common.view}</button>
                      <button className="button danger small" type="button" onClick={() => removeStyle(st)}>{p.common.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="panel form-stack admin-edit-panel" onSubmit={submitStyle}>
          <div className="admin-panel-head">
            <div>
              <h3>{isEditing ? `${t.save} — ${draft.id}` : t.addStyle}</h3>
              <p className="form-hint">{selected ? `${(selected.media || []).length} media files` : "Images and videos are supported."}</p>
            </div>
            {isEditing && (
              <button className="button small" type="button" onClick={() => setDraft(emptyDraft)}>
                {p.common.new}
              </button>
            )}
          </div>

          <div className="filter-grid admin-locale-grid">
            <label className="field"><span>Name EN</span><input value={draft.nameEn} onChange={(e) => setDraftField({ nameEn: e.target.value })} required /></label>
            <label className="field"><span>Name KO</span><input value={draft.nameKo} onChange={(e) => setDraftField({ nameKo: e.target.value })} /></label>
            <label className="field"><span>Name ZH</span><input value={draft.nameZh} onChange={(e) => setDraftField({ nameZh: e.target.value })} /></label>
            <label className="field"><span>Name ES</span><input value={draft.nameEs} onChange={(e) => setDraftField({ nameEs: e.target.value })} /></label>
          </div>

          <div className="filter-grid">
            <label className="field"><span>{p.admin.tpl.category}</span>
              <select value={draft.category} onChange={(e) => setDraftField({ category: e.target.value })}>
                {Object.entries(p.opsCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>{t.estW}</span><input type="number" step="0.1" value={draft.estWeightG} onChange={(e) => setDraftField({ estWeightG: e.target.value })} required /></label>
            <label className="field"><span>{t.labor}</span><input type="number" value={draft.laborUsd} onChange={(e) => setDraftField({ laborUsd: e.target.value })} required /></label>
            <label className="field"><span>{t.leadDays}</span><input type="number" value={draft.leadDays} onChange={(e) => setDraftField({ leadDays: e.target.value })} required /></label>
          </div>

          <div className="row-actions">
            <label className={`chip ${draft.availableForSale ? "is-active" : ""}`}>
              <input type="checkbox" checked={draft.availableForSale} onChange={(e) => setDraftField({ availableForSale: e.target.checked })} hidden />
              {t.available}
            </label>
            <label className={`chip ${draft.published ? "is-active" : ""}`}>
              <input type="checkbox" checked={draft.published} onChange={(e) => setDraftField({ published: e.target.checked })} hidden />
              {t.published}
            </label>
          </div>

          <label className="field"><span>{t.media}</span></label>
          <MediaPicker value={draft.media} onChange={(media) => setDraftField({ media })} />
          <button className="button primary" type="submit">{isEditing ? t.save : p.common.add}</button>
        </form>
      </div>

      <div className="panel form-stack">
        <h3>{t.specs} ({specs.length})</h3>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Style</th><th>{p.intake.metal}</th><th>Size</th><th>{t.combo}</th><th>{t.estW}</th><th>{t.variance}</th><th>{t.labor}</th><th>{t.materials}</th><th /></tr>
            </thead>
            <tbody>
              {specs.map((s) => (
                <tr key={s.id}>
                  <td>{s.styleId}</td>
                  <td>{p.opsMetals[s.metal] || s.metal}</td>
                  <td>{s.size || "—"}</td>
                  <td>{s.centerStoneSpec || "—"}</td>
                  <td>{s.estWeightG}g</td>
                  <td>±{s.variancePct}%</td>
                  <td>{usd(s.laborUsd)}</td>
                  <td>{usd(s.materialsUsd || 0)}</td>
                  <td><button className="button danger small" type="button" onClick={() => deleteStyleSpec(s.id)}>{p.common.delete}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: 10 }}>{t.newSpec}</h3>
        <div className="filter-grid">
          <label className="field"><span>Style</span>
            <select value={sp.styleId} onChange={(e) => setSp({ ...sp, styleId: e.target.value })}>
              <option value="" disabled>—</option>
              {styles.map((st) => <option key={st.id} value={st.id}>{st.id}</option>)}
            </select></label>
          <label className="field"><span>{p.intake.metal}</span>
            <select value={sp.metal} onChange={(e) => setSp({ ...sp, metal: e.target.value })}>
              {Object.entries(p.opsMetals).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="field"><span>Size</span><input value={sp.size} onChange={(e) => setSp({ ...sp, size: e.target.value })} /></label>
          <label className="field"><span>{t.combo}</span><input value={sp.centerStoneSpec} onChange={(e) => setSp({ ...sp, centerStoneSpec: e.target.value })} /></label>
          <label className="field"><span>{t.estW}</span><input type="number" step="0.1" value={sp.estWeightG} onChange={(e) => setSp({ ...sp, estWeightG: e.target.value })} /></label>
          <label className="field"><span>{t.variance}</span><input type="number" value={sp.variancePct} onChange={(e) => setSp({ ...sp, variancePct: e.target.value })} /></label>
          <label className="field"><span>{t.labor}</span><input type="number" value={sp.laborUsd} onChange={(e) => setSp({ ...sp, laborUsd: e.target.value })} /></label>
          <label className="field"><span>{t.materials}</span><input type="number" value={sp.materialsUsd} onChange={(e) => setSp({ ...sp, materialsUsd: e.target.value })} /></label>
        </div>
        <button className="button secondary small" type="button" disabled={!sp.styleId} onClick={submitSpec}>
          {p.common.add}
        </button>
      </div>
    </>
  );
}
