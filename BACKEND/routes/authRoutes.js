const express = require("express");
const router = express.Router();
const User = require("../models/User");

// ✅ REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, subscriptionId } = req.body;

    if (!name || !email || !password || !subscriptionId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 🔥 VALIDATION: If role is member, the company ID must already exist
    if (role === "member") {
      const companyExists = await User.findOne({ subscriptionId });
      if (!companyExists) {
        return res.status(400).json({ 
          message: "Invalid Company ID. This ID does not exist. Please contact your Admin." 
        });
      }
    }

    const user = new User({
      name,
      email,
      password,
      subscriptionId,
      role: role || "member"
    });

    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({ message: "Login successful", user: userData });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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

module.exports = router;