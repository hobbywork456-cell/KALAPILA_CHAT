import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";

let socket = null;

export const connectSocket = (token) => {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

// emit with acknowledgement + timeout
export const emitAck = (event, payload, timeout = 15000) =>
  new Promise((resolve) => {
    if (!socket || !socket.connected) return resolve({ ok: false, error: "You're offline. Reconnecting…" });
    socket.timeout(timeout).emit(event, payload, (err, res) => {
      if (err) resolve({ ok: false, error: "Server did not respond. Please try again." });
      else resolve(res || { ok: false });
    });
  });
