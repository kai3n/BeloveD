/* BeloveD 스태프 웹푸시 — 알림 표시 전용 서비스워커.
   주의: fetch/캐시 핸들러를 두지 않는다(정적 번들 캐싱 부작용·구버전 노출 방지). */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "BeloveD";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "New chat message",
    tag: data.code || "beloved-chat",
    renotify: true,
    icon: "/favicon.png",
    badge: "/favicon.png",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) { if ("focus" in w) return w.focus(); }
      return self.clients.openWindow("/");
    }),
  );
});
