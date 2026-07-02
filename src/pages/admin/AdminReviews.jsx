import { useState } from "react";
import { deleteReview, listReviews, setReviewStatus, upsertReviewManual } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaPicker, MediaThumb } from "../../components/ui.jsx";
import { useLocale } from "../../i18n.jsx";

// 홈 "Loved & Worn" 리뷰 큐레이션 — 운영자가 전부 수동 추가/수정/삭제/게시 제어
const COPY = {
  en: { title: "Customer Reviews", sub: "Everything shown on the home feed. Add, edit, hide or delete manually.", add: "Add review", edit: "Edit", del: "Delete", delAsk: "Delete this review permanently?", publish: "Publish", hide: "Hide", save: "Save", cancel: "Cancel", name: "Name", location: "Location", rating: "Rating (1–5)", quote: "One line", body: "Story", media: "Media (max 5)", order: "Order no. (optional)", status: "Status" },
  ko: { title: "고객 리뷰", sub: "홈 피드에 노출되는 리뷰 전체입니다. 수동으로 추가·수정·숨김·삭제할 수 있어요.", add: "리뷰 추가", edit: "수정", del: "삭제", delAsk: "이 리뷰를 완전히 삭제할까요?", publish: "게시", hide: "숨김", save: "저장", cancel: "취소", name: "이름", location: "지역", rating: "별점 (1–5)", quote: "한 줄", body: "본문", media: "미디어 (최대 5)", order: "주문번호 (선택)", status: "상태" },
  zh: { title: "客户评价", sub: "首页展示的全部评价，可手动添加、编辑、隐藏或删除。", add: "添加评价", edit: "编辑", del: "删除", delAsk: "确定永久删除该评价？", publish: "发布", hide: "隐藏", save: "保存", cancel: "取消", name: "姓名", location: "地区", rating: "评分 (1–5)", quote: "一句话", body: "正文", media: "媒体（最多 5）", order: "订单号（可选）", status: "状态" },
  es: { title: "Reseñas de clientes", sub: "Todo lo que aparece en el feed del inicio. Agrega, edita, oculta o elimina manualmente.", add: "Agregar reseña", edit: "Editar", del: "Eliminar", delAsk: "¿Eliminar esta reseña permanentemente?", publish: "Publicar", hide: "Ocultar", save: "Guardar", cancel: "Cancelar", name: "Nombre", location: "Ubicación", rating: "Calificación (1–5)", quote: "Una línea", body: "Historia", media: "Medios (máx. 5)", order: "N.º de pedido (opcional)", status: "Estado" },
};

const EMPTY = { id: "", orderId: "", name: "", location: "", rating: 5, quote: "", body: "", media: [], status: "published" };

export default function AdminReviews() {
  useDBVersion();
  const { locale } = useLocale();
  const c = COPY[locale] || COPY.en;
  const [draft, setDraft] = useState(null); // null | 편집중 객체
  const reviews = listReviews();
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  function save() {
    if (!draft.quote.trim()) return;
    upsertReviewManual({ ...draft, orderId: draft.orderId || null });
    setDraft(null);
  }

  return (
    <div className="page">
      <header className="ops-order-header">
        <div>
          <p className="admin-kicker">Loved &amp; Worn</p>
          <h1>{c.title}</h1>
          <p>{c.sub}</p>
        </div>
        <button className="button primary" onClick={() => setDraft({ ...EMPTY })}>{c.add}</button>
      </header>

      {draft && (
        <div className="panel form-stack" style={{ marginBottom: 18 }}>
          <div className="filter-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <label className="field"><span>{c.name}</span><input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <label className="field"><span>{c.location}</span><input value={draft.location} onChange={(e) => set({ location: e.target.value })} /></label>
            <label className="field"><span>{c.rating}</span><input type="number" min="1" max="5" value={draft.rating} onChange={(e) => set({ rating: e.target.value })} /></label>
            <label className="field"><span>{c.order}</span><input value={draft.orderId || ""} onChange={(e) => set({ orderId: e.target.value })} placeholder="DM-000001" /></label>
          </div>
          <label className="field"><span>{c.quote}</span><input value={draft.quote} onChange={(e) => set({ quote: e.target.value })} /></label>
          <label className="field"><span>{c.body}</span><textarea rows={2} value={draft.body} onChange={(e) => set({ body: e.target.value })} /></label>
          <div className="field"><span>{c.media}</span>
            <MediaPicker value={draft.media} onChange={(m) => set({ media: m })} maxItems={5} showSamples={false} previewMode="list" scope="review" />
          </div>
          <label className="field" style={{ maxWidth: 220 }}><span>{c.status}</span>
            <select value={draft.status} onChange={(e) => set({ status: e.target.value })}>
              {["published", "pending", "hidden"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <div className="row-actions">
            <button className="button primary small" disabled={!draft.quote.trim()} onClick={save}>{c.save}</button>
            <button className="button secondary small" onClick={() => setDraft(null)}>{c.cancel}</button>
          </div>
        </div>
      )}

      <div className="card-grid cols-3">
        {reviews.map((r) => (
          <div className="item-card" key={r.id}>
            {r.media[0] && <MediaThumb media={r.media[0]} ratio="4 / 3" alt={r.quote} fit="contain" />}
            <div className="card-body">
              <div className="row-actions" style={{ justifyContent: "space-between" }}>
                <span className={`status-badge ${r.status === "published" ? "mst-done" : r.status === "pending" ? "mst-inProgress" : "mst-pending"}`}>{r.status}</span>
                <span className="form-hint">{r.id}{r.orderId ? ` · ${r.orderId}` : ""}</span>
              </div>
              <h3 style={{ margin: "8px 0 2px" }}>“{r.quote}”</h3>
              <p className="spec">{"★".repeat(r.rating)} · {r.name}{r.location ? ` · ${r.location}` : ""}</p>
              {r.body && <p className="form-hint">{r.body}</p>}
              <div className="row-actions" style={{ marginTop: 10 }}>
                <button className="button secondary small" onClick={() => setDraft({ ...EMPTY, ...r })}>{c.edit}</button>
                {r.status !== "published"
                  ? <button className="button secondary small" onClick={() => setReviewStatus(r.id, "published")}>{c.publish}</button>
                  : <button className="button secondary small" onClick={() => setReviewStatus(r.id, "hidden")}>{c.hide}</button>}
                <button className="button danger small" onClick={() => { if (window.confirm(c.delAsk)) deleteReview(r.id); }}>{c.del}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
