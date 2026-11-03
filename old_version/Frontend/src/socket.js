import { io } from "socket.io-client";

const isBrowser = typeof window !== "undefined";
const isLocalhost =
  isBrowser &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const envSocketUrl =
  typeof import.meta !== "undefined"
    ? import.meta.env?.VITE_SOCKET_URL || import.meta.env?.VITE_API_URL
    : null;

const rawUrl =
  envSocketUrl ||
  (isBrowser && !isLocalhost
    ? "https://kalapila.onrender.com"
    : "http://localhost:5000");

const SOCKET_URL = String(rawUrl).replace(/\/api\/?$/, "").replace(/\/+$/, "");

console.log("🔌 [Socket URL]:", SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ["polling", "websocket"],
});

// Auto re-join whenever socket connects or reconnects
const emitJoinIfUserPresent = () => {
  try {
    const saved = localStorage.getItem("user");
    if (saved) {
      const user = JSON.parse(saved);
      if (user?._id || user?.email) {
        socket.emit("join", {
          userId: user._id,
          email: user.email,
        });
        console.log(`🔌 [Socket.io]: Connected & auto-joined as ${user.email || user._id}`);
      }
    }
  } catch (err) {
    console.warn("[Socket.io]: Error parsing stored user for join event:", err);
  }
};

socket.on("connect", () => {
  emitJoinIfUserPresent();
});

socket.on("reconnect", () => {
  emitJoinIfUserPresent();
});

export default socket;
