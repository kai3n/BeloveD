import { Router } from "express";
import { query } from "./db.js";
import { requireAdmin } from "./middleware.js";

// 어드민 회원 활동 조회 — overview(KPI/인기 스타일/퍼널/트렌드), 회원 목록, 개인 타임라인.
// 트렌드는 원본(최근)과 activity_daily(집계)를 합산해 90일 정리 후에도 이어진다.
export function adminActivityRouter() {
  const r = Router();
  r.use(requireAdmin);

  r.get("/activity/overview", async (_req, res, next) => {
    try {
      const [today, week, pv, active, top, funnel, trend] = await Promise.all([
        query("select count(distinct session_id)::int as n from activity_events where created_at >= date_trunc('day', now())"),
        query("select count(distinct session_id)::int as n from activity_events where created_at >= now() - interval '7 days'"),
        query("select count(*)::int as n from activity_events where event_type = 'page_view' and created_at >= now() - interval '7 days'"),
        query(`select count(distinct s.customer_id)::int as n from activity_events e
               join activity_sessions s on s.session_id = e.session_id
               where s.customer_id is not null and e.created_at >= now() - interval '7 days'`),
        query(`select entity_id as "entityId",
                 count(*) filter (where event_type = 'style_view')::int as views,
                 count(*) filter (where event_type = 'style_click')::int as clicks
               from activity_events
               where entity_type = 'style' and entity_id is not null and created_at >= now() - interval '30 days'
               group by entity_id order by count(*) desc limit 10`),
        query(`select
                 count(*) filter (where event_type = 'style_view')::int as "styleViews",
                 count(*) filter (where event_type = 'intake_start')::int as "intakeStarts",
                 count(*) filter (where event_type = 'intake_submit')::int as "intakeSubmits"
               from activity_events where created_at >= now() - interval '30 days'`),
        query(`select day, sum(n)::int as "pageViews" from (
                 select day, count as n from activity_daily where event_type = 'page_view' and entity_id = '' and day >= current_date - 13
                 union all
                 select created_at::date as day, count(*) as n from activity_events
                   where event_type = 'page_view' and created_at >= current_date - 13
                   group by created_at::date
               ) t group by day order by day`),
      ]);
      res.json({
        kpi: { sessionsToday: today.rows[0].n, sessions7d: week.rows[0].n,
               pageViews7d: pv.rows[0].n, activeMembers7d: active.rows[0].n },
        topStyles: top.rows, funnel: funnel.rows[0], trend: trend.rows,
      });
    } catch (e) { next(e); }
  });

  r.get("/members", async (_req, res, next) => {
    try {
      const { rows } = await query(`
        select c.id::int, c.customer_code as "customerCode", c.name, c.email,
               c.created_at as "createdAt",
               max(s.last_seen) as "lastActive",
               coalesce(sum(ec.n), 0)::int as "eventCount",
               (select count(*)::int from customer_orders o where o.customer_id = c.id) as "orderCount"
        from customers c
        left join activity_sessions s on s.customer_id = c.id
        left join lateral (select count(*) as n from activity_events e where e.session_id = s.session_id) ec on true
        group by c.id order by max(s.last_seen) desc nulls last, c.created_at desc`);
      res.json({ members: rows });
    } catch (e) { next(e); }
  });

  r.get("/members/:id/timeline", async (req, res, next) => {
    try {
      const customerId = Number(req.params.id);
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const before = req.query.before ? Number(req.query.before) : null;
      const { rows } = await query(`
        select e.id::int, e.event_type as type, e.path, e.entity_type as "entityType",
               e.entity_id as "entityId", e.meta, e.created_at as "createdAt"
        from activity_events e
        join activity_sessions s on s.session_id = e.session_id
        where s.customer_id = $1 and ($2::bigint is null or e.id < $2)
        order by e.id desc limit $3`, [customerId, before, limit]);
      res.json({ events: rows });
    } catch (e) { next(e); }
  });

  return r;
}
