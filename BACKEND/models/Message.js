const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  subscriptionId: {
    type: String,
    required: false,
    default: "",
    index: true 
  },
  spaceId: {
    type: String,
    required: false,
    default: "",
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", 
    required: false 
  },
  message: {
    type: String,
    
    trim: true
  },

  fileUrl: { type: String }, // Base64 string or URL
  fileType: { type: String, enum: ["text", "image", "video", "audio"] },
  isEdited: { type: Boolean, default: false },
  chatType: {
    type: String,
    enum: ["personal", "group"],
    default: "personal"
  },
  
  // --- NEW FIELDS FOR EDIT/DELETE/SCHEDULE ---
  
  isEdited: {
    type: Boolean,
    default: false
  },
  
  // 'sent' = visible to recipient
  // 'scheduled' = held in DB until scheduledTime
  status: {
    type: String,
    enum: ["sent", "scheduled"],
    default: "sent"
  },

  scheduledTime: {
    type: Date,
    default: null,
    index: true // Important for the scheduler's query performance
  }

}, { timestamps: true });

// Optimized Indexes
// Combined index for fetching history within a company
messageSchema.index({ subscriptionId: 1, sender: 1, receiver: 1 });

// Index for the scheduler to find messages that need to be "released"
messageSchema.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model("Message", messageSchema);