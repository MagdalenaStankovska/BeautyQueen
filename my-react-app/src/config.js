// Backend URL — override with REACT_APP_API_URL in .env (e.g. when testing from a phone on the LAN).
export const API_URL = (
    process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`
).replace(/\/$/, "");

export const assetUrl = (p) => (!p ? "" : /^https?:\/\//.test(p) ? p : `${API_URL}${p}`);
