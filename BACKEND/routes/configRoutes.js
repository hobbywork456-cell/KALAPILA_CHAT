const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

// WebRTC ICE servers. STUN works on most Wi-Fi networks; for calls over mobile data / strict
// firewalls add a TURN server via env: TURN_URLS (comma separated), TURN_USERNAME, TURN_CREDENTIAL.
router.get("/ice", requireAuth, (req, res) => {
  const iceServers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (process.env.TURN_URLS) {
    iceServers.push({
      urls: process.env.TURN_URLS.split(",").map((s) => s.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME || "",
      credential: process.env.TURN_CREDENTIAL || "",
    });
  }
  res.json({ iceServers });
});

module.exports = router;
