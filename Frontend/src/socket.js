import { io } from "socket.io-client";

// Use an environment variable for the URL, or default to localhost
const SOCKET_URL = "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: true, 
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});