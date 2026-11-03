import axios from "axios";
import { API_URL } from "./config";

export const TOKEN_KEY = "kp_token";
export const USER_KEY = "kp_user";

export const API = axios.create({ baseURL: API_URL, timeout: 60000 });

API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

API.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401 && onUnauthorized) onUnauthorized();
    return Promise.reject(error);
  }
);

export const errorMessage = (err, fallback = "Something went wrong.") => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === "ECONNABORTED") return "The server is taking long to respond (it may be waking up). Please try again.";
  if (err?.message === "Network Error") return "Can't reach the server. Check your connection and try again.";
  return fallback;
};

// Upload a file with progress. Returns { url, fileType, fileName, fileSize, mimeType }
export const uploadFile = async (file, onProgress, signal) => {
  const fd = new FormData();
  fd.append("file", file, file.name || "file");
  const res = await API.post("/files", fd, {
    timeout: 0,
    signal,
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  });
  return res.data;
};

export default API;
