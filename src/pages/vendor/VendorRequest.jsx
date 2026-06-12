import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import {
  addProductionMedia, addProposal, anonymizeForVendor, getDiamond, getRequest,
  getTemplate, listFeedback, listProductionMedia, listProposals, transitionRequest,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb, StatusBadge, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

const UPLOADABLE = ["VENDOR_ASSIGNED", "REVISION_REQUESTED"];

export default function VendorRequest() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { id } = useParams();
  const { user } = useAuth();
  const raw = getRequest(id);
  const [media, setMedia] = useState([]);
  const [comment, setComment] = useState("");
  const [prodMedia, setProdMedia] = useState([]);

  if (!raw || raw.vendorId !== user.id) {
    return <div className="page"><EmptyNote>{p.vendor.notAssigned}</EmptyNote></div>;
  }
  const request = anonymizeForVendor(raw); // PII 제거 뷰
  const template = getTemplate(request.templateId);
  const diamond = request.diamondId ? getDiamond(request.diamondId) : null;
  const proposals = [...listProposals(request.id)].reverse();
  const production = listProductionMedia(request.id);

  function uploadProposal(e) {
    e.preventDefault();
    if (media.length === 0) return;
    addProposal(request.id, user.id, { media, comment });
    setMedia([]); setComment("");
  }
  function uploadProduction() {
    prodMedia.forEach((m) => addProductionMedia(request.id, m));
    setProdMedia([]);
  }

  return (
    <div className="page">
      <h1 className="page-title">{request.customerLabel}</h1>
      <p className="page-sub">{p.vendor.sub(user.name)} <StatusBadge status={request.status} /></p>

      <div className="panel">
        <h3>{p.vendor.specTitle}</h3>
        <table className="data-table"><tbody>
          <tr><th>{p.vendor.design}</th><td>{pickI18n(template?.name, locale)} — {pickI18n(template?.desc, locale)}</td></tr>
          <tr><th>{p.vendor.diamondRow}</th><td>{diamond ? `${p.shapes[diamond.shape]} ${diamond.carat.toFixed(1)}ct ${diamond.cut} ${diamond.color}/${diamond.clarity} ${diamond.certOrg}` : p.vendor.recommend}</td></tr>
          <tr><th>{p.vendor.metalRow}</th><td>{p.metals[request.details.metal] || request.details.metal}</td></tr>
          <tr><th>{p.vendor.sizeRow}</th><td>{request.details.size}</td></tr>
          {request.details.engraving && <tr><th>{p.vendor.engravingRow}</th><td>{request.details.engraving}</td></tr>}
          {request.details.budget && <tr><th>{p.vendor.budgetRow}</th><td>{usd(request.details.budget)}</td></tr>}
          {request.details.notes && <tr><th>{p.vendor.notesRow}</th><td>{request.details.notes}</td></tr>}
        </tbody></table>
      </div>

      {UPLOADABLE.includes(request.status) && (
        <form className="panel form-stack" onSubmit={uploadProposal}>
          <h3>{p.vendor.uploadTitle(proposals.length + 1)}</h3>
          <MediaPicker value={media} onChange={setMedia} />
          <label className="field"><span>{p.vendor.comment}</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} /></label>
          <button className="button primary" type="submit" disabled={media.length === 0}>{p.vendor.uploadBtn}</button>
        </form>
      )}

      {request.status === "DEPOSIT_PAID" && (
        <div className="panel">
          <h3>{p.vendor.startTitle}</h3>
          <p className="form-hint">{p.vendor.startHint}</p>
          <button className="button primary" style={{ marginTop: 12 }} onClick={() => transitionRequest(request.id, "IN_PRODUCTION", user)}>{p.vendor.startBtn}</button>
        </div>
      )}

      {request.status === "IN_PRODUCTION" && (
        <div className="panel form-stack">
          <h3>{p.vendor.progressTitle}</h3>
          <MediaPicker value={prodMedia} onChange={setProdMedia} />
          <div className="row-actions">
            <button className="button secondary small" disabled={prodMedia.length === 0} onClick={uploadProduction}>{p.vendor.progressUpload}</button>
            <button className="button primary small" onClick={() => transitionRequest(request.id, "QUALITY_CHECK", user)}>{p.vendor.qcRequest}</button>
          </div>
        </div>
      )}

      {production.length > 0 && (
        <div className="panel">
          <h3>{p.vendor.prodLog}</h3>
          <div className="proposal-media">
            {production.map((m) => <MediaThumb key={m.id} media={m} alt={p.vendor.prodLog} />)}
          </div>
        </div>
      )}

      <h3 style={{ margin: "36px 0 14px" }}>{p.vendor.myProposals}</h3>
      {proposals.length === 0 && <EmptyNote>{p.vendor.noProposals}</EmptyNote>}
      {proposals.map((prop) => (
        <article className="proposal-card" key={prop.id}>
          <div className="proposal-head">
            <strong>{p.request.proposalV(prop.version)}</strong>
            <span className="form-hint">{prop.createdAt.slice(0, 10)}</span>
          </div>
          <div className="proposal-media">
            {prop.media.map((m, i) => <MediaThumb key={i} media={m} alt={p.request.proposalV(prop.version)} />)}
          </div>
          {prop.comment && <p className="proposal-comment">{prop.comment}</p>}
          {listFeedback(prop.id).map((f) => (
            <div className="feedback-note" key={f.id}>
              {p.vendor.fb} — {f.decision === "confirm"
                ? p.vendor.fbConfirmed
                : p.vendor.fbRevise(f.choices.map((c) => p.request.choices[c] || c).join(", "))}
              {f.comment && ` · ${f.comment}`}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
