import { query } from "../db.js";

export async function truncateAuth() {
  await query(`truncate table sessions, magic_link_tokens, admin_users, customers
    restart identity cascade`);
}

export async function truncateActivity() {
  await query("truncate table activity_events, activity_daily restart identity");
  await query("delete from activity_sessions");
}
