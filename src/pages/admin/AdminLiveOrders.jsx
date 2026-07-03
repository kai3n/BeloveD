// 실주문(BD-) 콘솔 — Postgres 주문을 목록/상세로 운영한다.
// 이벤트 버튼 하나 = stage 전이 + (선택) 아티팩트/고객 컨펌 발행 + 상태 메일(고객 언어) 발송.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, ApiUnavailableError } from "../../lib/api.js";
import { MediaPicker, MediaThumb, usd } from "../../components/ui.jsx";
import { getOpsStyle } from "../../lib/store.js";
import { pickI18n, useLocale } from "../../i18n.jsx";

// 견적 컴포저 셀렉트 옵션 · 메탈 코드 → 라벨 (인테이크 프리필용)
const SHAPES = ["round", "oval", "cushion", "princess", "emerald", "pear", "marquise", "radiant", "asscher", "heart"];
const COLORS = ["D", "E", "F", "G", "H", "I"];
const CLARITIES = ["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2"];
const METAL_LABELS = {
  "18kw": "18K White Gold", "18ky": "18K Yellow Gold", "18kr": "18K Rose Gold",
  "14kw": "14K White Gold", "14ky": "14K Yellow Gold", "14kr": "14K Rose Gold",
  pt950: "Platinum 950",
};

const COPY = {
  en: {
    title: "Live orders", kicker: "REAL-SERVER ORDERS",
    liveSection: "Live orders", pastSection: "Past orders", total: "Total",
    emptyPast: "No delivered orders yet — completed orders and revenue land here.",
    statRevenue: "Total revenue", statDelivered: "Delivered orders", statAvg: "Average order", statPipeline: "Open pipeline (quoted)",
    empty: "No live orders yet — they appear the moment a customer submits the wizard.",
    needAuth: "This console needs a server admin session. Sign in again through the admin gate.",
    unavailable: "API unreachable — run the local API server or check the deployment.",
    customer: "Customer", stage: "Stage", waiting: "Waiting on", updated: "Updated", category: "Category",
    back: "← Live orders", intake: "Request", budget: "Budget", requiredDate: "Requested date",
    referenceMedia: "Customer references", console: "Move the order forward",
    consoleHint: "Each step advances the stage and emails the customer in their language.",
    artifacts: "Published to customer", actions: "Customer confirmations", timeline: "Timeline",
    note: "Customer note", total: "Total ($)", igi: "IGI No.", tracking: "Tracking no.",
    stoneSpec: "Stone spec", metalSpec: "Metal spec",
    settingSummary: "Setting & design summary", estWeight: "Est. metal weight (g)", leadDays: "Production lead (business days)",
    designNote: "Design adjustment note", centerStone: "Center stone (one component of the piece)",
    shape: "shape", caratMin: "carat (min)", caratMax: "carat (max)", color: "color", clarity: "clarity", growth: "growth", lab: "lab",
    subNote: "Stone substitution note (blank = default policy text)", deposit: "Deposit ($, blank = 30%)",
    media: "Media (published to the portal)",
    fire: "Send", done: "Done", current: "Current", sentLabel: "Sent ✓",
    waitingOn: { CUSTOMER: "Customer", BELOVEDIAMOND: "BeloveD", EXTERNAL: "Carrier", NONE: "—" },
    steps: {
      proposal_sent: "Send the proposal", deposit_confirmed: "Deposit received",
      diamond_locked: "Diamond secured", production_started: "Production started",
      qc_ready: "Send finished-piece QC", balance_requested: "Request the balance",
      shipped: "Shipped", delivered: "Delivered",
    },
    sent: "Event sent — the customer has been emailed.",
  },
  ko: {
    title: "실주문", kicker: "실서버 주문",
    liveSection: "진행 중 주문", pastSection: "지난 주문", total: "총액",
    emptyPast: "완료된 주문이 아직 없습니다 — 배송 완료된 주문과 매출이 여기에 쌓입니다.",
    statRevenue: "총 매출", statDelivered: "완료 주문", statAvg: "평균 주문액", statPipeline: "진행 중 견적 총액",
    empty: "아직 실주문이 없습니다 — 고객이 위저드를 제출하면 바로 나타납니다.",
    needAuth: "이 콘솔은 서버 어드민 세션이 필요합니다. 어드민 게이트에서 다시 로그인해 주세요.",
    unavailable: "API에 연결할 수 없습니다 — 로컬 API 서버를 켜거나 배포 상태를 확인하세요.",
    customer: "고객", stage: "단계", waiting: "대기", updated: "업데이트", category: "카테고리",
    back: "← 실주문 목록", intake: "요청 내용", budget: "예산", requiredDate: "희망일",
    referenceMedia: "고객 레퍼런스", console: "주문 진행",
    consoleHint: "각 단계는 stage를 전이시키고 고객 언어로 상태 메일을 보냅니다.",
    artifacts: "고객에게 발행됨", actions: "고객 컨펌", timeline: "타임라인",
    note: "고객 노트", total: "총액 ($)", igi: "IGI 번호", tracking: "운송장 번호",
    stoneSpec: "스톤 스펙", metalSpec: "메탈 스펙",
    settingSummary: "세팅·디자인 요약", estWeight: "예상 메탈 중량 (g)", leadDays: "제작 기간 (영업일)",
    designNote: "디자인 조정 노트", centerStone: "센터 스톤 (제품 구성 요소)",
    shape: "셰이프", caratMin: "캐럿 (min)", caratMax: "캐럿 (max)", color: "컬러", clarity: "클래리티", growth: "성장", lab: "감정기관",
    subNote: "스톤 대체 안내 (비우면 기본 문구)", deposit: "디파짓 ($, 비우면 30%)",
    media: "미디어 (포털에 공개)",
    fire: "보내기", done: "완료", current: "현재", sentLabel: "보냄 ✓",
    waitingOn: { CUSTOMER: "고객", BELOVEDIAMOND: "BeloveD", EXTERNAL: "운송사", NONE: "—" },
    steps: {
      proposal_sent: "제안 발송", deposit_confirmed: "디파짓 수령",
      diamond_locked: "다이아 확보", production_started: "제작 시작",
      qc_ready: "완성품 QC 발송", balance_requested: "잔금 요청",
      shipped: "발송됨", delivered: "수령 완료",
    },
    sent: "이벤트가 반영됐습니다 — 고객에게 메일이 발송됩니다.",
  },
  zh: {
    title: "实时订单", kicker: "真实服务器订单",
    liveSection: "进行中订单", pastSection: "历史订单", total: "总价",
    emptyPast: "暂无已完成订单 — 已交付订单与收入将显示在这里。",
    statRevenue: "总收入", statDelivered: "已完成订单", statAvg: "平均订单额", statPipeline: "进行中报价总额",
    empty: "暂无实时订单 — 客户提交向导后会立即出现。",
    needAuth: "此控制台需要服务器管理员会话，请通过管理入口重新登录。",
    unavailable: "无法连接 API — 请启动本地 API 服务器或检查部署。",
    customer: "客户", stage: "阶段", waiting: "等待方", updated: "更新", category: "类别",
    back: "← 实时订单", intake: "请求内容", budget: "预算", requiredDate: "期望日期",
    referenceMedia: "客户参考图", console: "推进订单",
    consoleHint: "每一步都会推进阶段，并以客户语言发送状态邮件。",
    artifacts: "已向客户发布", actions: "客户确认", timeline: "时间线",
    note: "客户备注", total: "总价 ($)", igi: "IGI 编号", tracking: "运单号",
    stoneSpec: "钻石规格", metalSpec: "金属规格",
    settingSummary: "镶嵌·设计摘要", estWeight: "预估金属重量 (g)", leadDays: "制作周期（工作日）",
    designNote: "设计调整备注", centerStone: "中心钻石（作品部件之一）",
    shape: "形状", caratMin: "克拉 (min)", caratMax: "克拉 (max)", color: "颜色", clarity: "净度", growth: "生长方式", lab: "鉴定机构",
    subNote: "替代说明（留空用默认文案）", deposit: "定金（$，留空按 30%）",
    media: "媒体（发布到订单页面）",
    fire: "发送", done: "完成", current: "当前", sentLabel: "已发送 ✓",
    waitingOn: { CUSTOMER: "客户", BELOVEDIAMOND: "BeloveD", EXTERNAL: "承运商", NONE: "—" },
    steps: {
      proposal_sent: "发送方案", deposit_confirmed: "已收定金",
      diamond_locked: "钻石已锁定", production_started: "开始制作",
      qc_ready: "发送成品质检", balance_requested: "请求尾款",
      shipped: "已发货", delivered: "已送达",
    },
    sent: "事件已生效 — 已向客户发送邮件。",
  },
  es: {
    title: "Pedidos en vivo", kicker: "PEDIDOS DEL SERVIDOR",
    liveSection: "Pedidos activos", pastSection: "Pedidos pasados", total: "Total",
    emptyPast: "Aún no hay pedidos entregados — los completados y los ingresos aparecerán aquí.",
    statRevenue: "Ingresos totales", statDelivered: "Pedidos entregados", statAvg: "Pedido promedio", statPipeline: "Pipeline abierto (cotizado)",
    empty: "Aún no hay pedidos en vivo — aparecen cuando un cliente envía el asistente.",
    needAuth: "Esta consola requiere sesión de administrador del servidor. Inicia sesión de nuevo por la puerta admin.",
    unavailable: "API inalcanzable — inicia el servidor local o revisa el despliegue.",
    customer: "Cliente", stage: "Etapa", waiting: "Esperando a", updated: "Actualizado", category: "Categoría",
    back: "← Pedidos en vivo", intake: "Solicitud", budget: "Presupuesto", requiredDate: "Fecha deseada",
    referenceMedia: "Referencias del cliente", console: "Avanzar el pedido",
    consoleHint: "Cada paso avanza la etapa y envía un correo al cliente en su idioma.",
    artifacts: "Publicado al cliente", actions: "Confirmaciones del cliente", timeline: "Cronología",
    note: "Nota al cliente", total: "Total ($)", igi: "N.º IGI", tracking: "N.º de guía",
    stoneSpec: "Especif. de piedra", metalSpec: "Especif. de metal",
    settingSummary: "Resumen de engaste y diseño", estWeight: "Peso est. del metal (g)", leadDays: "Plazo de producción (días hábiles)",
    designNote: "Nota de ajuste de diseño", centerStone: "Piedra central (componente de la pieza)",
    shape: "forma", caratMin: "quilates (min)", caratMax: "quilates (max)", color: "color", clarity: "claridad", growth: "crecimiento", lab: "laboratorio",
    subNote: "Nota de sustitución (vacío = texto por defecto)", deposit: "Depósito ($, vacío = 30%)",
    media: "Medios (publicados al portal)",
    fire: "Enviar", done: "Hecho", current: "Actual", sentLabel: "Enviado ✓",
    waitingOn: { CUSTOMER: "Cliente", BELOVEDIAMOND: "BeloveD", EXTERNAL: "Transportista", NONE: "—" },
    steps: {
      proposal_sent: "Enviar la propuesta", deposit_confirmed: "Depósito recibido",
      diamond_locked: "Diamante asegurado", production_started: "Producción iniciada",
      qc_ready: "Enviar QC de la pieza", balance_requested: "Solicitar el saldo",
      shipped: "Enviado", delivered: "Entregado",
    },
    sent: "Evento aplicado — se envió el correo al cliente.",
  },
};

// 스테이지 순서 — 각 이벤트가 도달시키는 stage (완료/현재 표시용)
const FLOW = [
  { type: "proposal_sent", reaches: "QUOTE", media: "proposal", artifactType: "QUOTE", composer: "proposal", fields: ["note", "total"], action: { kind: "QUOTE_ACCEPTANCE", allowedResponses: ["APPROVE", "REQUEST_CHANGES"] } },
  { type: "deposit_confirmed", reaches: "CAD" },
  { type: "diamond_locked", reaches: "CAD", fields: ["igi"] },
  { type: "production_started", reaches: "PRODUCTION" },
  { type: "qc_ready", reaches: "FINAL_QC", media: "qc", artifactType: "QC", fields: ["note"], action: { kind: "FINAL_QC_CONFIRMATION", allowedResponses: ["CONFIRM", "REQUEST_CHANGES"] } },
  { type: "balance_requested", reaches: "BALANCE" },
  { type: "shipped", reaches: "SHIPPING", fields: ["tracking"] },
  { type: "delivered", reaches: "DELIVERED" },
];
const STAGE_ORDER = ["OPS_REVIEW", "STONE_SELECTION", "QUOTE", "DEPOSIT", "CAD", "PRODUCTION", "FINAL_QC", "BALANCE", "SHIPPING", "DELIVERED"];

function useCopy() {
  const { locale } = useLocale();
  return COPY[locale] || COPY.en;
}

function ErrorPanel({ error, t }) {
  return <div className="panel"><p className="form-hint">{error === "auth" ? t.needAuth : t.unavailable}</p></div>;
}

function fetchState(setter) {
  return (e) => setter({ status: e instanceof ApiUnavailableError ? "unavailable" : "auth", data: null });
}

// 완료 상태 — Past Orders 섹션으로 분류되는 stage
const PAST_STAGES = new Set(["DELIVERED", "CANCELLED"]);

function OrdersTable({ orders, t, navigate, withTotal = false }) {
  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th><th>{t.customer}</th><th>{t.category}</th><th>{t.stage}</th>
            {withTotal ? <th>{t.total}</th> : <th>{t.waiting}</th>}
            <th>{t.updated}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.orderCode}
              className="row-clickable"
              onClick={() => navigate(`/admin/live/${o.orderCode}`)}
            >
              <td><Link className="text-link" to={`/admin/live/${o.orderCode}`} onClick={(e) => e.stopPropagation()}><strong>{o.orderCode}</strong></Link></td>
              <td>{o.customerName || o.customerEmail}<br /><span className="form-hint">{o.customerEmail} · {o.locale}</span></td>
              <td>{o.intake?.category || o.summary?.category || "—"}</td>
              <td><span className={`status-badge ${o.stage === "DELIVERED" ? "mst-done" : "mst-inProgress"}`}>{o.stage}</span></td>
              {withTotal
                ? <td>{o.totalUsd ? usd(o.totalUsd) : "—"}</td>
                : <td>{t.waitingOn[o.waitingOn] || o.waitingOn}</td>}
              <td>{new Date(o.updatedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminLiveOrders() {
  const t = useCopy();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    apiFetch("/admin/orders")
      .then((d) => setState({ status: "ok", data: d.orders }))
      .catch(fetchState(setState));
  }, []);

  if (state.status === "loading") return <div className="panel"><p className="form-hint">…</p></div>;
  if (state.status !== "ok") return <ErrorPanel error={state.status} t={t} />;

  const live = state.data.filter((o) => !PAST_STAGES.has(o.stage));
  const past = state.data.filter((o) => PAST_STAGES.has(o.stage));
  const delivered = past.filter((o) => o.stage === "DELIVERED");
  const revenue = delivered.reduce((s, o) => s + (o.totalUsd || 0), 0);
  const pipeline = live.reduce((s, o) => s + (o.totalUsd || 0), 0);

  return (
    <div className="form-stack">
      <p className="admin-kicker">{t.kicker} · {t.liveSection}</p>
      {live.length === 0
        ? <div className="panel"><p className="form-hint">{t.empty}</p></div>
        : <OrdersTable orders={live} t={t} navigate={navigate} />}

      <p className="admin-kicker" style={{ marginTop: 18 }}>{t.pastSection}</p>
      <div className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="summary-card"><div className="num">{usd(revenue)}</div><div className="lbl">{t.statRevenue}</div></div>
        <div className="summary-card"><div className="num">{delivered.length}</div><div className="lbl">{t.statDelivered}</div></div>
        <div className="summary-card"><div className="num">{delivered.length ? usd(revenue / delivered.length) : "—"}</div><div className="lbl">{t.statAvg}</div></div>
        <div className="summary-card"><div className="num">{usd(pipeline)}</div><div className="lbl">{t.statPipeline}</div></div>
      </div>
      {past.length === 0
        ? <div className="panel"><p className="form-hint">{t.emptyPast}</p></div>
        : <OrdersTable orders={past} t={t} navigate={navigate} withTotal />}
    </div>
  );
}

// 이벤트 스텝 카드 — 필요한 입력(미디어/노트/금액/IGI/운송장)만 노출
function StepCard({ step, order, t, onSent }) {
  const [media, setMedia] = useState([]);
  // 견적 컴포저는 인테이크에서 프리필 — 어드민은 확인·수정만 하고 보낸다
  const fp = order.intake?.formPayload || {};
  const sp = fp.stonePrefs || {};
  const style = fp.styleId ? getOpsStyle(fp.styleId) : null;
  const [f, setF] = useState({
    note: "", total: "", igi: "", tracking: "",
    setting: [
      style ? pickI18n(style.name, "en") : (order.intake?.category || ""),
      fp.conditional?.ringSize,
    ].filter(Boolean).join(" · "),
    designNote: "",
    metalSpec: METAL_LABELS[fp.metal] || fp.metal || "",
    estWeightG: "", leadDays: "10",
    shape: sp.shape || "round",
    caratMin: sp.carat ? String(sp.carat) : "",
    caratMax: sp.carat ? (Number(sp.carat) + 0.05).toFixed(2) : "",
    color: sp.color || "D", clarity: sp.clarity || "VS1", growth: sp.growth || "CVD",
    lab: "IGI", igiNo: "", subNote: "", deposit: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 한 번 보낸 스텝은 잠근다 — 중복 발송(중복 메일·중복 컨펌)이 재발송 필요보다 훨씬 흔한 사고다
  const stageIdx = STAGE_ORDER.indexOf(order.stage);
  const reachIdx = STAGE_ORDER.indexOf(step.reaches);
  const done = stageIdx >= reachIdx;

  async function fire() {
    setBusy(true);
    setError("");
    try {
      const body = { type: step.type, data: {} };
      if (step.fields?.includes("igi") && f.igi.trim()) body.data.igi = f.igi.trim();
      if (step.fields?.includes("tracking") && f.tracking.trim()) body.data.tracking = f.tracking.trim();
      if (step.artifactType) {
        body.artifact = {
          type: step.artifactType,
          media: media.filter((m) => /^https?:\/\//.test(m.src || "")).slice(0, 5),
          payload: step.composer === "proposal"
            ? {
              ...(f.setting.trim() ? { settingSummary: f.setting.trim() } : {}),
              ...(f.designNote.trim() ? { designNote: f.designNote.trim() } : {}),
              ...(f.metalSpec.trim() ? { metalSpec: f.metalSpec.trim() } : {}),
              ...(f.estWeightG ? { estWeightG: Number(f.estWeightG) } : {}),
              ...(f.leadDays ? { leadDays: Number(f.leadDays) } : {}),
              stone: {
                shape: f.shape, color: f.color, clarity: f.clarity, growth: f.growth, lab: f.lab,
                ...(f.caratMin ? { caratMin: Number(f.caratMin) } : {}),
                ...(f.caratMax ? { caratMax: Number(f.caratMax) } : {}),
                ...(f.igiNo.trim() ? { igiNo: f.igiNo.trim() } : {}),
              },
              ...(f.subNote.trim() ? { substitutionNote: f.subNote.trim() } : {}),
              ...(f.note.trim() ? { note: f.note.trim() } : {}),
              ...(f.total ? { totalUsd: Number(f.total) } : {}),
              ...(f.deposit ? { depositUsd: Number(f.deposit) } : {}),
            }
            : {
              ...(f.note.trim() ? { note: f.note.trim() } : {}),
              ...(f.total ? { totalUsd: Number(f.total) } : {}),
            },
        };
      }
      if (step.action) {
        body.action = { ...step.action, title: t.steps[step.type] };
      }
      await apiFetch(`/admin/orders/${order.orderCode}/events`, { method: "POST", body });
      onSent();
    } catch (e) {
      setError(e.code || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel form-stack" style={done ? { opacity: 0.55 } : undefined}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <strong>{t.steps[step.type]}</strong>
        {done
          ? <span className="status-badge mst-done">{t.done}</span>
          : <span className="status-badge mst-pending">{step.reaches}</span>}
      </div>
      {(
        <>
          {step.media && (
            <div className="field"><span>{t.media}</span>
              <MediaPicker value={media} onChange={setMedia} maxItems={5} showSamples={false} previewMode="list" scope={step.media} />
            </div>
          )}
          {step.composer === "proposal" && (
            <>
              <div className="filter-grid" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                <label className="field"><span>{t.settingSummary}</span>
                  <input value={f.setting} onChange={(e) => setF({ ...f, setting: e.target.value })} /></label>
                <label className="field"><span>{t.estWeight}</span>
                  <input type="number" step="0.1" value={f.estWeightG} onChange={(e) => setF({ ...f, estWeightG: e.target.value })} /></label>
                <label className="field"><span>{t.leadDays}</span>
                  <input type="number" value={f.leadDays} onChange={(e) => setF({ ...f, leadDays: e.target.value })} /></label>
              </div>
              <label className="field"><span>{t.designNote}</span>
                <input value={f.designNote} onChange={(e) => setF({ ...f, designNote: e.target.value })} /></label>
              <label className="field"><span>{t.metalSpec}</span>
                <input value={f.metalSpec} onChange={(e) => setF({ ...f, metalSpec: e.target.value })} /></label>
              <p className="form-hint" style={{ margin: 0 }}>{t.centerStone}</p>
              <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <label className="field"><span>{t.shape}</span>
                  <select value={f.shape} onChange={(e) => setF({ ...f, shape: e.target.value })}>
                    {SHAPES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select></label>
                <label className="field"><span>{t.caratMin}</span>
                  <input type="number" step="0.01" value={f.caratMin} onChange={(e) => setF({ ...f, caratMin: e.target.value })} /></label>
                <label className="field"><span>{t.caratMax}</span>
                  <input type="number" step="0.01" value={f.caratMax} onChange={(e) => setF({ ...f, caratMax: e.target.value })} /></label>
                <label className="field"><span>{t.color}</span>
                  <select value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })}>
                    {COLORS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select></label>
              </div>
              <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <label className="field"><span>{t.clarity}</span>
                  <select value={f.clarity} onChange={(e) => setF({ ...f, clarity: e.target.value })}>
                    {CLARITIES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select></label>
                <label className="field"><span>{t.growth}</span>
                  <select value={f.growth} onChange={(e) => setF({ ...f, growth: e.target.value })}>
                    <option value="CVD">CVD</option><option value="HPHT">HPHT</option>
                  </select></label>
                <label className="field"><span>{t.lab}</span>
                  <select value={f.lab} onChange={(e) => setF({ ...f, lab: e.target.value })}>
                    <option value="IGI">IGI</option><option value="GIA">GIA</option>
                  </select></label>
                <label className="field"><span>{t.igi}</span>
                  <input value={f.igiNo} onChange={(e) => setF({ ...f, igiNo: e.target.value })} /></label>
              </div>
              <label className="field"><span>{t.subNote}</span>
                <textarea rows={2} value={f.subNote} onChange={(e) => setF({ ...f, subNote: e.target.value })} /></label>
            </>
          )}
          {step.fields?.includes("note") && (
            <label className="field"><span>{t.note}</span>
              <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          )}
          <div className="filter-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {step.fields?.includes("total") && (
              <label className="field"><span>{t.total}</span>
                <input type="number" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></label>
            )}
            {step.composer === "proposal" && (
              <label className="field"><span>{t.deposit}</span>
                <input type="number" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} /></label>
            )}
            {step.fields?.includes("igi") && (
              <label className="field"><span>{t.igi}</span>
                <input value={f.igi} onChange={(e) => setF({ ...f, igi: e.target.value })} /></label>
            )}
            {step.fields?.includes("tracking") && (
              <label className="field"><span>{t.tracking}</span>
                <input value={f.tracking} onChange={(e) => setF({ ...f, tracking: e.target.value })} /></label>
            )}
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className={`button ${done ? "secondary" : "primary"} small`} type="button" disabled={busy || done} onClick={fire}>
            {done ? t.sentLabel : t.fire}
          </button>
        </>
      )}
    </div>
  );
}

export function AdminLiveOrderDetail() {
  const t = useCopy();
  const { orderCode } = useParams();
  const [state, setState] = useState({ status: "loading", data: null });
  const [notice, setNotice] = useState("");

  function load() {
    apiFetch(`/admin/orders/${orderCode}`)
      .then((d) => setState({ status: "ok", data: d }))
      .catch(fetchState(setState));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [orderCode]);

  const intakeRows = useMemo(() => {
    if (state.status !== "ok") return [];
    const { order } = state.data;
    const fp = order.intake?.formPayload || {};
    const sp = fp.stonePrefs || {};
    return [
      [t.category, [order.intake?.category, fp.productLine].filter(Boolean).join(" · ")],
      ["Stone", [sp.shape, sp.carat && `${sp.carat}ct`, sp.color, sp.clarity, sp.growth].filter(Boolean).join(" · ")],
      ["Fit", Object.entries(fp.conditional || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")],
      [t.budget, order.intake?.budgetMinorUnits ? usd(order.intake.budgetMinorUnits / 100) : "—"],
      [t.requiredDate, order.intake?.requiredDate ? String(order.intake.requiredDate).slice(0, 10) : "—"],
    ].filter(([, v]) => v && v !== "—");
  }, [state, t]);

  if (state.status === "loading") return <div className="panel"><p className="form-hint">…</p></div>;
  if (state.status !== "ok") return <ErrorPanel error={state.status} t={t} />;

  const { order, timeline, artifacts, actions } = state.data;
  const refMedia = order.intake?.referenceMedia || [];

  return (
    <div className="form-stack">
      <p><Link className="text-link" to="/admin/live">{t.back}</Link></p>
      <div className="panel" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="admin-kicker">{t.kicker}</p>
          <h2 style={{ margin: "2px 0 6px" }}>{order.orderCode} <span className="status-badge mst-inProgress">{order.stage}</span></h2>
          <p className="form-hint">{order.customer?.name} · {order.customer?.email} · {order.customer?.locale} · {t.waiting}: {t.waitingOn[order.waitingOn] || order.waitingOn}</p>
        </div>
      </div>

      {notice && <p className="admin-save-notice is-saved" role="status">{notice}</p>}

      <div className="panel form-stack">
        <p className="admin-kicker">{t.intake} · {order.intake?.intakeCode}</p>
        <div className="ops-brief-list">
          {intakeRows.map(([label, value]) => (
            <div className="ops-brief-row" key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
        {refMedia.length > 0 && (
          <>
            <p className="form-hint">{t.referenceMedia}</p>
            <div className="card-grid cols-3">
              {refMedia.map((m, i) => <MediaThumb key={i} media={m} alt="" ratio="1 / 1" />)}
            </div>
          </>
        )}
      </div>

      <div className="panel form-stack">
        <p className="admin-kicker">{t.console}</p>
        <p className="form-hint">{t.consoleHint}</p>
      </div>
      {FLOW.map((step) => (
        <StepCard key={step.type} step={step} order={order} t={t}
          onSent={() => { setNotice(t.sent); load(); }} />
      ))}

      {artifacts.length > 0 && (
        <div className="panel form-stack">
          <p className="admin-kicker">{t.artifacts}</p>
          {artifacts.map((a) => (
            <div key={a.id} className="feedback-note">
              <strong>{a.type}</strong> · {a.versionLabel} · {new Date(a.publishedAt).toLocaleString()}
              {a.payload?.note && ` · ${a.payload.note}`}
              {a.media?.length > 0 && (
                <div className="card-grid cols-3" style={{ marginTop: 8 }}>
                  {a.media.map((m, i) => <MediaThumb key={i} media={m} alt="" ratio="1 / 1" />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="panel form-stack">
          <p className="admin-kicker">{t.actions}</p>
          {actions.map((a) => (
            <div key={a.id} className="feedback-note">
              <strong>{a.kind}</strong> · <span className={`status-badge ${a.status === "OPEN" ? "mst-waitingClient" : a.status === "RESPONDED" ? "mst-done" : "mst-pending"}`}>{a.status}</span>
              {a.responsePayload?.response && ` · ${a.responsePayload.response}`}
              {a.respondedAt && ` · ${new Date(a.respondedAt).toLocaleString()}`}
            </div>
          ))}
        </div>
      )}

      <div className="panel form-stack">
        <p className="admin-kicker">{t.timeline}</p>
        {timeline.map((e) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hair)" }}>
            <span><strong>{e.title}</strong>{e.payload?.data?.tracking && ` · ${e.payload.data.tracking}`}{e.payload?.data?.igi && ` · IGI ${e.payload.data.igi}`}</span>
            <span className="form-hint" style={{ whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
