import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MILESTONE_STAGES, ORDER_STATUSES, PR_TYPES } from "../../lib/ops.js";
import {
  createProcurement, createQuote, getCandidate, getIntake, getOpsOrder, getOpsStyle, listAudit,
  listCandidates, listCadReviews, listCustomerActions, listMilestones, listProcurements, listQuotes,
  lockCandidate, markBalanceReceived, markDepositReceived, markOrderDelivered, publishCandidate,
  recordActualWeight, reviewCandidate, sendQuote,
  setCandidateAvailability, unpublishCandidate, updateOpsOrder, upsertMilestone, listDealers, getSettings,
  getDB, reviewReferenceMedia,
} from "../../lib/store.js";
import { formatAnnotation } from "../../lib/chips.js";
import { useDBVersion } from "../../lib/useDB.js";
import { EmptyNote, MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

// 조달요청 결과를 raw JSON 대신 사람이 읽을 요약으로 (어드민 가독성)
function prResultSummary(pr) {
  const r = pr.result;
  if (!r) return "";
  if (pr.type === "stockConfirm") return r.available ? "in stock" : "sold out";
  if (pr.type === "ship") return [r.trackingNo, r.shippedAt].filter(Boolean).join(" · ");
  if (pr.type === "qc") return [r.actualWeightG && `${r.actualWeightG}g`, r.video && "video", r.cert && "cert"].filter(Boolean).join(" · ");
  if (pr.type === "weightLabor") return [r.estWeightG && `${r.estWeightG}g`, r.laborUsd && `labor $${r.laborUsd}`, r.leadDays && `${r.leadDays}d`].filter(Boolean).join(" · ");
  return "submitted";
}

function PrForm({ orderId, suppliers, t }) {
  const [f, setF] = useState({ type: "diamondCandidates", supplierId: suppliers[0]?.id || "", dueDate: "", batchValidUntil: "", brief: "" });
  return (
    <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createProcurement(orderId, f); }}>
      <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <label className="field"><span>{t.prType}</span>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {PR_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
          </select></label>
        <label className="field"><span>{t.supplier}</span>
          <select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
            {suppliers.map((su) => <option key={su.id} value={su.id}>{su.name}</option>)}
          </select></label>
        <label className="field"><span>{t.due}</span><input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} required /></label>
        <label className="field"><span>{t.batchUntil}</span><input type="date" value={f.batchValidUntil} onChange={(e) => setF({ ...f, batchValidUntil: e.target.value })} /></label>
      </div>
      <label className="field"><span>{t.brief}</span><input value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} /></label>
      <button className="button secondary small" type="submit">{t.newPr}</button>
    </form>
  );
}

function QuoteBuilder({ order, settings, t }) {
  const dia = order.selectedDiamondId ? getCandidate(order.selectedDiamondId) : null;
  const intakeMetal = getIntake(order.intakeId)?.metal || "18kw";
  const [f, setF] = useState({
    estWeightG: order.styleId ? getOpsStyle(order.styleId)?.estWeightG || "" : "",
    metalRefUsdPerG: settings.metalRefUsdPerG[intakeMetal] || 85,
    lossRatePct: settings.defaultLossRatePct, nonMetalUsd: "",
    diamondCostUsd: dia?.procurementCostUsd || 0, laborUsd: "", extrasUsd: "", riskUsd: "", multiplier: settings.opsMultiplier,
  });
  return (
    <form className="form-stack" onSubmit={(e) => {
      e.preventDefault();
      createQuote(order.id, {
        estWeightG: Number(f.estWeightG), metalRefUsdPerG: Number(f.metalRefUsdPerG), lossRatePct: Number(f.lossRatePct),
        nonMetalUsd: Number(f.nonMetalUsd),
        internal: { diamondCostUsd: Number(f.diamondCostUsd), laborUsd: Number(f.laborUsd) || 0, extrasUsd: Number(f.extrasUsd) || 0, riskUsd: Number(f.riskUsd) || 0, multiplier: Number(f.multiplier) },
      });
    }}>
      <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <label className="field"><span>{t.estWeight}</span><input type="number" step="0.1" value={f.estWeightG} onChange={(e) => setF({ ...f, estWeightG: e.target.value })} required /></label>
        <label className="field"><span>{t.metalRef}</span><input type="number" step="0.5" value={f.metalRefUsdPerG} onChange={(e) => setF({ ...f, metalRefUsdPerG: e.target.value })} /></label>
        <label className="field"><span>{t.lossRate}</span><input type="number" step="0.5" value={f.lossRatePct} onChange={(e) => setF({ ...f, lossRatePct: e.target.value })} /></label>
        <label className="field"><span>{t.nonMetal}</span><input type="number" value={f.nonMetalUsd} onChange={(e) => setF({ ...f, nonMetalUsd: e.target.value })} required /></label>
      </div>
      <p className="form-hint">{t.internalCost}</p>
      <div className="filter-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {["diamondCostUsd", "laborUsd", "extrasUsd", "riskUsd", "multiplier"].map((k) => (
          <label className="field" key={k}><span>{k}</span>
            <input type="number" step="0.1" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
      </div>
      <button className="button secondary small" type="submit">{t.createQuote}</button>
    </form>
  );
}

export default function AdminOpsOrder() {
  useDBVersion();
  const { p, locale } = useLocale();
  const t = p.opsA.orders;
  const { orderId } = useParams();
  const order = getOpsOrder(orderId);
  const settings = getSettings();
  const [actualW, setActualW] = useState("");

  if (!order) return <div className="page"><EmptyNote>—</EmptyNote></div>;

  const intake = getIntake(order.intakeId);
  const style = order.styleId ? getOpsStyle(order.styleId) : null;
  const candidates = listCandidates({ orderId });
  const quotes = listQuotes(orderId);
  const milestones = listMilestones(orderId);
  const cads = listCadReviews(orderId);
  const actions = listCustomerActions(orderId);
  const auditRows = listAudit(orderId).slice(-8).reverse();
  const suppliers = getDB().users.filter((u) => u.role === "supplier");
  const acceptedQuote = quotes.find((q) => q.status === "accepted");

  // 어드민 터치포인트는 단 3개 — 지금 필요한 하나만 카드로 띄운다 (나머지는 자동 진행)
  const balanceDone = milestones.some((m) => m.stage === "balanceReceived" && m.status === "done");
  const nextAction = (order.status === "QUOTATION" && acceptedQuote) ? { fn: () => markDepositReceived(order.id), label: t.markDeposit }
    : (order.status === "BALANCE" && !balanceDone) ? { fn: () => markBalanceReceived(order.id), label: t.markBalance }
      : order.status === "SHIPPING" ? { fn: () => markOrderDelivered(order.id), label: t.markDelivered }
        : null;

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <h1 className="page-title" style={{ fontSize: 34 }}>{order.id} <span className={`status-badge ost-${order.status}`}>{p.orderStatus[order.status]}</span></h1>
      <p className="page-sub">
        {order.customerName} · {style && <>{style.id} {pickI18n(style.name, locale)} · </>}
        {t.queryCode}: {order.queryCode} · <Link className="text-link" to={`/track/${order.id}?code=${order.queryCode}`}>{p.portal.title} ↗</Link>
      </p>

      {/* 지금 할 일 — 운영자 개입은 디파짓·잔금·수령 3개뿐. 해당 단계에서만 버튼 노출 */}
      <div className="panel" style={nextAction ? { borderColor: "rgba(214,197,160,0.6)", background: "rgba(214,197,160,0.05)" } : undefined}>
        <p className="form-hint" style={{ margin: 0, letterSpacing: 1 }}>{t.naTitle}</p>
        {nextAction
          ? <button className="button primary" style={{ marginTop: 12 }} onClick={nextAction.fn}>{nextAction.label}</button>
          : <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{t.naNone}</p>}
      </div>

      {/* 상태/노트 */}
      <div className="panel form-stack">
        <div className="row-actions">
          <label className="field" style={{ minWidth: 220 }}><span>{t.statusSet}</span>
            <select value={order.status} onChange={(e) => updateOpsOrder(order.id, { status: e.target.value })}>
              {ORDER_STATUSES.map((st) => <option key={st} value={st}>{p.orderStatus[st]}</option>)}
            </select></label>
          <label className="field" style={{ flex: 1 }}><span>{t.internalNotes}</span>
            <input defaultValue={order.internalNotes} key={order.internalNotes} onBlur={(e) => updateOpsOrder(order.id, { internalNotes: e.target.value })} /></label>
        </div>
        {intake && (
          <p className="form-hint">
            {t.intake}: {p.productLines[intake.productLine]} · {p.opsCategories[intake.category]} · {p.opsMetals[intake.metal]}
            {intake.conditional && Object.entries(intake.conditional).map(([k, v]) => ` · ${k}: ${v}`)}
            {intake.stonePrefs && ` · ${intake.stonePrefs.shape} ${intake.stonePrefs.carat}ct ${intake.stonePrefs.color}/${intake.stonePrefs.clarity} ${intake.stonePrefs.growth}`}
            {intake.multiSpec && ` · melee: ${intake.multiSpec.meleeSpec} · ${intake.multiSpec.overallDims} · ${intake.multiSpec.standard}`}
            {intake.budget && ` · $${intake.budget}`} · {intake.contact}
          </p>
        )}
      </div>

      {/* 레퍼런스 검수 — 승인분만 벤더 브리프로 나간다 */}
      {intake?.referenceMedia?.length > 0 && (
        <div className="panel form-stack">
          <h3>{p.visual.refReviewTitle}</h3>
          <div className="card-grid cols-3">
            {intake.referenceMedia.map((m) => (
              <div key={m.id} className="item-card">
                <MediaThumb media={m} alt={m.id} />
                <div className="card-body">
                  <p className="spec">{m.id} · {p.visual.refStatus[m.status]}</p>
                  {m.annotations?.map((a) => (
                    <p key={a.pinId} className="form-hint"><span className="pin-tag">{a.pinId}</span>{formatAnnotation(a, getDB().chipCatalog, locale, p.visual.parts)}</p>
                  ))}
                  {/* 즉시 전달 정책 — 어드민은 사후 숨김/복원만 */}
                  <div className="row-actions">
                    {m.status === "approved" ? (
                      <button className="button secondary small" onClick={() => reviewReferenceMedia(intake.id, m.id, "hidden")}>{t.hideRef}</button>
                    ) : (
                      <button className="button primary small" onClick={() => reviewReferenceMedia(intake.id, m.id, "approved")}>{t.showRef}</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 조달 요청 */}
      <div className="panel form-stack">
        <h3>{t.newPr}</h3>
        <PrForm orderId={order.id} suppliers={suppliers} t={t} />
        {listProcurements({ orderId }).map((pr) => (
          <p key={pr.id} className="form-hint">
            {pr.id} · {pr.type} · {suppliers.find((su) => su.id === pr.supplierId)?.name} · {pr.dueDate} · <span className={`status-badge prt-${pr.status}`}>{p.supplierP.status[pr.status]}</span>
            {pr.result && ` · ${prResultSummary(pr)}`}
          </p>
        ))}
      </div>

      {/* 다이아 후보 검수/공개 */}
      {candidates.length > 0 && (
        <div className="panel" style={{ overflowX: "auto" }}>
          <h3>{t.candidates} ({candidates.length})</h3>
          <table className="data-table">
            <thead><tr><th>ID</th><th>4C</th><th>{t.cost}</th><th>{t.review}</th><th>{t.custPrice}</th><th>{p.portal.availability.available}</th><th /></tr></thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} style={c.locked ? { background: "rgba(214,197,160,0.06)" } : undefined}>
                  <td style={{ whiteSpace: "nowrap" }}>{c.id}<br /><span className="form-hint">{c.igiNo}</span></td>
                  <td>{c.shape} {c.carat}ct {c.color}/{c.clarity} {c.growth}</td>
                  <td>{usd(c.procurementCostUsd)}</td>
                  <td>
                    <select value={c.internalReview || ""} onChange={(e) => reviewCandidate(c.id, e.target.value)}>
                      <option value="" disabled>—</option>
                      {["recommended", "alternate", "excluded"].map((r) => <option key={r} value={r}>{t.reviews[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    {c.published ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {usd(c.customerPriceUsd)}
                          {intake?.budget && c.customerPriceUsd > intake.budget && <span style={{ color: "#e08585", marginLeft: 6 }} title={`${t.budgetLabel} $${intake.budget}`}>⚠ {t.overBudget}</span>}
                        </span>
                        <button className="chip is-active" onClick={() => unpublishCandidate(c.id)}>{t.unpublish}</button>
                      </div>
                    ) : (
                      <input type="number" placeholder={t.pricePh} style={{ width: 132 }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); publishCandidate(c.id, Number(e.target.value)); } }} />
                    )}
                  </td>
                  <td>
                    <select value={c.availability} onChange={(e) => setCandidateAvailability(c.id, e.target.value)}>
                      {["available", "hold", "sold"].map((a) => <option key={a} value={a}>{p.portal.availability[a]}</option>)}
                    </select>
                  </td>
                  <td>
                    {c.locked ? <span className="status-badge cst-REPLACED">{t.locked}</span> :
                      c.clientSelection === "selected" && <button className="button primary small" onClick={() => lockCandidate(c.id)}>{t.lock}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 견적 */}
      <div className="panel form-stack">
        <h3>{t.quoteTitle}</h3>
        {quotes.map((q) => (
          <div key={q.id} className="feedback-note">
            <strong>{q.id}</strong> · {q.status} · {usd(q.totalUsd)} ({p.portal.deposit} {usd(q.depositUsd)} / {p.portal.balance} {usd(q.balanceUsd)})
            {intake?.budget && q.totalUsd > intake.budget && <span style={{ color: "#e08585", marginLeft: 6 }}>⚠ {t.overBudget} (${intake.budget})</span>}
            {q.actualWeightG && ` · actual ${q.actualWeightG}g`}
            {q.status === "draft" && <button className="button secondary small" style={{ marginLeft: 10 }} onClick={() => sendQuote(q.id)}>{t.send}</button>}
          </div>
        ))}
        {/* 수동 견적 빌더·정산 — 자동 견적이 대부분 처리하므로 접어둔다 */}
        {(order.selectedDiamondId || intake?.productLine === "multi" || acceptedQuote) && (
          <details>
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12.5, padding: "2px 0" }}>{t.advanced}</summary>
            <div style={{ marginTop: 12 }}>
              {order.selectedDiamondId || intake?.productLine === "multi" ? <QuoteBuilder order={order} settings={settings} t={t} /> : null}
              {acceptedQuote && (
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <input type="number" step="0.01" placeholder={t.actualWeight} value={actualW} onChange={(e) => setActualW(e.target.value)}
                    style={{ width: 150, background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--text)", padding: "9px 10px" }} />
                  <button className="button secondary small" disabled={!actualW} onClick={() => { recordActualWeight(order.id, Number(actualW)); setActualW(""); }}>{t.reconcile}</button>
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* 고급 — 마일스톤·CAD 이력·고객 액션·감사 로그 (평소엔 접어둔다) */}
      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", padding: "12px 2px", color: "var(--muted)", fontWeight: 600, letterSpacing: 1 }}>{t.advanced}</summary>

      {/* 마일스톤 보드 */}
      <div className="panel" style={{ overflowX: "auto", marginTop: 14 }}>
        <h3>{t.msTitle}</h3>
        <table className="data-table">
          <tbody>
            {MILESTONE_STAGES.map((stage) => {
              const m = milestones.find((x) => x.stage === stage);
              return (
                <tr key={stage}>
                  <th>{p.msStages[stage]}</th>
                  <td>
                    <select value={m?.status || "pending"} onChange={(e) => upsertMilestone(order.id, stage, { status: e.target.value })}>
                      {["pending", "inProgress", "waitingClient", "blocked", "done"].map((st) => <option key={st} value={st}>{p.msStatus[st]}</option>)}
                    </select>
                  </td>
                  <td>
                    <input defaultValue={m?.clientUpdate || ""} key={`${stage}-${m?.clientUpdate}`} placeholder="Client update"
                      onBlur={(e) => upsertMilestone(order.id, stage, { clientUpdate: e.target.value })} />
                  </td>
                  <td>
                    <button className={`chip ${m?.publishToClient ? "is-active" : ""}`}
                      onClick={() => upsertMilestone(order.id, stage, { publishToClient: !m?.publishToClient })}>
                      {t.publishClient}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CAD 리뷰 이력 */}
      {cads.length > 0 && (
        <div className="panel">
          <h3>{t.cadTitle}</h3>
          {cads.map((c) => (
            <div key={c.id} className="feedback-note">
              V{c.version} · {c.decision ? p.portal.cadDecided[c.decision] : p.msStatus.waitingClient}
              {c.feedback.length > 0 && ` · ${c.feedback.join(" / ")}`}
              {c.annotations?.length > 0 && c.annotations.map((a) => (
                <span key={a.pinId}> · <span className="pin-tag">{a.pinId}</span>{formatAnnotation(a, getDB().chipCatalog, locale, p.visual.parts)}</span>
              ))}
              {c.feeAppliedUsd > 0 && <span> · fee {usd(c.feeAppliedUsd)}</span>}
              {c.confirmedMeasurements && ` · ${c.confirmedMeasurements}`}
            </div>
          ))}
        </div>
      )}

      {/* 고객 액션 + 감사 로그 */}
      <div className="panel">
        <h3>{t.actionsTitle}</h3>
        {actions.length === 0 ? <p className="form-hint">—</p> : actions.map((a) => (
          <p key={a.id} className="form-hint">{a.id} · {a.type} · {a.status}{a.response && ` → ${a.response}`}</p>
        ))}
      </div>
      <div className="panel">
        <h3>{t.auditTitle}</h3>
        {auditRows.map((a) => (
          <p key={a.id} className="form-hint">{a.at.slice(5, 16)} · {a.actor} · {a.field}: {String(a.before ?? "∅")} → {String(a.after ?? "∅")}</p>
        ))}
      </div>
      </details>
    </div>
  );
}
