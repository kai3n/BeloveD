import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { canTransition } from "../lib/statusMachine.js";
import {
  addFeedback, getDiamond, getOrderByRequest, getRequest, getSettings, getTemplate,
  listFeedback, listProductionMedia, listProposals, payOrder, transitionRequest,
} from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote, MediaThumb, StatusBadge, Stepper, won } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

const REVISION_CHOICE_KEYS = ["size", "stone", "band", "color", "engraving"];

function FeedbackForm({ proposal, actor }) {
  const { p } = useLocale();
  const [decision, setDecision] = useState("confirm");
  const [choices, setChoices] = useState([]);
  const [comment, setComment] = useState("");

  function toggle(choice) {
    setChoices((c) => (c.includes(choice) ? c.filter((x) => x !== choice) : [...c, choice]));
  }
  function submit(e) {
    e.preventDefault();
    addFeedback(proposal.id, { decision, choices, comment }, actor);
  }

  return (
    <form className="form-stack" style={{ marginTop: 18 }} onSubmit={submit}>
      <div className="chip-row">
        <button type="button" className={`chip ${decision === "confirm" ? "is-active" : ""}`} onClick={() => setDecision("confirm")}>{p.request.confirmChip}</button>
        <button type="button" className={`chip ${decision === "revise" ? "is-active" : ""}`} onClick={() => setDecision("revise")}>{p.request.reviseChip}</button>
      </div>
      {decision === "revise" && (
        <>
          <div className="chip-row">
            {REVISION_CHOICE_KEYS.map((c) => (
              <button type="button" key={c} className={`chip ${choices.includes(c) ? "is-active" : ""}`} onClick={() => toggle(c)}>{p.request.choices[c]}</button>
            ))}
          </div>
          <label className="field"><span>{p.request.detailReq}</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        </>
      )}
      <button className="button primary" type="submit">
        {decision === "confirm" ? p.request.confirmBtn : p.request.reviseBtn}
      </button>
    </form>
  );
}

export default function RequestDetail() {
  useDBVersion();
  const { p, locale } = useLocale();
  const { id } = useParams();
  const { user } = useAuth();
  const request = getRequest(id);

  if (!request || request.customerId !== user.id) {
    return <div className="page"><EmptyNote>{p.request.notFound}</EmptyNote></div>;
  }

  const template = getTemplate(request.templateId);
  const diamond = request.diamondId ? getDiamond(request.diamondId) : null;
  const proposals = [...listProposals(request.id)].reverse(); // 최신 먼저
  const order = getOrderByRequest(request.id);
  const settings = getSettings();
  const productionMedia = listProductionMedia(request.id);
  const stages = settings.shippingStages.map((s) => ({ key: s, label: p.stages[s] || s }));
  const stageIndex = order?.shippingStage ? settings.shippingStages.indexOf(order.shippingStage) : -1;
  const latest = proposals[0];

  return (
    <div className="page">
      <h1 className="page-title">{request.code}</h1>
      <p className="page-sub">
        {pickI18n(template?.name, locale)} · {p.metals[request.details.metal] || request.details.metal} · {request.details.size}
        {diamond && <> · {p.shapes[diamond.shape]} {diamond.carat.toFixed(1)}ct</>}
        &nbsp;<StatusBadge status={request.status} />
      </p>

      {/* 결제 카드 */}
      {order && request.status === "CONFIRMED" && (
        <div className="panel pay-panel">
          <h3>{p.request.depositTitle}</h3>
          <table className="data-table"><tbody>
            <tr><th>{p.request.totalAmount}</th><td>{won(order.totalKrw)}</td></tr>
            <tr><th>{p.request.depositLbl(Math.round(settings.depositRate * 100))}</th><td className="price">{won(order.depositKrw)}</td></tr>
          </tbody></table>
          <button className="button primary" style={{ marginTop: 16 }} onClick={() => payOrder(order.id, "deposit", user)}>
            {p.request.payDeposit(won(order.depositKrw))}
          </button>
          <p className="form-hint" style={{ marginTop: 10 }}>{p.request.mockNote}</p>
        </div>
      )}
      {order && request.status === "QUALITY_CHECK" && (
        <div className="panel pay-panel">
          <h3>{p.request.finalTitle}</h3>
          <p className="form-hint">{p.request.qcHint}</p>
          <button className="button primary" style={{ marginTop: 12 }} onClick={() => payOrder(order.id, "final", user)}>
            {p.request.payFinal(won(order.totalKrw - order.depositKrw))}
          </button>
        </div>
      )}

      {/* 배송 추적 */}
      {order && stageIndex >= 0 && (
        <div className="panel">
          <h3>{p.request.stagesTitle}</h3>
          <Stepper steps={stages} currentIndex={stageIndex} />
          {order.trackingNo && <p className="form-hint" style={{ marginTop: 14 }}>{p.request.tracking}: {order.trackingNo}</p>}
          {request.status === "DELIVERED" && (
            <button className="button primary small" style={{ marginTop: 16 }} onClick={() => transitionRequest(request.id, "COMPLETED", user)}>
              {p.request.confirmReceipt}
            </button>
          )}
        </div>
      )}

      {/* 제작 과정 사진 */}
      {productionMedia.length > 0 && (
        <div className="panel">
          <h3>{p.request.productionTitle}</h3>
          <div className="proposal-media">
            {productionMedia.map((m) => <MediaThumb key={m.id} media={m} alt={p.request.productionTitle} />)}
          </div>
        </div>
      )}

      {/* 시안 목록 */}
      <h3 style={{ margin: "36px 0 14px" }}>{p.request.proposalsTitle} ({proposals.length})</h3>
      {proposals.length === 0 && <EmptyNote>{p.request.preparing}</EmptyNote>}
      {proposals.map((prop) => {
        const fbs = listFeedback(prop.id);
        return (
          <article className="proposal-card" key={prop.id}>
            <div className="proposal-head">
              <strong>{p.request.proposalV(prop.version)}</strong>
              <span className="form-hint">{prop.createdAt.slice(0, 10)}</span>
            </div>
            <div className="proposal-media">
              {prop.media.map((m, i) => <MediaThumb key={i} media={m} alt={p.request.proposalV(prop.version)} />)}
            </div>
            {prop.comment && <p className="proposal-comment">{prop.comment}</p>}
            {fbs.map((f) => (
              <div className="feedback-note" key={f.id}>
                {f.decision === "confirm"
                  ? p.request.confirmedNote
                  : p.request.revisionNote(f.choices.map((c) => p.request.choices[c] || c).join(", "))}
                {f.comment && ` — ${f.comment}`}
              </div>
            ))}
            {prop.id === latest?.id && request.status === "PROPOSAL_UPLOADED" && (
              <FeedbackForm proposal={prop} actor={user} />
            )}
          </article>
        );
      })}

      {/* 취소 */}
      {canTransition(request.status, "CANCELLED", "customer") && (
        <button
          className="button danger small" style={{ marginTop: 32 }}
          onClick={() => { if (confirm(p.request.cancelAsk)) transitionRequest(request.id, "CANCELLED", user); }}
        >
          {p.request.cancelOrder}
        </button>
      )}
    </div>
  );
}
