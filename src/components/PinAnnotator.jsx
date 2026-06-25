import { useState } from "react";
import { useLocale } from "../i18n.jsx";
import { getDB, listChips } from "../lib/store.js";
import { CHIP_PARTS, formatAnnotation } from "../lib/chips.js";
import { LuxurySelect, withBase } from "./ui.jsx";

// 핀+칩 주석 — 의도 입력과 수정 요청이 같은 문법을 쓴다.
// 자유 텍스트 입력 없음: part/chipKey/value(mm)만. mp4에는 핀을 찍지 않는다(이미지 전용).
export default function PinAnnotator({ src, annotations, onChange, readOnly = false }) {
  const { p, locale } = useLocale();
  const t = p.visual;
  const [active, setActive] = useState(null);
  const catalog = getDB().chipCatalog;
  const isVideo = src.endsWith(".mp4");

  function addPin(e) {
    if (readOnly || isVideo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const pinId = (annotations[annotations.length - 1]?.pinId || 0) + 1;
    onChange([...annotations, { pinId, x, y, part: "band", chipKey: "", value: null }]);
    setActive(pinId);
  }
  const update = (pinId, patch) => onChange(annotations.map((a) => (a.pinId === pinId ? { ...a, ...patch } : a)));
  const remove = (pinId) => { onChange(annotations.filter((a) => a.pinId !== pinId)); setActive(null); };

  return (
    <div className="form-stack">
      <div className={`pin-canvas ${readOnly || isVideo ? "" : "is-editable"}`} onClick={addPin}>
        {isVideo
          ? <video src={withBase(src)} muted loop autoPlay playsInline />
          : <img src={withBase(src)} alt="" />}
        {annotations.map((a) => (
          <button type="button" key={a.pinId} className={`pin-dot ${active === a.pinId ? "is-active" : ""}`}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            onClick={(e) => { e.stopPropagation(); if (!readOnly) setActive(a.pinId); }}>
            {a.pinId}
          </button>
        ))}
      </div>
      {!readOnly && !isVideo && <p className="form-hint">{t.pinHint}</p>}
      {annotations.map((a) => {
        const chip = catalog.find((c) => c.key === a.chipKey);
        if (readOnly || active !== a.pinId) {
          return <p key={a.pinId} className="form-hint"><span className="pin-tag">{a.pinId}</span>{formatAnnotation(a, catalog, locale, t.parts)}</p>;
        }
        return (
          <div key={a.pinId} className="pin-editor form-stack">
            <div className="row-actions">
              <strong><span className="pin-tag">{a.pinId}</span></strong>
              <div className="pin-part-select">
                <LuxurySelect
                  value={a.part}
                  ariaLabel={t.pinHint}
                  options={CHIP_PARTS.map((pt) => ({ value: pt, label: t.parts[pt] }))}
                  onChange={(value) => update(a.pinId, { part: value, chipKey: "", value: null })}
                />
              </div>
              <button type="button" className="chip" onClick={() => remove(a.pinId)}>✕ {t.removePin}</button>
            </div>
            <div className="row-actions" style={{ flexWrap: "wrap" }}>
              {listChips({ part: a.part }).map((c) => (
                <button type="button" key={c.key} className={`chip ${a.chipKey === c.key ? "is-active" : ""}`}
                  onClick={() => update(a.pinId, { chipKey: c.key, value: null })}>
                  {c.labels[locale] ?? c.labels.en}
                </button>
              ))}
            </div>
            {chip?.valueType === "mm" && (
              <label className="field"><span>{t.addValue}</span>
                <input type="number" step="0.1" value={a.value ?? ""}
                  onChange={(e) => update(a.pinId, { value: Number(e.target.value) || null })} /></label>
            )}
          </div>
        );
      })}
    </div>
  );
}
