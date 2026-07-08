// app_settings 키-값 저장소 — 카탈로그 카피·가격표·결제 채널 등 운영 설정.
// 값은 클라이언트 스토어 형태의 jsonb 원본을 그대로 보관한다.
import { query } from "./db.js";

// 공개(비로그인) 노출이 허용된 키 — 고객 견적 추정·결제 카드가 소비한다.
export const PUBLIC_SETTINGS_KEYS = [
  "designCopy",
  "diamondPricing",
  "metalRefUsdPerG",
  "metalQuotedDate",
  "defaultLossRatePct",
  "opsMultiplier",
  "opsDepositRate",
  "payment",
  "styleSpecs",
  "coupons", // 쿠폰 카탈로그 — 위저드 견적 추정이 소비 (코드는 공개돼도 되는 '약속')
  "meleeUsdPerCt", // 멀티스톤 총캐럿 견적 단가 — 위저드 견적 추정이 소비
];

export async function getSettingsValues(keys) {
  const { rows } = await query(
    "select key, value from app_settings where key = any($1)",
    [keys],
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function putSettingsValues(patch) {
  const entries = Object.entries(patch || {}).filter(([key]) => PUBLIC_SETTINGS_KEYS.includes(key));
  for (const [key, value] of entries) {
    await query(
      `insert into app_settings (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, JSON.stringify(value)],
    );
  }
  return getSettingsValues(entries.map(([k]) => k));
}
