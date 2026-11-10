import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// In Expo Go the phone loads the app from your computer, so the API is on that same machine:
// reuse the dev-server host (e.g. 192.168.1.20) with the backend port. Override with
// EXPO_PUBLIC_API_URL (e.g. https://api.beautyqueen.mk) for tunnels or production.
const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
export const API_URL = (
    process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:4000` : "http://localhost:4000")
).replace(/\/$/, "");

const TOKEN_KEY = "bq_token";
let token = null;
let onUnauthorized = null;

export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function loadToken() {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token;
}

export async function saveToken(value) {
    token = value;
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

export async function request(method, path, body) {
    let res;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        res = await fetch(`${API_URL}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
        clearTimeout(timer);
    } catch {
        throw new ApiError(`Нема врска со серверот (${API_URL}). Проверете дали телефонот и компјутерот се на иста Wi-Fi мрежа.`, 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const isAuthCall = /^\/(login|register|password)/.test(path);
        if (res.status === 401 && !isAuthCall && onUnauthorized) onUnauthorized();
        throw new ApiError(data.message || "Настана грешка. Обидете се повторно.", res.status, data);
    }
    return data;
}

export const api = {
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b || {}),
    patch: (p, b) => request("PATCH", p, b || {}),
    del: (p) => request("DELETE", p)
};
