import { randomBytes, createHash } from "node:crypto";
import { query } from "./db.js";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashToken(raw) {
  return createHash("sha256").update(String(raw)).digest("hex");
}

export async function issueSession(principalType, principalId, ttlMs = DEFAULT_TTL_MS) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  await query(
    "insert into sessions (id, principal_type, principal_id, expires_at) values ($1,$2,$3,$4)",
    [id, principalType, principalId, expiresAt],
  );
  return { id, expiresAt };
}

export async function getSession(id) {
  if (!id) return null;
  const { rows } = await query(
    "select * from sessions where id=$1 and revoked_at is null and expires_at > now()",
    [id],
  );
  return rows[0] || null;
}

export async function revokeSession(id) {
  if (!id) return;
  await query("update sessions set revoked_at=now() where id=$1", [id]);
}

// Revoke every live session belonging to a principal (e.g. on password change).
export async function revokeAllForPrincipal(type, id) {
  await query(
    "update sessions set revoked_at=now() where principal_type=$1 and principal_id=$2 and revoked_at is null",
    [type, id],
  );
}
