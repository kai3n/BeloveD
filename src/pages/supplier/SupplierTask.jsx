import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { BENCHMARK_SHAPES, CAD_SLOTS, supplierTaskView } from "../../lib/ops.js";
import {
  getCandidate, getIntake, getOpsOrder, getOpsStyle, getProcurement, listCadReviews, submitCadForPr, submitCandidates, submitQcForPr, submitShipment, submitStockConfirm, submitWeightLabor,
} from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaPicker, MediaThumb } from "../../components/ui.jsx";
import PinAnnotator from "../../components/PinAnnotator.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

const emptyCand = () => ({ igiNo: "", shape: "round", carat: "", color: "E", clarity: "VS1", growth: "CVD", lab: "IGI India", procurementCostUsd: "", table: "", depth: "", faceUp: "" });

// 후보 행을 주문 요청 사양(stonePrefs)으로 프리필 — 벤더가 4C를 매번 재입력하지 않게
function initialRow(prId) {
  const base = emptyCand();
  const pr = getProcurement(prId);
  if (pr?.type !== "diamondCandidates") return base;
  const order = getOpsOrder(pr.orderId);
  const sp = order ? getIntake(order.intakeId)?.stonePrefs : null;
  if (!sp) return base;
  return {
    ...base,
    shape: sp.shape || base.shape, carat: sp.carat ? String(sp.carat) : "",
    color: sp.color || base.color, clarity: sp.clarity || base.clarity,
    growth: sp.growth || base.growth, lab: sp.lab || base.lab,
  };
}

// 고객 요구를 한눈에 종합하는 제작 브리프 — 텍스트 최소화, 시각 우선 (어르신 벤더 친화적)
function BriefChip({ label, value }) {
  if (!value) return null;
  return <div className="brief-chip"><span className="bc-label">{label}</span><span className="bc-value">{value}</span></div>;
}

function OrderBrief({ view, t, p, locale }) {
  // 깔끔한 값 우선 (conditional은 "6 US" 같은 값만) — measurements는 "ringSize: 6 US"처럼 키가 붙어 후순위
  const sizeText = (view.conditional && Object.values(view.conditional).filter(Boolean).join(" · "))
    || view.measurements
    || null;
  const d = view.diamond;
  const sp = view.stonePrefs;
  const stoneText = d
    ? `${p.shapes[d.shape] || d.shape} ${Number(d.carat).toFixed(2)}ct · ${d.color}/${d.clarity} · ${d.growth}`
    : sp
      ? `${p.shapes[sp.shape] || sp.shape} ${sp.carat}ct · ${sp.color}/${sp.clarity} · ${sp.growth}`
      : (view.multiSpec?.meleeSpec || null);
  const cover = view.styleCover ? { kind: view.styleCover.endsWith(".mp4") ? "video" : "image", src: view.styleCover } : null;
  // 태스크 유형별 카드 — 배송엔 주소가 히어로, QC엔 검수 프레이밍, 그 외엔 제작 사양
  const title = view.type === "ship" ? t.briefShip : view.type === "qc" ? t.briefQc : t.briefTitle;
  const shipAddress = view.type === "ship" ? (view.brief || "").replace(/^ship to:\s*/i, "") : null;

  return (
    <div className="panel brief-card form-stack">
      <h2 className="brief-title">{title}</h2>
      {shipAddress && (
        <div className="brief-ship">
          <p className="brief-section-label">📦 {t.shipTo}</p>
          <p style={{ fontSize: 17, lineHeight: 1.5, margin: "4px 0 0" }}>{shipAddress}</p>
        </div>
      )}
      <div className="brief-hero">
        {cover && <div className="brief-cover"><MediaThumb media={cover} ratio="1 / 1" alt={view.styleRef || ""} /></div>}
        <div className="brief-chips">
          <BriefChip label={t.bCategory} value={view.category ? p.opsCategories[view.category] : null} />
          <BriefChip label={t.bMetal} value={view.metal ? p.opsMetals[view.metal] : null} />
          <BriefChip label={t.bSize} value={sizeText} />
          <BriefChip label={t.bStone} value={stoneText} />
          {view.styleRef && <BriefChip label={t.styleRef} value={`${view.styleRef}${view.styleName ? ` · ${pickI18n(view.styleName, locale)}` : ""}`} />}
        </div>
      </div>

      {view.references.length > 0 && (
        <div className="form-stack">
          <p className="brief-section-label">{t.refLikes}</p>
          <div className="card-grid cols-2">
            {view.references.map((r) => <PinAnnotator key={r.id} src={r.src} annotations={r.annotations} readOnly />)}
          </div>
        </div>
      )}

      {view.revision && (
        <div className="form-stack brief-revision">
          <p className="brief-section-label revision">{t.changeThis} — CAD V{view.revision.version}</p>
          <PinAnnotator src={view.revision.fileUrl} annotations={view.revision.annotations} readOnly />
        </div>
      )}
    </div>
  );
}

export default function SupplierTask() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.supplierP;
  const { prId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pr = getProcurement(prId);
  const [rows, setRows] = useState(() => [initialRow(prId)]);
  const [media, setMedia] = useState([]);
  const [wl, setWl] = useState({ estWeightG: "", lossIncluded: true, laborUsd: "", meleeUsd: "", leadDays: "", assumptions: "" });
  const [qc, setQc] = useState({ actualWeightG: "" });
  const [slots, setSlots] = useState({ render360: [], side: [], wear: [] });
  const [ship, setShip] = useState({ trackingNo: "", shippedAt: "" });

  if (!pr || pr.supplierId !== user.id) {
    return <div className="page"><EmptyNote>{t.empty}</EmptyNote></div>;
  }
  // 보안 프로젝션: 고객 신원/Order ID 미노출 뷰 (승인 레퍼런스 + 직전 리비전 핀 포함)
  const order = getOpsOrder(pr.orderId);
  const intake = order ? getIntake(order.intakeId) : null;
  const revisionReview = pr.type === "cad" && order
    ? listCadReviews(order.id).find((c) => c.decision === "minorRevision" && !c.hidden) || null
    : null;
  // 재고확인엔 대상 다이아, CAD/QC엔 확정된 센터스톤 — 둘 다 안전 필드만
  const diaId = pr.diamondId || (["cad", "qc"].includes(pr.type) ? order?.selectedDiamondId : null);
  const briefDiamond = diaId ? getCandidate(diaId) : null;
  const view = supplierTaskView(pr, order, order?.styleId ? getOpsStyle(order.styleId) : null, intake, revisionReview, briefDiamond);
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
      <h1 className="page-title">{pr.id} <span className="status-badge" style={{ verticalAlign: "middle" }}>{view.jobCode}</span></h1>
      <p className="page-sub">{t.taskTypes[pr.type]} · {t.due}: {view.dueDate}
        {view.batchValidUntil && <> · {t.batchUntil}: {view.batchValidUntil}</>}
        {view.requiredDate && <> · {t.required}: {view.requiredDate}</>}
      </p>

      {/* 고객 요구 종합 — 시각 우선 카드 (제작 내용·메탈·사이즈·스톤 + 레퍼런스/수정 핀) */}
      <OrderBrief view={view} t={t} p={p} locale={locale} />

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
            <div key={i} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 14, marginBottom: 4 }}>
              {/* 필수: IGI·캐럿·원가 */}
              <div className="filter-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <label className="field"><span>{t.igiNo}</span><input value={r.igiNo} onChange={(e) => setRow(i, { igiNo: e.target.value })} /></label>
                <label className="field"><span>{p.intake.carat}</span><input type="number" step="0.01" value={r.carat} onChange={(e) => setRow(i, { carat: e.target.value })} /></label>
                <label className="field"><span>{t.costUsd}</span><input type="number" value={r.procurementCostUsd} onChange={(e) => setRow(i, { procurementCostUsd: e.target.value })} /></label>
              </div>
              {/* 4C */}
              <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 10 }}>
                <label className="field"><span>{p.intake.shape}</span>
                  <select value={r.shape} onChange={(e) => setRow(i, { shape: e.target.value })}>{BENCHMARK_SHAPES.map((sh) => <option key={sh} value={sh}>{sh}</option>)}</select></label>
                <label className="field"><span>{p.intake.color}</span>
                  <select value={r.color} onChange={(e) => setRow(i, { color: e.target.value })}>{["D", "E", "F"].map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field"><span>{p.intake.clarity}</span>
                  <select value={r.clarity} onChange={(e) => setRow(i, { clarity: e.target.value })}>{["VVS1", "VVS2", "VS1", "VS2"].map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field"><span>{p.intake.growth}</span>
                  <select value={r.growth} onChange={(e) => setRow(i, { growth: e.target.value })}><option>CVD</option><option>HPHT</option></select></label>
              </div>
              {/* 선택: 감정소·비율 */}
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12.5, padding: "2px 0" }}>{t.proportions}</summary>
                <div className="filter-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 8 }}>
                  <label className="field"><span>{p.intake.lab}</span><input value={r.lab} onChange={(e) => setRow(i, { lab: e.target.value })} /></label>
                  <label className="field"><span>Table %</span><input type="number" step="0.1" value={r.table} onChange={(e) => setRow(i, { table: e.target.value })} /></label>
                  <label className="field"><span>Depth %</span><input type="number" step="0.1" value={r.depth} onChange={(e) => setRow(i, { depth: e.target.value })} /></label>
                </div>
              </details>
            </div>
          ))}
          <button type="button" className="button secondary small" onClick={() => setRows((rs) => [...rs, initialRow(prId)])}>{t.addRow}</button>
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
          <div className="cad-slots">
            {CAD_SLOTS.map((s) => (
              <div key={s} className="form-stack">
                <p className="label">{p.visual.slots[s]}</p>
                <MediaPicker value={slots[s]} onChange={(v) => setSlots({ ...slots, [s]: v.slice(-1) })} />
              </div>
            ))}
          </div>
          <button className="button primary" type="submit" disabled={!slots.render360[0]}>{t.submit}</button>
        </form>
      ) : pr.type === "ship" ? (
        <form className="panel form-stack" onSubmit={(e) => { e.preventDefault(); submitShipment(prId, { trackingNo: ship.trackingNo, shippedAt: ship.shippedAt }); navigate("/supplier"); }}>
          <h3>{t.shipTitle}</h3>
          <div className="filter-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="field"><span>{t.trackingNo}</span><input value={ship.trackingNo} onChange={(e) => setShip({ ...ship, trackingNo: e.target.value })} required /></label>
            <label className="field"><span>{t.shippedAt}</span><input type="date" value={ship.shippedAt} onChange={(e) => setShip({ ...ship, shippedAt: e.target.value })} /></label>
          </div>
          <button className="button primary" type="submit">{t.submit}</button>
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
