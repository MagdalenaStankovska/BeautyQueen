/* Beauty Queen service worker — handles push notifications (reminders, appointment updates). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data && event.data.text() };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || "Beauty Queen", {
            body: data.body || "",
            icon: "/logo192.png",
            badge: "/logo192.png",
            tag: data.tag,
            vibrate: [200, 100, 200],
            data: { url: data.url || "/" }
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ("focus" in client) {
                    client.postMessage({ type: "open-section", section: "notifications" });
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
