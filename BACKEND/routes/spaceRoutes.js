const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Space = require("../models/Space");
const User = require("../models/User");

// --- 1. CREATE A NEW SPACE / ROOM ---
// URL: POST /api/spaces/create
router.post("/create", async (req, res) => {
  try {
    const { name, spaceId, userId } = req.body;

    if (!name || !spaceId || !userId) {
      return res.status(400).json({ message: "Space Name, Room Code, and User ID are required." });
    }

    const cleanCode = spaceId.trim().toUpperCase();
    const cleanName = name.trim();

    // Check if room code already exists
    const existing = await Space.findOne({ spaceId: cleanCode });
    if (existing) {
      return res.status(400).json({ message: `Room Code "${cleanCode}" is already taken. Please choose another code.` });
    }

    // Verify creator exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Create space with creator as admin
    const newSpace = new Space({
      spaceId: cleanCode,
      name: cleanName,
      createdBy: user._id,
      members: [
        {
          user: user._id,
          role: "admin",
          joinedAt: new Date(),
        },
      ],
    });

    const savedSpace = await newSpace.save();
    return res.status(201).json({
      message: `Space "${savedSpace.name}" created successfully!`,
      space: savedSpace,
    });
  } catch (err) {
    console.error("Create Space Error:", err);
    return res.status(500).json({ message: "Internal server error creating space." });
  }
});

// --- 2. JOIN AN EXISTING SPACE / ROOM ---
// URL: POST /api/spaces/join
router.post("/join", async (req, res) => {
  try {
    const { spaceId, userId } = req.body;

    if (!spaceId || !userId) {
      return res.status(400).json({ message: "Room Code and User ID are required." });
    }

    const cleanCode = spaceId.trim().toUpperCase();

    // Find Space
    const space = await Space.findOne({ spaceId: cleanCode });
    if (!space) {
      return res.status(404).json({ message: `Room Code "${cleanCode}" does not exist. Please check the code.` });
    }

    // Check if user is already a member
    const isMember = space.members.some((m) => m.user.toString() === userId.toString());
    if (isMember) {
      return res.status(200).json({
        message: `You are already a member of "${space.name}".`,
        space,
      });
    }

    // Add user as member
    space.members.push({
      user: userId,
      role: "member",
      joinedAt: new Date(),
    });

    await space.save();

    return res.status(200).json({
      message: `Successfully joined "${space.name}"!`,
      space,
    });
  } catch (err) {
    console.error("Join Space Error:", err);
    return res.status(500).json({ message: "Internal server error joining space." });
  }
});

// --- 3. GET ALL SPACES JOINED BY A USER ---
// URL: GET /api/spaces/user/:userId
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format." });
    }

    const spaces = await Space.find({
      "members.user": new mongoose.Types.ObjectId(userId),
    }).sort({ updatedAt: -1 });

    return res.status(200).json(spaces);
  } catch (err) {
    console.error("Fetch User Spaces Error:", err);
    return res.status(500).json({ message: "Error fetching user spaces." });
  }
});

// --- 4. GET ALL MEMBERS IN A SPACE ---
// URL: GET /api/spaces/:spaceId/members
router.get("/:spaceId/members", async (req, res) => {
  try {
    const cleanCode = req.params.spaceId.trim().toUpperCase();

    const space = await Space.findOne({ spaceId: cleanCode }).populate({
      path: "members.user",
      select: "name email profilePic bio",
    });

    if (!space) {
      return res.status(404).json({ message: "Space not found." });
    }

    // Format member list with role and profile info
    const members = space.members
      .filter((m) => m.user) // Filter out deleted users
      .map((m) => ({
        _id: m.user._id,
        name: m.user.name,
        email: m.user.email,
        profilePic: m.user.profilePic || "",
        bio: m.user.bio || "",
        role: m.role || "member",
        joinedAt: m.joinedAt,
        spaceId: space.spaceId,
      }));

    return res.status(200).json({
      space: {
        _id: space._id,
        spaceId: space.spaceId,
        name: space.name,
        createdBy: space.createdBy,
      },
      members,
    });
  } catch (err) {
    console.error("Fetch Space Members Error:", err);
    return res.status(500).json({ message: "Error fetching space members." });
  }
});

// --- 5. LEAVE A SPACE ---
// URL: POST /api/spaces/leave
router.post("/leave", async (req, res) => {
  try {
    const { spaceId, userId } = req.body;
    const cleanCode = spaceId.trim().toUpperCase();

    const space = await Space.findOne({ spaceId: cleanCode });
    if (!space) {
      return res.status(404).json({ message: "Space not found." });
    }

    space.members = space.members.filter((m) => m.user.toString() !== userId.toString());
    await space.save();

    return res.status(200).json({ message: `You have left "${space.name}".` });
  } catch (err) {
    console.error("Leave Space Error:", err);
    return res.status(500).json({ message: "Error leaving space." });
  }
});

module.exports = router;
