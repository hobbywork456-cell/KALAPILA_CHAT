const mongoose = require("mongoose");

const isId = (v) => typeof v === "string" ? mongoose.Types.ObjectId.isValid(v) && /^[a-f0-9]{24}$/i.test(v) : v instanceof mongoose.Types.ObjectId;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const idStr = (v) => (v?._id || v)?.toString();

// Fields of a user that are safe to embed in messages / lists
const USER_PUBLIC = "name email profilePic bio lastSeen";

const MESSAGE_POPULATE = [
  { path: "sender", select: USER_PUBLIC },
  {
    path: "replyTo",
    select: "message fileType fileName sender deleted",
    populate: { path: "sender", select: "name" },
  },
];

module.exports = { isId, escapeRegex, idStr, USER_PUBLIC, MESSAGE_POPULATE };

// Strip content from deleted messages before sending to clients
const cleanMessage = (m) => {
  if (!m) return m;
  const o = typeof m.toObject === "function" ? m.toObject() : m;
  if (o.deleted) {
    o.message = "";
    o.fileUrl = null;
    o.fileName = null;
    o.fileType = "text";
  }
  if (o.replyTo && o.replyTo.deleted) {
    o.replyTo = { ...o.replyTo, message: "", fileType: "text", fileName: null };
  }
  return o;
};

const previewText = (m) => {
  if (!m) return "";
  if (m.deleted) return "🚫 Message deleted";
  switch (m.fileType) {
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "audio": return "🎤 Voice message";
    case "file": return `📎 ${m.fileName || "File"}`;
    default: return m.message || "";
  }
};

module.exports.cleanMessage = cleanMessage;
module.exports.previewText = previewText;
