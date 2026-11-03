const mongoose = require("mongoose");

/**
 * chatType:
 *   "personal" -> 1:1 direct message (sender -> receiver)
 *   "group"    -> message posted in a Space's group channel (spaceId)
 */
const messageSchema = new mongoose.Schema(
  {
    subscriptionId: { type: String, default: "" }, // legacy
    chatType: { type: String, enum: ["personal", "group"], default: "personal" },
    spaceId: { type: String, default: "", index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    message: { type: String, default: "", trim: true, maxlength: 5000 },

    // Attachments
    fileUrl: { type: String },
    fileType: { type: String, enum: ["text", "image", "video", "audio", "file"], default: "text" },
    fileName: { type: String },
    fileSize: { type: Number },
    mimeType: { type: String },

    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    system: { type: Boolean, default: false }, // e.g. "Anu joined the space"

    isEdited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },

    // Read receipts (direct messages)
    seen: { type: Boolean, default: false },
    seenAt: { type: Date, default: null },

    // 'sent' = visible, 'scheduled' = held until scheduledTime
    status: { type: String, enum: ["sent", "scheduled"], default: "sent" },
    scheduledTime: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, seen: 1 });
messageSchema.index({ spaceId: 1, chatType: 1, createdAt: -1 });
messageSchema.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model("Message", messageSchema);
