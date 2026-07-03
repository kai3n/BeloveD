// 어드민 실주문 콘솔 API — Postgres 주문(BD-)의 목록/상세.
// 상태 전이·발행은 customerRoutes의 POST /v1/admin/orders/:code/events가 담당.
import { Router } from "express";
import { rateLimit } from "./rateLimit.js";
import { requireAdmin } from "./middleware.js";
import { query } from "./db.js";
import { listAdminOrders, getAdminOrder } from "./adminRepository.js";

const MINUTE = 60 * 1000;

export function adminOrderRouter() {
  const r = Router();

  r.get("/orders",
    rateLimit({ limit: 60, windowMs: MINUTE }),
    requireAdmin,
    async (_req, res, next) => {
      try {
        res.json({ ok: true, orders: await listAdminOrders() });
      } catch (e) { next(e); }
    });

  r.get("/orders/:orderCode",
    rateLimit({ limit: 120, windowMs: MINUTE }),
    requireAdmin,
    async (req, res, next) => {
      try {
        const order = await getAdminOrder(req.params.orderCode);
        // 어드민은 전체 이력 — 타임라인(내부 포함)·발행물·고객 액션까지 한 번에
        const { rows: [{ id: orderId }] } = await query(
          "select id from customer_orders where order_code = $1", [req.params.orderCode],
        );
        const [timeline, artifacts, actions] = await Promise.all([
          query("select * from customer_timeline_events where order_id = $1 order by created_at desc", [orderId]),
          query("select * from published_artifacts where order_id = $1 order by published_at desc", [orderId]),
          query("select * from customer_actions where order_id = $1 order by created_at desc", [orderId]),
        ]);
        res.json({
          ok: true,
          order,
          timeline: timeline.rows.map((row) => ({
            id: row.event_code, title: row.title, body: row.body, payload: row.payload || {}, createdAt: row.created_at,
          })),
          artifacts: artifacts.rows.map((row) => ({
            id: row.artifact_code, type: row.type, versionLabel: row.version_label,
            media: row.media || [], payload: row.payload || {}, publishedAt: row.published_at,
          })),
          actions: actions.rows.map((row) => ({
            id: row.action_code, kind: row.kind, status: row.status, title: row.title,
            allowedResponses: row.allowed_responses || [], responsePayload: row.response_payload || null,
            respondedAt: row.responded_at, createdAt: row.created_at,
          })),
        });
      } catch (e) { next(e); }
    });

  return r;
}
