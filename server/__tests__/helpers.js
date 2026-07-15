import { query } from "../db.js";

export async function truncateAuth() {
  await query(`truncate table sessions, magic_link_tokens, admin_users, customers,
    login_attempts, login_codes
    restart identity cascade`);
}

export async function truncateCustomerCore() {
  await query(`truncate table customer_timeline_events, customer_actions, published_artifacts,
    customer_orders, customer_intakes, customers, idempotency_keys, audit_log
    restart identity cascade`);
}

export async function truncateActivity() {
  await query("truncate table activity_events, activity_daily restart identity");
  await query("delete from activity_sessions");
}

export async function truncateChat() {
  await query("truncate table chat_messages, chat_threads, consultation_bookings, push_subscriptions restart identity cascade");
}

export async function truncateSuppliers() {
  await query(`truncate table supplier_updates, supplier_inventory,
    supplier_order_assignments, supplier_invites, suppliers
    restart identity cascade`);
}
