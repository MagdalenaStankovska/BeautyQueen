import axios from "axios";
import { API_URL } from "./config";

const api = axios.create({ baseURL: API_URL });

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        const isAuthCall = /\/(login|register)$/.test(err.config?.url || "");
        if (err.response?.status === 401 && !isAuthCall && onUnauthorized) onUnauthorized();
        return Promise.reject(err);
    }
);

export const errorMessage = (err, fallback = "Настана грешка. Обидете се повторно.") =>
    err?.response?.data?.message || (err?.request && !err?.response ? "Нема врска со серверот." : fallback);

export default api;
