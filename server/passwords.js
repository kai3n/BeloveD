import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(pw) {
  const salt = randomBytes(16);
  const dk = scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export function verifyPassword(pw, stored) {
  const [scheme, saltHex, hashHex] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const dk = scryptSync(String(pw), Buffer.from(saltHex, "hex"), 64);
  const target = Buffer.from(hashHex, "hex");
  return dk.length === target.length && timingSafeEqual(dk, target);
}
