const express = require("express");
const router = express.Router();
const User = require("../models/User");


// ✅ REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 🔍 Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 🔍 Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // ✅ Create user
    const user = new User({
      name,
      email,
      password,
      role: role || "employee"
    });

    await user.save();

    // ❌ Remove password before sending response
    const userData = user.toObject();
    delete userData.password;

    res.status(201).json({
      message: "User registered successfully",
      user: userData
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔍 Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    // 🔍 Check user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // 🔐 Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // ❌ Remove password
    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      message: "Login successful",
      user: userData
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ GET ALL USERS (for chat list)
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // ❌ hide password

    res.status(200).json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;