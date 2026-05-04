const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const dns = require("dns");

// Custom imports
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoute");
const socketLogic = require("./socket/socket"); 
// 1. IMPORT THE SCHEDULER
const initMessageScheduler = require("./middleware/scheduler"); 

// Set DNS servers
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const server = http.createServer(app);

// 🔌 Socket.IO setup
const io = require("socket.io")(server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Middleware
// Note: Put limit-increasing middleware BEFORE regular express.json()
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected (Multi-Tenant Mode)"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// 🛣️ Routes
app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);

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
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🕒 Message Scheduler: Active (Checking every 1 min)`);
  console.log(`🔒 Subscription-Group security enabled`);
});