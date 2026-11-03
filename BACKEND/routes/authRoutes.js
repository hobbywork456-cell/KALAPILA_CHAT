const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { signToken, requireAuth } = require("../middleware/auth");
const { escapeRegex, isId } = require("../utils/helpers");
const presence = require("../socket/presence");
const { userRoom } = require("../socket/delivery");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authPayload = (user) => ({
  token: signToken(user),
  user: user.toPublic(),
});

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email and password are required." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Please enter a valid email address." });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters long." });

    if (await User.exists({ email }))
      return res.status(400).json({ message: "An account with this email already exists." });

    const user = await User.create({ name, email, password });
    res.status(201).json({ message: "Account created!", ...authPayload(user) });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error creating account." });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(400).json({ message: "No account found with this email." });

    let ok = false;
    try {
      ok = await user.comparePassword(password);
    } catch {
      ok = false;
    }
    // Legacy fix: older builds could save plain-text passwords via the profile update route.
    if (!ok && user.password && !user.password.startsWith("$2") && user.password === password) {
      user.password = password; // re-hash on save
      await user.save();
      ok = true;
    }
    if (!ok) return res.status(400).json({ message: "Incorrect password. Please try again." });

    res.json({ message: "Login successful", ...authPayload(user) });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// Everything below requires a valid token
router.use(requireAuth);

// CURRENT USER
router.get("/me", async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: "Account no longer exists." });
  res.json(user.toPublic());
});

// UPDATE OWN PROFILE (name, bio, profilePic only)
router.put("/profile", async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.name === "string") {
      const name = req.body.name.trim();
      if (!name) return res.status(400).json({ message: "Name cannot be empty." });
      update.name = name.slice(0, 60);
    }
    if (typeof req.body.bio === "string") update.bio = req.body.bio.trim().slice(0, 200);
    if (typeof req.body.profilePic === "string") update.profilePic = req.body.profilePic;

    await User.updateOne({ _id: req.userId }, { $set: update }, { runValidators: true });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const io = req.app.get("io");
    // Keep the name shown in typing indicators current on this user's open sockets
    if (io) for (const s of await io.in(userRoom(req.userId)).fetchSockets()) s.data.user = user.toPublic();
    io?.emit("user:updated", user.toPublic());
    res.json(user.toPublic());
  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.status(500).json({ message: "Could not update profile." });
  }
});

// CHANGE PASSWORD
router.put("/password", async (req, res) => {
  try {
    const { currentPassword = "", newPassword = "" } = req.body;
    if (newPassword.length < 6)
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    const user = await User.findById(req.userId).select("+password");
    if (!user || !(await user.comparePassword(currentPassword)))
      return res.status(400).json({ message: "Current password is incorrect." });
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password updated." });
  } catch (err) {
    res.status(500).json({ message: "Could not change password." });
  }
});

// SEARCH USERS (name or email) – excludes yourself
router.get("/search-users", async (req, res) => {
  try {
    const q = (req.query.query || "").trim();
    if (q.length < 2) return res.json([]);
    const regex = new RegExp(escapeRegex(q), "i");
    const users = await User.find({ _id: { $ne: req.userId }, $or: [{ name: regex }, { email: regex }] }).limit(20);
    res.json(users.map((u) => ({ ...u.toPublic(), online: presence.isOnline(u._id) })));
  } catch (err) {
    res.status(500).json({ message: "Search failed." });
  }
});

// EXACT EMAIL LOOKUP
router.get("/search-by-email", async (req, res) => {
  const email = (req.query.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ message: "Email is required." });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "No user found with this email address." });
  res.json({ ...user.toPublic(), online: presence.isOnline(user._id) });
});

// PUBLIC PROFILE
router.get("/users/:id", async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid user id." });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ ...user.toPublic(), online: presence.isOnline(user._id) });
});

module.exports = router;
