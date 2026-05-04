const express = require("express");
const router = express.Router();
const Message = require("../models/Message");

// --- EDIT MESSAGE ---
// URL: /api/messages/edit/MESSAGE_ID
router.put("/edit/:id", async (req, res) => {
  try {
    const { message, senderId } = req.body;

    // We search by ID AND Sender to prevent users from editing other people's chats
    const updatedMsg = await Message.findOneAndUpdate(
      { _id: req.params.id, sender: senderId }, 
      { message: message, isEdited: true },
      { new: true }
    );

    if (!updatedMsg) {
      return res.status(403).json("You can only edit your own messages or message not found");
    }

    res.status(200).json(updatedMsg);
  } catch (err) {
    res.status(500).json(err);
  }
});

// --- DELETE MESSAGE ---
router.delete("/delete/:id", async (req, res) => {
  try {
    const { senderId } = req.body; // Pass senderId in request body for verification

    const deletedMsg = await Message.findOneAndDelete({ 
      _id: req.params.id, 
      sender: senderId 
    });

    if (!deletedMsg) {
      return res.status(403).json("Unauthorized or message not found");
    }

    res.status(200).json("Message deleted");
  } catch (err) {
    res.status(500).json(err);
  }
});

// --- SCHEDULE MESSAGE ---
router.post("/schedule", async (req, res) => {
  try {
    const { sender, receiver, message, scheduledTime, subscriptionId } = req.body;

    const newMessage = new Message({
      subscriptionId, // 👈 Required by your schema
      sender,
      receiver,       // 👈 Changed from 'recipient' to match your schema
      message,
      scheduledTime: new Date(scheduledTime),
      status: "scheduled"
    });

    const savedMsg = await newMessage.save();
    res.status(200).json(savedMsg);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

module.exports = router;