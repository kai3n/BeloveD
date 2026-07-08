// 스태프 웹푸시 — VAPID 키가 있을 때만 활성. 없으면 전 함수가 안전하게 no-op(테스트/미설정 환경).
import webpush from "web-push";
import { query } from "./db.js";

const PUB = process.env.VAPID_PUBLIC_KEY || null;
const PRIV = process.env.VAPID_PRIVATE_KEY || null;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@belovediamond.com";

export const pushEnabled = Boolean(PUB && PRIV);
if (pushEnabled) webpush.setVapidDetails(SUBJECT, PUB, PRIV);

export function vapidPublicKey() {
  return PUB;
}

// 구독 저장(엔드포인트 고유 — 재구독 시 갱신)
export async function saveSubscription(adminId, sub) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
  await query(
    `insert into push_subscriptions (admin_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update
       set admin_id = excluded.admin_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [adminId, String(sub.endpoint), String(sub.keys.p256dh), String(sub.keys.auth)],
  );
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await query("delete from push_subscriptions where endpoint = $1", [String(endpoint)]);
}

// 모든 스태프 구독으로 발송(fire-and-forget 용). 만료(404/410) 구독은 정리한다.
export async function sendPushToStaff(payload) {
  if (!pushEnabled) return;
  const { rows } = await query("select endpoint, p256dh, auth from push_subscriptions");
  if (!rows.length) return;
  const body = JSON.stringify(payload || {});
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        body,
      );
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await query("delete from push_subscriptions where endpoint = $1", [r.endpoint]).catch(() => {});
      }
    }
  }));
}
