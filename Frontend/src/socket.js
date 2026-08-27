import { io } from "socket.io-client";

const rawUrl =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_SOCKET_URL || import.meta.env?.VITE_API_URL)) ||
  "http://localhost:5000";

const SOCKET_URL = String(rawUrl).replace(/\/api\/?$/, "").replace(/\/+$/, "");

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ["websocket", "polling"],
});

export default socket;
