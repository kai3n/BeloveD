import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { listOpsOrders, listReviews, portalView } from "../lib/store.js";
import { useDBVersion } from "../lib/useDB.js";
import { useLocale } from "../i18n.jsx";
import ReviewForm from "../components/ReviewForm.jsx";

// "Share your moment" — 홈에서 바로 들어오는 리뷰 작성 플로우.
// 배송 완료 주문만: 주문번호+트래킹 코드로 인증(비회원) 또는 로그인 고객의 완료 주문 선택.
const COPY = {
  en: {
    title: "Share your moment", sub: "Delivered orders can post photos and video with a verified review.",
    orderId: "Order number", code: "Tracking code", verify: "Verify my order",
    invalid: "We couldn't find that order, or it hasn't been delivered yet.",
    already: "This order already has a review — thank you!",
    pick: "Choose a delivered order", none: "No delivered orders yet — your moment is coming.",
    done: "Thank you. Your review is being curated and will appear on our homepage soon.",
    back: "Back to home", forOrder: (id) => `Review for ${id}`,
  },
  ko: {
    title: "내 순간 남기기", sub: "배송 완료된 주문은 사진·영상과 함께 인증 리뷰를 남길 수 있어요.",
    orderId: "주문번호", code: "트래킹 코드", verify: "주문 인증하기",
    invalid: "주문을 찾을 수 없거나 아직 배송 완료 전입니다.",
    already: "이 주문에는 이미 리뷰가 있어요 — 감사합니다!",
    pick: "배송 완료된 주문 선택", none: "아직 배송 완료된 주문이 없어요 — 곧 당신의 순간이 옵니다.",
    done: "감사합니다. 검수 후 홈페이지에 곧 게시됩니다.",
    back: "홈으로", forOrder: (id) => `${id} 리뷰`,
  },
  zh: {
    title: "分享你的瞬间", sub: "已送达的订单可上传照片或视频，留下认证评价。",
    orderId: "订单号", code: "追踪码", verify: "验证我的订单",
    invalid: "未找到该订单，或尚未送达。",
    already: "该订单已有评价 — 谢谢！",
    pick: "选择已送达的订单", none: "还没有已送达的订单 — 你的瞬间即将到来。",
    done: "谢谢。审核后将很快展示在首页。",
    back: "返回首页", forOrder: (id) => `${id} 的评价`,
  },
  es: {
    title: "Comparte tu momento", sub: "Los pedidos entregados pueden publicar fotos y video con una reseña verificada.",
    orderId: "Número de pedido", code: "Código de seguimiento", verify: "Verificar mi pedido",
    invalid: "No encontramos ese pedido, o aún no fue entregado.",
    already: "Este pedido ya tiene una reseña — ¡gracias!",
    pick: "Elige un pedido entregado", none: "Aún no hay pedidos entregados — tu momento llegará.",
    done: "Gracias. Tu reseña se curará y aparecerá pronto en nuestra página.",
    back: "Volver al inicio", forOrder: (id) => `Reseña de ${id}`,
  },
};

const DONE_STATUSES = ["DELIVERED", "ARCHIVED"];

export default function ReviewNew() {
  useDBVersion();
  const { p, locale } = useLocale();
  const c = COPY[locale] || COPY.en;
  const rc = p.portalReview || {};
  const { user } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(null); // orderId
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // 로그인 고객: 배송 완료 주문 바로 선택
  const myDelivered = user
    ? listOpsOrders({ customerId: user.id }).filter((o) => DONE_STATUSES.includes(o.status))
    : [];

  function verify(e) {
    e.preventDefault();
    const id = orderId.trim().toUpperCase();
    const view = portalView(id, { customerId: user?.id, userRole: user?.role, queryCode: code.trim().toUpperCase() });
    if (!view || !DONE_STATUSES.includes(view.order.status)) { setError(c.invalid); return; }
    if (listReviews({ orderId: id }).some((r) => r.status !== "hidden")) { setError(c.already); return; }
    setError("");
    setVerified(id);
  }

  function pickOrder(id) {
    if (listReviews({ orderId: id }).some((r) => r.status !== "hidden")) { setError(c.already); return; }
    setError("");
    setVerified(id);
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{c.title}</h1>
      <p className="page-sub">{c.sub}</p>

      {done ? (
        <div className="panel form-stack">
          <p className="form-hint" style={{ fontSize: 15 }}>{c.done}</p>
          <Link className="button primary" to="/">{c.back}</Link>
        </div>
      ) : verified ? (
        <div className="panel form-stack">
          <p className="section-label">{c.forOrder(verified)}</p>
          <ReviewForm
            orderId={verified}
            rc={{
              mediaLbl: rc.mediaLbl || "Photos & video first (max 5)",
              rating: rc.rating || "Rating",
              quoteLbl: rc.quoteLbl || "One line",
              quotePh: rc.quotePh || "She said yes.",
              bodyLbl: rc.bodyLbl || "Your story (optional)",
              note: rc.note || "Verified with your order number. Curated before publishing.",
              submit: rc.submit || "Submit review",
            }}
            onDone={() => setDone(true)}
          />
        </div>
      ) : (
        <>
          {myDelivered.length > 0 && (
            <div className="panel form-stack" style={{ marginBottom: 14 }}>
              <p className="section-label">{c.pick}</p>
              <div className="row-actions">
                {myDelivered.map((o) => (
                  <button key={o.id} className="button secondary small" onClick={() => pickOrder(o.id)}>{o.id}</button>
                ))}
              </div>
            </div>
          )}
          {user && myDelivered.length === 0 && <p className="form-hint" style={{ marginBottom: 14 }}>{c.none}</p>}
          <form className="panel form-stack" onSubmit={verify}>
            <label className="field"><span>{c.orderId}</span>
              <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="DM-000001" required />
            </label>
            <label className="field"><span>{c.code}</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" required />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button primary" type="submit">{c.verify}</button>
          </form>
        </>
      )}
    </div>
  );
}
