import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { BENCHMARK_SHAPES } from "../../lib/ops.js";
import { supplierTaskView } from "../../lib/ops.js";
import {
  getOpsOrder, getOpsStyle, getProcurement, submitCadForPr, submitCandidates, submitQcForPr, submitWeightLabor,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker } from "../../components/ui.jsx";
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

  if (!pr || pr.supplierId !== user.id) {
    return <div className="page"><EmptyNote>{t.empty}</EmptyNote></div>;
  }
  // 보안 프로젝션: 고객 신원/Order ID 미노출 뷰
  const order = getOpsOrder(pr.orderId);
  const view = supplierTaskView(pr, order, order?.styleId ? getOpsStyle(order.styleId) : null);
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

      {pr.status !== "open" ? (
        <EmptyNote>{t.status.submitted}</EmptyNote>
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
        <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); if (media[0]) { submitCadForPr(prId, media[0].src); navigate("/supplier"); } }}>
          <h3>{t.cadTitle}</h3>
          <p className="form-hint">{t.cadFile}</p>
          <MediaPicker value={media} onChange={setMedia} />
          <button className="button primary" type="submit" disabled={!media[0]}>{t.submit}</button>
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
