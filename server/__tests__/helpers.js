import { query } from "../db.js";

export async function truncateAuth() {
  await query(`truncate table sessions, magic_link_tokens, admin_users, customers
    restart identity cascade`);
}

export async function truncateCustomerCore() {
  await query(`truncate table customer_timeline_events, customer_actions, published_artifacts,
    customer_orders, customer_intakes, customers, idempotency_keys, audit_log
    restart identity cascade`);
}
