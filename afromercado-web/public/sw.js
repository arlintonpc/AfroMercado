// Service Worker — AfroMercado Web Push
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, icon, badge, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title || "AfroMercado", {
      body:              body  || "",
      icon:              icon  || "/icon-192.svg",
      badge:             badge || "/badge-72.svg",
      data:              { url: url || "/" },
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.startsWith(self.location.origin) && "focus" in w) {
            w.navigate(url);
            return w.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
