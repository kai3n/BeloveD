// 클라이언트 시드 카탈로그·가격·설정을 서버(Postgres)로 1회 푸시 — 서버 배선 부트스트랩.
// 서버가 비어 있을 때만 채우는 게 기본값(이후 서버가 진실). FORCE=1이면 무조건 덮어쓴다.
//
// Usage: DATABASE_URL=... node scripts/push-catalog-to-server.mjs [FORCE=1]
import { listOpsStyles, listStyleSpecs, getBenchmark, getSettings } from "../src/lib/store.js";
import { upsertAdminStyle, listAdminStyles } from "../server/adminRepository.js";
import { putSettingsValues, getSettingsValues, PUBLIC_SETTINGS_KEYS } from "../server/settingsRepository.js";
import { closePool } from "../server/db.js";

const FORCE = process.env.FORCE === "1";

const existingStyles = await listAdminStyles();
if (existingStyles.length > 0 && !FORCE) {
  console.log(`styles: server already has ${existingStyles.length} — skipped (FORCE=1 to overwrite)`);
} else {
  const styles = listOpsStyles();
  for (const style of styles) {
    await upsertAdminStyle(style.id, style);
  }
  console.log(`styles: pushed ${styles.length}`);
}

const existingSettings = await getSettingsValues(PUBLIC_SETTINGS_KEYS);
const settings = getSettings();
const patch = {};
const maybe = (key, value) => {
  if (FORCE || existingSettings[key] === undefined) patch[key] = value;
};
maybe("diamondPricing", getBenchmark());
maybe("styleSpecs", listStyleSpecs());
maybe("metalRefUsdPerG", settings.metalRefUsdPerG);
maybe("defaultLossRatePct", settings.defaultLossRatePct);
maybe("opsMultiplier", settings.opsMultiplier);
maybe("opsDepositRate", settings.opsDepositRate);
maybe("payment", settings.payment || { zelle: "", venmo: "", note: "" });
maybe("designCopy", settings.designCopy || {});
await putSettingsValues(patch);
console.log(`settings: pushed keys [${Object.keys(patch).join(", ") || "none — all present"}]`);

await closePool();
