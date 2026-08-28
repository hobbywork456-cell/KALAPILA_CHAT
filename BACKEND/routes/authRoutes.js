const express = require("express");
const router = express.Router();
const User = require("../models/User");

// ✅ REGISTER (Name, Email, Password)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const user = new User({
      name: name.trim(),
      email: cleanEmail,
      password,
    });

    await user.save();

    res.status(201).json({ message: "Account created successfully! You can now log in." });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error creating account" });
  }
});

// ✅ LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ message: "Account not found with this email" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password. Please try again." });
    }

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({ message: "Login successful", user: userData });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error during login: " + (err.message || "Unknown error") });
  }
});

// ✅ GET USERS (Filtered by Company)
router.get("/users", async (req, res) => {
  try {
    const { subscriptionId } = req.query;
    if (!subscriptionId) return res.status(400).json({ message: "ID required" });

    const users = await User.find({ subscriptionId }).select("-password");
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ SEARCH USERS (By Name or Email)
router.get("/search-users", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.status(200).json([]);
    }

    const cleanQuery = query.trim();
    const regex = new RegExp(cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const users = await User.find({
      $or: [{ name: regex }, { email: regex }],
    })
      .select("-password")
      .limit(20);

    res.status(200).json(users);
  } catch (err) {
    console.error("SEARCH USERS ERROR:", err);
    res.status(500).json({ message: "Server error searching users" });
  }
});

// ✅ SEARCH EXACT USER BY EMAIL
router.get("/search-by-email", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email query parameter is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "No user found with this email address" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("SEARCH BY EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error searching user by email" });
  }
});

// In authRoutes.js
router.put("/update/:id", async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;