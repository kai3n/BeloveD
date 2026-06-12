import { useState } from "react";
import { useAuth } from "../../lib/auth.jsx";
import { getCatalogItem, listClaims, listWarrantyRegs, submitClaim } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

const DEFECTS = ["certMismatch", "setting", "stoneLoss", "casting", "plating"];

export default function DealerClaims() {
  useDBVersion();
  const { p, locale } = useLocale();
  const c = p.dealer.claims;
  const { user } = useAuth();
  const claims = listClaims({ dealerId: user.id });
  const regs = listWarrantyRegs({ dealerId: user.id });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ regId: regs[0]?.id || "", defectType: "setting", desc: "" });
  const [photos, setPhotos] = useState([]);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));

  function submit(e) {
    e.preventDefault();
    submitClaim(user.id, { ...form, photos });
    setOpen(false);
    setPhotos([]);
    setForm((f) => ({ ...f, desc: "" }));
  }

  return (
    <>
      <p className="form-hint" style={{ marginBottom: 14 }}>{c.sub}</p>
      <button className="button secondary small" style={{ marginBottom: 18 }} onClick={() => setOpen(!open)}>{c.newClaim}</button>

      {open && (
        <form className="panel form-stack" onSubmit={submit}>
          <label className="field"><span>{c.reg}</span>
            <select value={form.regId} onChange={(e) => setF({ regId: e.target.value })}>
              {regs.map((r) => <option key={r.id} value={r.id}>{r.buyerName} · {pickI18n(getCatalogItem(r.itemId)?.name, locale)} · {r.soldAt}</option>)}
            </select></label>
          <label className="field"><span>{c.defect}</span>
            <select value={form.defectType} onChange={(e) => setF({ defectType: e.target.value })}>
              {DEFECTS.map((dt) => <option key={dt} value={dt}>{c.types[dt]}</option>)}
            </select></label>
          <label className="field"><span>{c.desc}</span>
            <textarea value={form.desc} onChange={(e) => setF({ desc: e.target.value })} /></label>
          <p className="form-hint">{c.photos}</p>
          <MediaPicker value={photos} onChange={setPhotos} />
          <button className="button primary" type="submit" disabled={!form.regId || photos.length === 0}>{c.submit}</button>
        </form>
      )}

      {claims.length === 0 ? <EmptyNote>{c.empty}</EmptyNote> : claims.map((cl) => {
        const reg = regs.find((r) => r.id === cl.regId);
        return (
          <article className="proposal-card" key={cl.id}>
            <div className="proposal-head">
              <strong>{cl.id} · {c.types[cl.defectType]}</strong>
              <span className={`status-badge cst-${cl.status}`}>{c.st[cl.status]}</span>
            </div>
            <p className="form-hint">
              {reg && <>{reg.buyerName} · {pickI18n(getCatalogItem(reg.itemId)?.name, locale)} · {reg.soldAt}</>}
            </p>
            {cl.desc && <p className="proposal-comment">{cl.desc}</p>}
            {cl.photos.length > 0 && (
              <div className="proposal-media" style={{ marginTop: 10 }}>
                {cl.photos.map((m, i) => <MediaThumb key={i} media={typeof m === "string" ? { kind: "image", src: m } : m} alt={c.photos} />)}
              </div>
            )}
            {cl.status === "AWAITING_RETURN" && <div className="feedback-note">{c.returnNote}</div>}
            {cl.adminNote && <div className="feedback-note">{cl.adminNote}</div>}
            {cl.salvage && <p className="form-hint" style={{ marginTop: 8 }}>{p.adminDealer.claims.credit}: {usd(cl.salvage.creditUsd)}</p>}
          </article>
        );
      })}
    </>
  );
}
