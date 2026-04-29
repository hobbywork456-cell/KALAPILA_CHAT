const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const dns = require("dns");

// Custom imports
const authRoutes = require("./routes/authRoutes");
const socketLogic = require("./socket/socket"); // Import the logic

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const server = http.createServer(app);

// 🔌 Socket.IO setup
const io = require("socket.io")(server, {
  cors: { origin: "*" }
});

// Middleware
app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

// Routes
app.use("/api/auth", authRoutes);

// -----------------------------
// 🔌 INITIALIZE SOCKET LOGIC
// -----------------------------
socketLogic(io);

// 🚀 START SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});