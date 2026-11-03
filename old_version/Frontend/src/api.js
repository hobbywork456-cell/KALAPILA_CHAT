import axios from "axios";

// Determine API base URL with smart fallback for hosted production (Vercel)
const isBrowser = typeof window !== "undefined";
const isLocalhost =
  isBrowser &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const envUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_URL : null;

const rawBaseUrl =
  envUrl ||
  (isBrowser && !isLocalhost
    ? "https://kalapila.onrender.com"
    : "http://localhost:5000");

const cleanBase = String(rawBaseUrl).replace(/\/+$/, "");
const baseURL = cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;

console.log("📡 [API Base URL]:", baseURL);

export const API = axios.create({
  baseURL,
  timeout: 60000, // 60s to handle Render free-tier cold starts
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(
      `[API Error] ${error?.config?.method?.toUpperCase()} ${error?.config?.url}:`,
      error?.response?.data || error?.message
    );
    return Promise.reject(error);
  }
);

export default API;
