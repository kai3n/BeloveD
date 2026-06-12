import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { BENCHMARK_SHAPES, CAD_SLOTS, supplierTaskView } from "../../lib/ops.js";
import {
  getCandidate, getIntake, getOpsOrder, getOpsStyle, getProcurement, listCadReviews, submitCadForPr, submitCandidates, submitQcForPr, submitStockConfirm, submitWeightLabor,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb } from "../../components/ui.jsx";
import PinAnnotator from "../../components/PinAnnotator.jsx";
import { useLocale } from "../../i18n.jsx";

const emptyCand = () => ({ igiNo: "", shape: "round", carat: "", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", procurementCostUsd: "", table: "", depth: "", faceUp: "" });

export default function SupplierTask() {
  useDBVersion();
  const { p } = useLocale();
  const t = p.supplierP;
  const { prId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pr = getProcurement(prId);
  const [rows, setRows] = useState([emptyCand()]);
  const [media, setMedia] = useState([]);
  const [wl, setWl] = useState({ estWeightG: "", lossIncluded: true, laborUsd: "", meleeUsd: "", leadDays: "", assumptions: "" });
  const [qc, setQc] = useState({ actualWeightG: "" });
  const [slots, setSlots] = useState({ render360: [], side: [], wear: [] });

  if (!pr || pr.supplierId !== user.id) {
    return <div className="page"><EmptyNote>{t.empty}</EmptyNote></div>;
  }
  // 보안 프로젝션: 고객 신원/Order ID 미노출 뷰 (승인 레퍼런스 + 직전 리비전 핀 포함)
  const order = getOpsOrder(pr.orderId);
  const intake = order ? getIntake(order.intakeId) : null;
  const revisionReview = pr.type === "cad" && order
    ? listCadReviews(order.id).find((c) => c.decision === "minorRevision") || null
    : null;
  const stockDiamond = pr.diamondId ? getCandidate(pr.diamondId) : null;
  const view = supplierTaskView(pr, order, order?.styleId ? getOpsStyle(order.styleId) : null, intake, revisionReview, stockDiamond);
  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function sendCandidates(e) {
    e.preventDefault();
    const cands = rows.filter((r) => r.igiNo && r.carat).map((r, i) => ({
      igiNo: r.igiNo, shape: r.shape, carat: Number(r.carat), color: r.color, clarity: r.clarity,
      growth: r.growth, lab: r.lab, procurementCostUsd: Number(r.procurementCostUsd) || 0,
      proportions: { table: Number(r.table) || null, depth: Number(r.depth) || null, faceUp: r.faceUp || "" },
      image: media[i]?.src || media[0]?.src || "/assets/lab-diamond-tweezers.png",
      video: media[i]?.kind === "video" ? media[i].src : "",
    }));
    if (cands.length === 0) return;
    submitCandidates(prId, cands);
    navigate("/supplier");
  }

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <h1 className="page-title">{pr.id}</h1>
      <p className="page-sub">{t.taskTypes[pr.type]} · {t.due}: {view.dueDate}
        {view.batchValidUntil && <> · {t.batchUntil}: {view.batchValidUntil}</>}
        {view.requiredDate && <> · {t.required}: {view.requiredDate}</>}
      </p>

      <div className="panel">
        <h3>{t.brief}</h3>
        <p className="form-hint" style={{ fontSize: 13.5 }}>{view.brief || "—"}</p>
        {view.styleRef && <p className="form-hint">{t.styleRef}: {view.styleRef}{view.styleEstWeightG && ` · ${view.styleEstWeightG}g`}{view.metal && ` · ${view.metal}`}{view.measurements && ` · ${view.measurements}`}</p>}
      </div>

      {/* 비주얼 브리프 — 같은 핀이 공급자 언어로 렌더링된다 */}
      {(view.references.length > 0 || view.revision) && (
        <div className="panel form-stack">
          <h3>{p.visual.refTitle}</h3>
          {view.references.map((r) => (
            <PinAnnotator key={r.id} src={r.src} annotations={r.annotations} readOnly />
          ))}
          {view.revision && (
            <>
              <h3>CAD V{view.revision.version} — {p.portal.cadDecided.minorRevision}</h3>
              <PinAnnotator src={view.revision.fileUrl} annotations={view.revision.annotations} readOnly />
            </>
          )}
        </div>
      )}

      {pr.status !== "open" ? (
        <EmptyNote>{t.status.submitted}</EmptyNote>
      ) : pr.type === "stockConfirm" ? (
        <div className="panel form-stack">
          <h3>{t.stockTitle}</h3>
          {view.diamond && (
            <div className="card-grid cols-3">
              <div className="item-card">
                <MediaThumb media={view.diamond.video ? { kind: "video", src: view.diamond.video } : { kind: "image", src: view.diamond.image }} alt={view.diamond.igiNo} />
                <div className="card-body">
                  <h3>{view.diamond.shape} {Number(view.diamond.carat).toFixed(2)}ct</h3>
                  <p className="spec">{view.diamond.color} / {view.diamond.clarity} · {view.diamond.growth} · {view.diamond.lab}</p>
                  <p className="spec">{t.igiNo}: {view.diamond.igiNo}</p>
                </div>
              </div>
            </div>
          )}
          <div className="row-actions">
            <button className="button primary" onClick={() => { submitStockConfirm(prId, true); navigate("/supplier"); }}>{t.stockYes}</button>
            <button className="button danger" onClick={() => { submitStockConfirm(prId, false); navigate("/supplier"); }}>{t.stockNo}</button>
          </div>
        </div>
      ) : pr.type === "diamondCandidates" ? (
        <form className="panel form-stack" onSubmit={sendCandidates}>
          <h3>{t.candTitle}</h3>
          {rows.map((r, i) => (
            <div key={i} className="filter-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <label className="field"><span>{t.igiNo}</span><input value={r.igiNo} onChange={(e) => setRow(i, { igiNo: e.target.value })} /></label>
              <label className="field"><span>{p.intake.shape}</span>
                <select value={r.shape} onChange={(e) => setRow(i, { shape: e.target.value })}>{BENCHMARK_SHAPES.map((sh) => <option key={sh} value={sh}>{sh}</option>)}</select></label>
              <label className="field"><span>{p.intake.carat}</span><input type="number" step="0.01" value={r.carat} onChange={(e) => setRow(i, { carat: e.target.value })} /></label>
              <label className="field"><span>{p.intake.color}</span>
                <select value={r.color} onChange={(e) => setRow(i, { color: e.target.value })}>{["D", "E", "F"].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>{p.intake.clarity}</span>
                <select value={r.clarity} onChange={(e) => setRow(i, { clarity: e.target.value })}>{["VVS1", "VVS2", "VS1", "VS2"].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>{p.intake.growth}</span>
                <select value={r.growth} onChange={(e) => setRow(i, { growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
              <label className="field"><span>{p.intake.lab}</span><input value={r.lab} onChange={(e) => setRow(i, { lab: e.target.value })} /></label>
              <label className="field"><span>{t.costUsd}</span><input type="number" value={r.procurementCostUsd} onChange={(e) => setRow(i, { procurementCostUsd: e.target.value })} /></label>
              <label className="field"><span>Table %</span><input type="number" step="0.1" value={r.table} onChange={(e) => setRow(i, { table: e.target.value })} /></label>
              <label className="field"><span>Depth %</span><input type="number" step="0.1" value={r.depth} onChange={(e) => setRow(i, { depth: e.target.value })} /></label>
            </div>
          ))}
          <button type="button" className="button secondary small" onClick={() => setRows((rs) => [...rs, emptyCand()])}>{t.addRow}</button>
          <p className="form-hint">{t.media}</p>
          <MediaPicker value={media} onChange={setMedia} />
          <button className="button primary" type="submit">{t.submit}</button>
        </form>
      ) : pr.type === "weightLabor" ? (
        <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); submitWeightLabor(prId, { ...wl, estWeightG: Number(wl.estWeightG), laborUsd: Number(wl.laborUsd), meleeUsd: Number(wl.meleeUsd) || 0, leadDays: Number(wl.leadDays) }); navigate("/supplier"); }}>
          <h3>{t.wlTitle}</h3>
          <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="field"><span>{t.estWeight}</span><input type="number" step="0.1" value={wl.estWeightG} onChange={(e) => setWl({ ...wl, estWeightG: e.target.value })} required /></label>
            <label className="field"><span>{t.laborUsd}</span><input type="number" value={wl.laborUsd} onChange={(e) => setWl({ ...wl, laborUsd: e.target.value })} required /></label>
            <label className="field"><span>{t.meleeUsd}</span><input type="number" value={wl.meleeUsd} onChange={(e) => setWl({ ...wl, meleeUsd: e.target.value })} /></label>
            <label className="field"><span>{t.leadDays}</span><input type="number" value={wl.leadDays} onChange={(e) => setWl({ ...wl, leadDays: e.target.value })} required /></label>
          </div>
          <label className="field" style={{ display: "flex", flexDirection: "row", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={wl.lossIncluded} onChange={(e) => setWl({ ...wl, lossIncluded: e.target.checked })} style={{ width: "auto" }} />
            <span>{t.lossIncluded}</span>
          </label>
          <label className="field"><span>{t.assumptions}</span><textarea value={wl.assumptions} onChange={(e) => setWl({ ...wl, assumptions: e.target.value })} /></label>
          <button className="button primary" type="submit">{t.submit}</button>
        </form>
      ) : pr.type === "cad" ? (
        <form className="panel form-stack" onSubmit={(e) => {
          e.preventDefault();
          const cadMedia = CAD_SLOTS.filter((s) => slots[s][0]).map((s) => ({ slot: s, ...slots[s][0] }));
          if (cadMedia.length > 0) { submitCadForPr(prId, cadMedia); navigate("/supplier"); }
        }}>
          <h3>{t.cadTitle}</h3>
          <p className="form-hint">{t.cadFile}</p>
          <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", alignItems: "start" }}>
            {CAD_SLOTS.map((s) => (
              <div key={s} className="form-stack">
                <p className="label">{p.visual.slots[s]}</p>
                <MediaPicker value={slots[s]} onChange={(v) => setSlots({ ...slots, [s]: v.slice(-1) })} />
              </div>
            ))}
          </div>
          <button className="button primary" type="submit" disabled={!slots.render360[0]}>{t.submit}</button>
        </form>
      ) : (
        <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); submitQcForPr(prId, { video: media.find((m) => m.kind === "video")?.src || media[0]?.src || "", cert: media[1]?.src || "", actualWeightG: Number(qc.actualWeightG) || null }); navigate("/supplier"); }}>
          <h3>{t.qcTitle}</h3>
          <p className="form-hint">{t.qcVideo} · {t.qcCert}</p>
          <MediaPicker value={media} onChange={setMedia} />
          <label className="field"><span>{t.qcWeight}</span><input type="number" step="0.01" value={qc.actualWeightG} onChange={(e) => setQc({ actualWeightG: e.target.value })} /></label>
          <button className="button primary" type="submit" disabled={media.length === 0}>{t.submit}</button>
        </form>
      )}
    </div>
  );
}
