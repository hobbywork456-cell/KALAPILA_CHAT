require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoute");
const spaceRoutes = require("./routes/spaceRoutes");
const fileRoutes = require("./routes/fileRoutes");
const configRoutes = require("./routes/configRoutes");
const socketLogic = require("./socket/socket");
const initMessageScheduler = require("./middleware/scheduler");

if (process.env.SET_CUSTOM_DNS === "true") {
  try {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  } catch (e) {
    console.warn("DNS config skipped:", e.message);
  }
}

const app = express();
const server = http.createServer(app);

// CORS: the web app (Vercel), local dev and the native mobile app (Capacitor uses
// https://localhost / capacitor://localhost) all talk to this API. Auth is by Bearer token,
// not cookies, so reflecting the origin is safe.
const corsOptions = {
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Range"],
  exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "8mb" })); // profile pictures are sent as small data URLs
app.use(express.urlencoded({ limit: "8mb", extended: true }));

const io = require("socket.io")(server, {
  cors: { origin: (origin, cb) => cb(null, true), methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 20000,
  maxHttpBufferSize: 2e6,
});
app.set("io", io);

// MongoDB
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ MONGO_URI is missing in environment variables!");
} else {
  mongoose
    .connect(mongoUri)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      console.error("👉 Make sure Atlas Network Access allows 0.0.0.0/0 for Render.");
    });
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/message", messageRoutes); // legacy alias
app.use("/api/spaces", spaceRoutes);
app.use("/api/space", spaceRoutes); // legacy alias
app.use("/api/files", fileRoutes);
app.use("/api/config", configRoutes);

app.get("/api/health", (req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1, time: new Date().toISOString() })
);
app.get("/", (req, res) => res.send("Kalapila chat server is running."));

// Optional: serve the built web app from ../frontend/dist when SERVE_FRONTEND=true
if (process.env.SERVE_FRONTEND === "true") {
  const dist = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(dist));
  app.get(/^\/(?!api|socket\.io).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
}

// 404 + error handler for API
app.use("/api", (req, res) => res.status(404).json({ message: "Not found" }));
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong." });
});

socketLogic(io);
initMessageScheduler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
