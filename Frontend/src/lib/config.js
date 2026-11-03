// Where the backend lives. Set VITE_API_URL in .env.* files.
const isBrowser = typeof window !== "undefined";
const host = isBrowser ? window.location.hostname : "";
const isLocalWeb = isBrowser && (host === "localhost" || host === "127.0.0.1") && window.location.port !== "";

const raw =
  import.meta.env?.VITE_API_URL ||
  (isLocalWeb ? `http://${host}:5000` : "https://kalapila.onrender.com");

export const SERVER_URL = String(raw).replace(/\/api\/?$/, "").replace(/\/+$/, "");
export const API_URL = `${SERVER_URL}/api`;
export const SOCKET_URL = String(import.meta.env?.VITE_SOCKET_URL || SERVER_URL)
  .replace(/\/api\/?$/, "")
  .replace(/\/+$/, "");

// Files are stored on the server as "/api/files/..." – turn them into absolute URLs.
export const fileUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("/api/")) return `${SERVER_URL}${url}`;
  return url; // legacy base64 data: URLs or absolute URLs
};

export const isNativeApp = () => isBrowser && !!window.Capacitor?.isNativePlatform?.();
