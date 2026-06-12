import { useState } from "react";
import { quarterKey } from "../../lib/dealer.js";
import {
  adjudicateClaim, getCatalogItem, getUser, listClaims, listSalvage,
  listWarrantyRegs, markClaimReplaced, receiveClaimReturn,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

function ReturnForm({ claim, labels }) {
  const [grams, setGrams] = useState("");
  const [toPool, setToPool] = useState(true);
  return (
    <div className="row-actions" style={{ marginTop: 12 }}>
      <input type="number" step="0.1" placeholder={labels.goldGrams} value={grams} onChange={(e) => setGrams(e.target.value)}
        style={{ width: 150, background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "9px 10px" }} />
      <button type="button" className={`chip ${toPool ? "is-active" : ""}`} onClick={() => setToPool(!toPool)}>{labels.stonePool}</button>
      <button className="button primary small" disabled={!grams}
        onClick={() => receiveClaimReturn(claim.id, { goldGrams: Number(grams), stoneToPool: toPool })}>
        {labels.receive}
      </button>
    </div>
  );
}

function Adjudicate({ claim, labels }) {
  const [note, setNote] = useState("");
  return (
    <div className="form-stack" style={{ marginTop: 12 }}>
      <label className="field"><span>{labels.note}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="row-actions">
        <button className="button primary small" onClick={() => adjudicateClaim(claim.id, "approve", note)}>{labels.approve}</button>
        <button className="button danger small" onClick={() => adjudicateClaim(claim.id, "deny", note)}>{labels.deny}</button>
      </div>
    </div>
  );
}

export default function AdminClaims() {
  useDBVersion();
  const { p, locale } = useLocale();
  const a = p.adminDealer.claims;
  const cst = p.dealer.claims.st;
  const types = p.dealer.claims.types;
  const claims = listClaims();
  const salvage = listSalvage();
  const regs = listWarrantyRegs();

  const byQuarter = {};
  for (const s of salvage) {
    const q = quarterKey(s.at);
    byQuarter[q] = byQuarter[q] || { g: 0, c: 0 };
    byQuarter[q].g += s.goldGrams;
    byQuarter[q].c += s.creditUsd;
  }

  return (
    <>
      {claims.length === 0 ? <EmptyNote>{p.dealer.claims.empty}</EmptyNote> : claims.map((cl) => {
        const reg = regs.find((r) => r.id === cl.regId);
        return (
          <article className="proposal-card" key={cl.id}>
            <div className="proposal-head">
              <strong>{cl.id} · {getUser(cl.dealerId)?.name} · {types[cl.defectType]}</strong>
              <span className={`status-badge cst-${cl.status}`}>{cst[cl.status]}</span>
            </div>
            {reg && (
              <p className="form-hint">
                {reg.buyerName} · {pickI18n(getCatalogItem(reg.itemId)?.name, locale)} · {reg.soldAt} → {reg.warrantyUntil}
              </p>
            )}
            {cl.desc && <p className="proposal-comment">{cl.desc}</p>}
            {cl.photos.length > 0 && (
              <>
                <p className="form-hint" style={{ margin: "10px 0 6px" }}>{a.photoEvidence}</p>
                <div className="proposal-media">
                  {cl.photos.map((m, i) => <MediaThumb key={i} media={typeof m === "string" ? { kind: "image", src: m } : m} alt={a.photoEvidence} />)}
                </div>
              </>
            )}
            {cl.adminNote && <div className="feedback-note">{cl.adminNote}</div>}
            {cl.salvage && (
              <p className="form-hint" style={{ marginTop: 8 }}>
                {a.goldGrams}: {cl.salvage.goldGrams}g · {a.credit}: {usd(cl.salvage.creditUsd)}{cl.salvage.stoneToPool ? ` · ${a.stonePool} ✓` : ""}
              </p>
            )}
            {cl.status === "SUBMITTED" && <Adjudicate claim={cl} labels={a} />}
            {cl.status === "AWAITING_RETURN" && <ReturnForm claim={cl} labels={a} />}
            {cl.status === "RETURN_RECEIVED" && (
              <button className="button primary small" style={{ marginTop: 12 }} onClick={() => markClaimReplaced(cl.id)}>{a.replaced}</button>
            )}
          </article>
        );
      })}

      <div className="panel" style={{ marginTop: 24 }}>
        <h3>{a.salvageTitle} ({salvage.length})</h3>
        {Object.keys(byQuarter).length === 0 ? <EmptyNote>—</EmptyNote> : (
          Object.entries(byQuarter).map(([q, v]) => (
            <p className="form-hint" key={q} style={{ fontSize: 13.5 }}>{a.quarterTotal(q, v.g.toFixed(1), usd(v.c))}</p>
          ))
        )}
      </div>
    </>
  );
}
