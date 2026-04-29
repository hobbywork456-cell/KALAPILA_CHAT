const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  // The Company/Subscription group this message belongs to
  subscriptionId: {
    type: String,
    required: true,
    index: true // Indexed for faster querying within a company
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // For Personal Messages, this is the User ID. 
  // For Group Chats, this could be the Room/Group ID.
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", 
    required: false // Optional if you decide to use a separate "groupId" field later
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  // Useful for your requirement to distinguish personal vs group chat
  chatType: {
    type: String,
    enum: ["personal", "group"],
    default: "personal"
  }
}, { timestamps: true });

// Security: Indexing both subscriptionId and participants ensures 
// that users can only fetch messages from their own company network.
messageSchema.index({ subscriptionId: 1, sender: 1, receiver: 1 });

module.exports = mongoose.model("Message", messageSchema);