import axios from "axios";

const rawBaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:5000";

const cleanBase = String(rawBaseUrl).replace(/\/+$/, "");
const baseURL = cleanBase.endsWith("/api") ? cleanBase : `${cleanBase}/api`;

export const API = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(`[API Error] ${error?.config?.method?.toUpperCase()} ${error?.config?.url}:`, error?.response?.data || error?.message);
    return Promise.reject(error);
  }
);

export default API;
