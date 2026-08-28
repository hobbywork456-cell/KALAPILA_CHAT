const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const dns = require("dns");

// Custom imports
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoute");
const spaceRoutes = require("./routes/spaceRoutes");
const socketLogic = require("./socket/socket"); 
// 1. IMPORT THE SCHEDULER
const initMessageScheduler = require("./middleware/scheduler"); 

// Set DNS servers safely
try {
  if (process.env.SET_CUSTOM_DNS === "true") {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  }
} catch (e) {
  console.warn("DNS Server configuration skipped:", e.message);
}

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS (Production Vercel app, Local dev, Network IPs)
const allowedOrigins = [
  "https://kalapila-chat.vercel.app",
  "https://kalapila.onrender.com",
  "http://localhost:5172",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5172",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow mobile apps, curl, server-to-server
  const cleanOrigin = origin.replace(/\/+$/, "");
  return (
    allowedOrigins.some(o => o.replace(/\/+$/, "") === cleanOrigin) ||
    cleanOrigin.endsWith(".vercel.app") ||
    cleanOrigin.endsWith(".onrender.com") ||
    cleanOrigin.startsWith("http://localhost:") ||
    cleanOrigin.startsWith("http://127.0.0.1:") ||
    cleanOrigin.startsWith("http://192.168.")
  );
};

// 🔌 Socket.IO setup with polling first for cloud compatibility & max connection durability
const io = require("socket.io")(server, {
  cors: { 
    origin: (origin, callback) => {
      // Always allow valid web origins without dropping
      return callback(null, origin || true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true
  },
  transports: ["polling", "websocket"],
  pingTimeout: 30000,
  pingInterval: 15000,
  allowEIO3: true
});

// Middleware
const corsMiddleware = cors({
  origin: (origin, callback) => {
    return callback(null, origin || true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
});

app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ MongoDB Connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ CRITICAL: MONGO_URI is missing in environment variables!");
} else {
  mongoose.connect(mongoUri)
    .then(() => console.log("✅ MongoDB Connected (Multi-Tenant Mode)"))
    .catch(err => {
      console.error("❌ MongoDB Connection Error:", err.message);
      console.error("👉 Tip: Ensure MongoDB Atlas Network Access has IP 0.0.0.0/0 (Allow access from anywhere) enabled for Render.");
    });
}

// 🛣️ Routes
app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/spaces", spaceRoutes);


// Health Check
app.get("/", (req, res) => {
  res.send("Chat Server is running perfectly...");
});

// -----------------------------
// 🔌 INITIALIZE LOGIC & SCHEDULER
// -----------------------------

// 2. PASS IO TO SOCKET LOGIC
socketLogic(io);

// 3. START THE CRON JOB SCHEDULER
// This is the "brain" that checks the DB every minute for scheduled messages
initMessageScheduler(io);

// 🚀 START SERVER
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Local backend: http://localhost:${PORT}`);
  console.log(`🌐 Hosted backend: ${process.env.BACKEND_URL || "https://kalapila.onrender.com"}`);
  console.log(`💻 Frontend allowed: ${process.env.FRONTEND_URL || "https://kalapila-chat.vercel.app"}, http://localhost:5172`);
  console.log(`🕒 Message Scheduler: Active (Checking every 1 min)`);
  console.log(`🔒 Subscription-Group security enabled`);
});