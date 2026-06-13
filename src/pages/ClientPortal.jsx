import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import {
  acceptQuote, confirmFinal, decideCad, listCustomerActions, portalView, respondCustomerAction, selectCandidate,
} from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { EmptyNote, MediaThumb, usd } from "../components/ui.jsx";
import PinAnnotator from "../components/PinAnnotator.jsx";
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

// 타임라인 체크포인트 래퍼 — done은 접고, active만 펼친다
function Checkpoint({ index, title, state, summary, children }) {
  const { p } = useLocale();
  const t2 = p.visual;
  const badge = state === "done" ? t2.doneTag : state === "active" ? t2.nowAction : t2.upcoming;
  return (
    <div className={`panel checkpoint ${state}`}>
      <div className="proposal-head">
        <h3 style={{ margin: 0 }}>{state === "done" ? "✓" : index} · {title}</h3>
        <span className={`status-badge ${state === "active" ? "mst-waitingClient" : state === "done" ? "mst-done" : "mst-pending"}`}>{badge}</span>
      </div>
      {state === "done" && summary && <p className="form-hint">{summary}</p>}
      {state === "active" && children}
    </div>
  );
}

// 체크포인트 ② 디자인 — 비교 뷰 + 핀 수정요청. 자유 텍스트 입력 없음.
function DesignCard({ cad, mineMedia, orderId, actor, revisionsLeft, feeUsd, defaultMeasure }) {
  const { p } = useLocale();
  const t = p.portal;
  const t2 = p.visual;
  const [revising, setRevising] = useState(false);
  const [ann, setAnn] = useState([]);
  const [measure, setMeasure] = useState(defaultMeasure || ""); // 인테이크에서 받은 사이즈로 프리필 — 재입력 불필요
  // 핀은 정지 이미지에만 찍는다 — 대표 파일이 영상이면 슬롯 중 첫 이미지를 주석 캔버스로 사용
  const pinSrc = [cad.fileUrl, ...(cad.media || []).map((m) => m.src)].find((s) => s && !s.endsWith(".mp4")) || cad.fileUrl;

  function send(decision) {
    decideCad(cad.id, {
      decision, annotations: decision === "minorRevision" ? ann : [],
      annotatedSrc: decision === "minorRevision" ? pinSrc : "", confirmedMeasurements: measure,
    }, actor);
    const ca = listCustomerActions(orderId, true).find((a) => a.type === "cadReview");
    if (ca) respondCustomerAction(ca.id, decision, actor);
    setRevising(false); setAnn([]);
  }
  const annComplete = ann.length > 0 && ann.every((a) => a.chipKey);

  return (
    <>
      <div className="split-compare">
        <div>
          <p className="label">{t2.compareMine}</p>
          <MediaThumb media={mineMedia} ratio="4 / 3" alt={t2.compareMine} />
        </div>
        <div>
          <p className="label">{t2.compareVendor} — {t.cadVersion(cad.version)}</p>
          {revising
            ? <PinAnnotator src={pinSrc} annotations={ann} onChange={setAnn} />
            : <MediaThumb media={{ kind: cad.fileUrl.endsWith(".mp4") ? "video" : "image", src: cad.fileUrl }} ratio="4 / 3" alt={t.cadTitle} />}
        </div>
      </div>
      {cad.media?.length > 1 && (
        <div className="card-grid cols-3" style={{ marginTop: 10 }}>
          {cad.media.map((m) => (
            <div key={m.slot}>
              <p className="label">{t2.slots[m.slot] || m.slot}</p>
              <MediaThumb media={m} alt={m.slot} />
            </div>
          ))}
        </div>
      )}
      {!cad.decision && (
        <div className="form-stack" style={{ marginTop: 14 }}>
          <label className="field"><span>{t.cadMeasure}</span>
            <input value={measure} onChange={(e) => setMeasure(e.target.value)} /></label>
          <p className="form-hint">{revisionsLeft > 0 ? t2.revisionsLeft(revisionsLeft) : t2.feeNote(feeUsd)}</p>
          <div className="row-actions">
            <button className="button primary small" onClick={() => send("approved")}>{t2.approveCta}</button>
            {!revising
              ? <button className="button secondary small" onClick={() => setRevising(true)}>{t2.reviseCta}</button>
              : <button className="button secondary small" disabled={!annComplete} onClick={() => send("minorRevision")}>{t2.sendRevision}</button>}
          </div>
        </div>
      )}
      {cad.decision === "minorRevision" && <p className="form-hint" style={{ marginTop: 10 }}>{t.cadDecided.minorRevision}</p>}
    </>
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
  const { order, intake, style, candidates, selected, quote, milestones, cad, freeRevisionsLeft, designChangeFeeUsd, finalAction } = view;

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

  // 타임라인 체크포인트 상태 — 스톤(솔리테어만) → 디자인 → 최종 실물
  // 선택했지만 아직 벤더 재고 확인(자동 락) 전이면 "확인 중" 상태로 유지
  const stoneState = order.selectedDiamondId ? "done"
    : order.status === "STONE_SELECTION" ? "active" : "upcoming";
  const stockChecking = !order.selectedDiamondId && anySelected;
  const designState = cad?.decision === "approved" ? "done" : cad && !cad.decision ? "active" : "upcoming";
  const finalState = finalAction ? "active"
    : ["BALANCE", "SHIPPING", "DELIVERED", "ARCHIVED"].includes(order.status) ? "done" : "upcoming";
  const approvedRef = intake?.referenceMedia?.find((m) => m.status === "approved");
  const mineMedia = approvedRef
    ? { kind: approvedRef.kind, src: approvedRef.src }
    : style ? { kind: "image", src: style.coverImage } : null;
  const showStone = intake?.productLine === "solitaire";
  // 인테이크에서 이미 받은 치수 — CAD 승인 화면 "치수 확인"을 프리필해 재입력을 없앤다
  const cond = intake?.conditional || {};
  const defaultMeasure = cond.ringSize || cond.chainLength || cond.wristSize || cond.earringDetails || "";

  // 4페이즈 진행 요약 — 13개 마일스톤 대신 고객이 이해하는 단계로 묶는다 (order.status 기준)
  const RANK = { STYLE_SELECTION: 0, STONE_SELECTION: 1, QUOTATION: 2, CAD: 3, PRODUCTION: 4, QC: 5, BALANCE: 6, SHIPPING: 7, DELIVERED: 8, ARCHIVED: 9 };
  const r = RANK[order.status] ?? 0;
  const phaseDefs = [
    { key: "stone", done: r >= 2, active: r === 1, stages: ["diamondLocked"] },
    { key: "design", done: r >= 4, active: r === 2 || r === 3, stages: ["depositReceived", "cadIssued", "cadApproved"] },
    { key: "crafting", done: r >= 6, active: r === 4 || r === 5, stages: ["productionStarted", "settingPolishing", "finalQcVideo", "igiInscriptionVerified", "actualMetalReconciled"] },
    { key: "delivery", done: r >= 8, active: r === 6 || r === 7, stages: ["balanceReceived", "sentDomesticWarehouse", "oceanShipment", "deliveredArchived"] },
  ];
  // 각 페이즈의 최신 공개 마일스톤 메모(운송장 번호 등)를 노트로 노출
  const phaseNote = (stages) => {
    const ms = milestones.filter((m) => stages.includes(m.stage) && (m.clientUpdate || m.clientAction));
    const last = ms[ms.length - 1];
    if (!last) return "";
    const note = [last.clientUpdate, last.clientAction].filter(Boolean).join(" — ");
    return /^\d+(\.\d+)?\s*g$/.test(note) ? t.phaseWeightDone : note; // 실중량 raw("4.35g")는 친절한 문구로
  };

  // 고객용 "다음 단계" 한 줄 — 어드민의 next-step 카드를 고객에게도 (문의 감소)
  const nextMsg = (order.status === "QUOTATION" && quote?.status === "accepted") ? t.nextDeposit
    : (order.status === "CAD" && cad && !cad.decision) ? t.nextCadReview
      : t.nextStep?.[order.status] || "";

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <h1 className="page-title">{order.id}</h1>
      <p className="page-sub">
        {style && <>{style.id} — {pickI18n(style.name, locale)} · </>}
        {order.requiredDate && <>{t.requiredDate}: {order.requiredDate} · </>}
        <span className={`status-badge ost-${order.status}`}>{t.statusLabel?.[order.status] || p.orderStatus[order.status]}</span>
      </p>

      {/* 고객용 다음 단계 안내 — "이제 뭘 기다리지?"를 없앤다 */}
      {nextMsg && (
        <div className="panel" style={{ borderColor: "rgba(214,197,160,0.5)", background: "rgba(214,197,160,0.05)", padding: "14px 18px" }}>
          <span style={{ color: "var(--accent-bright)", letterSpacing: 1, fontSize: 12 }}>{p.visual.nowAction}</span>
          <p style={{ margin: "4px 0 0" }}>{nextMsg}</p>
        </div>
      )}

      {/* 체크포인트 ① 스톤 (published 후보만) */}
      {showStone && (
        <Checkpoint index={1} title={p.visual.checkpoint.stone} state={stoneState}
          summary={selected && `${p.shapes[selected.shape] || selected.shape} ${selected.carat?.toFixed(2)}ct · ${selected.igiNo}`}>
          {stockChecking && <p className="warn-note" style={{ marginBottom: 14 }}>{p.visual.stockChecking}</p>}
          {candidates.length > 0 && (
            <>
              <p className="form-hint" style={{ marginBottom: 14 }}>{t.optionsLabel(candidates.length)} · {t.batchNote}</p>
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
            </>
          )}
        </Checkpoint>
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

      {/* 체크포인트 ② 디자인 */}
      <Checkpoint index={2} title={p.visual.checkpoint.design} state={designState}
        summary={cad?.decision === "approved" ? `${t.cadVersion(cad.version)} ✓` : null}>
        {cad && <DesignCard cad={cad} mineMedia={mineMedia} orderId={orderId} actor={actor}
          revisionsLeft={freeRevisionsLeft} feeUsd={designChangeFeeUsd} defaultMeasure={defaultMeasure} />}
      </Checkpoint>

      {/* 체크포인트 ③ 최종 실물 컨펌 */}
      <Checkpoint index={3} title={p.visual.checkpoint.final} state={finalState}
        summary={finalState === "done" ? p.visual.finalConfirmed : null}>
        {finalAction && (
          <div className="form-stack">
            <h3 style={{ margin: 0 }}>{p.visual.finalTitle}</h3>
            {finalAction.link && (
              <MediaThumb media={{ kind: finalAction.link.endsWith(".mp4") ? "video" : "image", src: finalAction.link }} ratio="16 / 9" alt={p.visual.finalTitle} />
            )}
            <p className="warn-note">{p.visual.finalNotice}</p>
            <button className="button primary" onClick={() => confirmFinal(orderId, actor)}>{p.visual.finalConfirm}</button>
          </div>
        )}
      </Checkpoint>

      {/* 진행 상황 — 4페이즈 요약 (스톤→디자인→제작→배송) */}
      <div className="panel">
        <h3>{t.progressTitle}</h3>
        <table className="data-table"><tbody>
          {phaseDefs.map((ph) => {
            const status = ph.done ? "done" : ph.active ? "inProgress" : "pending";
            const note = phaseNote(ph.stages);
            return (
              <tr key={ph.key}>
                <th>{t.phases[ph.key]}</th>
                <td><span className={`status-badge mst-${status}`}>{p.msStatus[status]}</span></td>
                <td>{note}</td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
    </div>
  );
}
