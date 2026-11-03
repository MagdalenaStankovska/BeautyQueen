import api from "./api";

export const pushSupported = () =>
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    try {
        return await navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`);
    } catch (err) {
        console.warn("Service worker registration failed", err);
        return null;
    }
}

const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

// Subscribes this device to push notifications (reminders arrive even when the app is closed).
export async function enablePush() {
    if (!pushSupported()) return "unsupported";

    const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") return permission;

    const registration = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
    if (!registration) return "unsupported";
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        const { data } = await api.get("/push/public-key");
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey)
        });
    }
    await api.post("/push/subscribe", { subscription });
    return "granted";
}

export async function disablePush() {
    if (!pushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
        await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });
    } catch {
        // logging out with an expired session — still drop the local subscription
    }
    await subscription.unsubscribe();
}

export async function isPushEnabled() {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(await registration?.pushManager.getSubscription());
}
