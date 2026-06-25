import { query } from "../db.js";

export async function truncateAuth() {
  await query(`truncate table sessions, magic_link_tokens, admin_users, customers
    restart identity cascade`);
}
