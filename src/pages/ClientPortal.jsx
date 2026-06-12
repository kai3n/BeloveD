import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import {
  acceptQuote, decideCad, listCustomerActions, portalView, respondCustomerAction, selectCandidate,
} from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote, MediaThumb, usd } from "../components/ui.jsx";
import { pickI18n, useLocale } from "../i18n.jsx";

// 게스트 조회 입력 (Order ID + 쿼리코드)
export function TrackEntry() {
  const { p } = useLocale();
  const t = p.portal;
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="page page-narrow">
      <h1 className="page-title">{t.guestTitle}</h1>
      <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); navigate(`/track/${orderId.trim().toUpperCase()}?code=${code.trim().toUpperCase()}`); }}>
        <label className="field"><span>{t.orderId}</span><input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="DM-000001" required /></label>
        <label className="field"><span>{t.code}</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" required /></label>
        <button className="button primary" type="submit">{t.open}</button>
      </form>
    </div>
  );
}

function CadCard({ cad, orderId, actor }) {
  const { p } = useLocale();
  const t = p.portal;
  const [mode, setMode] = useState(null);
  const [fb, setFb] = useState("");
  const [measure, setMeasure] = useState("");

  function send(decision) {
    decideCad(cad.id, { decision, feedback: fb.split("\n").filter(Boolean), confirmedMeasurements: measure }, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "cadReview");
    if (ca) respondCustomerAction(ca.id, decision, actor);
    setMode(null); setFb("");
  }

  return (
    <div className="panel">
      <div className="proposal-head">
        <h3 style={{ margin: 0 }}>{t.cadTitle} — {t.cadVersion(cad.version)}</h3>
        {cad.decision && <span className="status-badge cst-SUBMITTED">{t.cadDecided[cad.decision]}</span>}
      </div>
      {cad.fileUrl && <MediaThumb media={{ kind: cad.fileUrl.endsWith(".mp4") ? "video" : "image", src: cad.fileUrl }} ratio="16 / 9" alt={t.cadTitle} />}
      {!cad.decision && (
        <div className="form-stack" style={{ marginTop: 14 }}>
          <label className="field"><span>{t.cadMeasure}</span>
            <input value={measure} onChange={(e) => setMeasure(e.target.value)} /></label>
          {mode === "revise" && (
            <label className="field"><span>{t.cadRevise}</span>
              <textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder={t.cadFeedbackPh} /></label>
          )}
          <div className="row-actions">
            <button className="button primary small" onClick={() => send("approved")}>{t.cadApprove}</button>
            {mode !== "revise"
              ? <button className="button secondary small" onClick={() => setMode("revise")}>{t.cadRevise}</button>
              : <button className="button secondary small" disabled={!fb.trim()} onClick={() => send("minorRevision")}>{p.common.submit}</button>}
          </div>
        </div>
      )}
      {cad.decision === "minorRevision" && cad.feedback.length > 0 && (
        <div className="feedback-note">{cad.feedback.join(" · ")}</div>
      )}
    </div>
  );
}

export default function ClientPortal() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.portal;
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const code = params.get("code") || "";
  const actor = user?.id || `guest:${orderId}`;

  const view = portalView(orderId, { customerId: user?.id, queryCode: code });
  if (!view) {
    return <div className="page"><EmptyNote>{t.notFound}</EmptyNote></div>;
  }
  const { order, style, candidates, selected, quote, milestones, cad, actions } = view;

  function pick(diaId) {
    selectCandidate(diaId, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "diamondSelection");
    if (ca) respondCustomerAction(ca.id, diaId, actor);
  }
  function accept() {
    acceptQuote(quote.id, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "quoteAcceptance");
    if (ca) respondCustomerAction(ca.id, quote.id, actor);
  }

  const anySelected = selected || candidates.some((c) => c.clientSelection === "selected");

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <h1 className="page-title">{order.id}</h1>
      <p className="page-sub">
        {style && <>{style.id} — {pickI18n(style.name, locale)} · </>}
        {order.requiredDate && <>{t.requiredDate}: {order.requiredDate} · </>}
        <span className={`status-badge ost-${order.status}`}>{p.orderStatus[order.status]}</span>
      </p>

      {actions.length > 0 && (
        <div className="panel pay-panel">
          <h3>{t.actionsTitle}</h3>
          {actions.map((a) => (
            <p key={a.id} className="form-hint" style={{ fontSize: 13.5 }}>
              · {a.prompt || a.type}{a.dueDate && ` — ${a.dueDate}`}
            </p>
          ))}
        </div>
      )}

      {/* 다이아 후보 (published만) */}
      {candidates.length > 0 && (
        <div className="panel">
          <h3>{t.candidatesTitle}</h3>
          <p className="form-hint" style={{ marginBottom: 14 }}>{t.batchNote}</p>
          <div className="card-grid cols-3">
            {candidates.map((c) => (
              <div className={`item-card ${c.clientSelection === "selected" || selected?.id === c.id ? "select-card is-selected" : ""}`} key={c.id}>
                <MediaThumb media={c.video ? { kind: "video", src: c.video } : { kind: "image", src: c.image }} alt={c.id} />
                <div className="card-body">
                  <h3>{p.shapes[c.shape] || c.shape} {c.carat.toFixed(2)}ct</h3>
                  <p className="spec">{c.color} / {c.clarity} · {p.portal.growth[c.growth] || c.growth} · {c.lab}</p>
                  <p className="spec">{t.igi} {c.igiNo} · {t.treated}</p>
                  {c.proportions?.faceUp && <p className="spec">T{c.proportions.table} · D{c.proportions.depth} · {c.proportions.faceUp}</p>}
                  <p className="price">{usd(c.customerPriceUsd)} · {t.availability[c.availability]}</p>
                  {c.clientSelection === "selected" || selected?.id === c.id ? (
                    <p className="form-hint">{t.selected} ✓</p>
                  ) : (
                    !anySelected && c.availability === "available" && order.status === "STONE_SELECTION" && (
                      <button className="button secondary small" style={{ marginTop: 8 }} onClick={() => pick(c.id)}>{t.select}</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 견적 */}
      {quote && (
        <div className="panel pay-panel">
          <div className="proposal-head">
            <h3 style={{ margin: 0 }}>{t.quoteTitle} — {quote.id}</h3>
            {quote.status === "accepted" && <span className="status-badge cst-REPLACED">{t.accepted}</span>}
          </div>
          <table className="data-table"><tbody>
            {quote.diamondAmountUsd > 0 && <tr><th>{t.diamondAmount}</th><td>{usd(quote.diamondAmountUsd)}</td></tr>}
            <tr><th>{t.metalAmount}</th><td>{usd(quote.metalAmountUsd)} <span className="form-hint">({quote.estWeightG}g)</span></td></tr>
            <tr><th>{t.packageAmount}</th><td>{usd(quote.nonMetalUsd)}</td></tr>
            <tr><th>{t.total}</th><td className="price">{usd(quote.totalUsd)}</td></tr>
            <tr><th>{t.deposit}</th><td>{usd(quote.depositUsd)}</td></tr>
            <tr><th>{t.balance}</th><td>{usd(quote.balanceUsd)}</td></tr>
            <tr><th>{t.validUntil}</th><td>{quote.validUntil} · {t.lead(quote.leadDays)}</td></tr>
          </tbody></table>
          {quote.status === "sent" && (
            <button className="button primary" style={{ marginTop: 16 }} onClick={accept}>{t.accept}</button>
          )}
        </div>
      )}

      {/* CAD */}
      {cad && <CadCard cad={cad} orderId={orderId} actor={actor} />}

      {/* 마일스톤 타임라인 */}
      {milestones.length > 0 && (
        <div className="panel">
          <h3>{t.progressTitle}</h3>
          <table className="data-table"><tbody>
            {milestones.map((m) => (
              <tr key={m.id}>
                <th>{p.msStages[m.stage]}</th>
                <td><span className={`status-badge mst-${m.status}`}>{p.msStatus[m.status]}</span></td>
                <td>{m.clientUpdate}{m.clientAction && <span className="form-hint"> — {m.clientAction}</span>}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
