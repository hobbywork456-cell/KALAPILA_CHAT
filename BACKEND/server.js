const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const dns = require("dns");

// Custom imports
const authRoutes = require("./routes/authRoutes");
const socketLogic = require("./socket/socket"); 

// Set DNS servers to prevent connection timeout issues in some environments
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const server = http.createServer(app);

// 🔌 Socket.IO setup
const io = require("socket.io")(server, {
  cors: { 
    origin: "*", // In production, replace "*" with your actual frontend URL
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected (Multi-Tenant Mode)"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// 🛣️ Routes
app.use("/api/auth", authRoutes);

// Health Check (Good for testing if the server is alive)
app.get("/", (req, res) => {
  res.send("Chat Server is running perfectly...");
});

// -----------------------------
// 🔌 INITIALIZE SOCKET LOGIC
// -----------------------------
// This calls the updated logic we wrote in the previous step
socketLogic(io);

// 🚀 START SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔒 Subscription-Group security enabled`);
});