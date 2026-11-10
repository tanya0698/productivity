/*
 * Web push for Creedence (plan §8.1), loaded into the generated service worker
 * (vite.config.ts: workbox.importScripts). The worker sends a JSON payload:
 * { title, body, tag, url }.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const isTest = typeof data.tag === "string" && data.tag.startsWith("test-");

  event.waitUntil(
    (async () => {
      // The app open and in front shows its own alert; don't double it up.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (!isTest && windows.some((w) => w.focused && w.visibilityState === "visible")) return;
      await self.registration.showNotification(data.title || "Creedence", {
        body: data.body || "",
        tag: data.tag,
        icon: "/icon-192.png",
        badge: "/favicon-32.png",
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
