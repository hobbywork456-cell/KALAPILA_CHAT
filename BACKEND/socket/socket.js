const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const Space = require("../models/Space");
const { verifyToken } = require("../middleware/auth");
const { isId, idStr, cleanMessage, MESSAGE_POPULATE } = require("../utils/helpers");
const { userRoom, spaceRoom, emitForMessage, deliverMessage } = require("./delivery");
const presence = require("./presence");
const callLogic = require("../routes/call");

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const FILE_URL_RE = /^\/api\/files\/[a-f0-9]{24}\/[a-f0-9]{24}$/i;
const safeAck = (ack) => (typeof ack === "function" ? ack : () => {});

const socketLogic = (io) => {
  // 🔐 Every socket must present a valid JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("unauthorized"));
      const { id } = verifyToken(token);
      const user = await User.findById(id);
      if (!user) return next(new Error("unauthorized"));
      socket.data.userId = id;
      socket.data.user = user.toPublic();
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const me = socket.data.userId;
    socket.join(userRoom(me));

    // Join all space rooms this user belongs to
    try {
      const spaces = await Space.find({ "members.user": oid(me) }).select("spaceId").lean();
      spaces.forEach((s) => socket.join(spaceRoom(s.spaceId)));
    } catch (e) {
      console.warn("space room join failed", e.message);
    }

    if (presence.add(me, socket.id)) {
      io.emit("presence", { userId: me, online: true });
    }
    socket.emit("ready", { userId: me, online: presence.list() });

    callLogic(socket, io);

    socket.on("get-online-users", (ack) => safeAck(ack)(presence.list()));

    // ---------------- SEND (instant or scheduled) ----------------
    socket.on("sendMessage", async (payload = {}, ack) => {
      ack = safeAck(ack);
      try {
        const chatType = payload.chatType === "group" ? "group" : "personal";
        const text = typeof payload.message === "string" ? payload.message.trim().slice(0, 5000) : "";
        const hasFile = typeof payload.fileUrl === "string" && FILE_URL_RE.test(payload.fileUrl);
        if (!text && !hasFile) return ack({ ok: false, error: "Message is empty." });

        const doc = {
          chatType,
          sender: me,
          message: text,
          fileType: "text",
        };

        if (chatType === "group") {
          const code = String(payload.to || "").toUpperCase();
          const space = await Space.findOne({ spaceId: code }).select("members spaceId");
          if (!space || !space.memberOf(me)) return ack({ ok: false, error: "You are not a member of this space." });
          doc.spaceId = code;
        } else {
          if (!isId(payload.to) || payload.to === me) return ack({ ok: false, error: "Invalid recipient." });
          if (!(await User.exists({ _id: payload.to }))) return ack({ ok: false, error: "User not found." });
          doc.receiver = payload.to;
        }

        if (hasFile) {
          doc.fileUrl = payload.fileUrl;
          doc.fileType = ["image", "video", "audio", "file"].includes(payload.fileType) ? payload.fileType : "file";
          doc.fileName = String(payload.fileName || "").slice(0, 120);
          doc.fileSize = Number(payload.fileSize) || 0;
          doc.mimeType = String(payload.mimeType || "").slice(0, 100);
        }

        if (payload.replyTo && isId(payload.replyTo)) doc.replyTo = payload.replyTo;

        if (payload.scheduledTime) {
          const when = new Date(payload.scheduledTime);
          if (isNaN(when)) return ack({ ok: false, error: "Invalid schedule time." });
          if (when.getTime() < Date.now() + 15 * 1000)
            return ack({ ok: false, error: "Pick a time at least a minute in the future." });
          doc.status = "scheduled";
          doc.scheduledTime = when;
          const saved = await Message.create(doc);
          return ack({ ok: true, scheduled: true, message: saved.toObject() });
        }

        const saved = await Message.create(doc);
        const full = await Message.findById(saved._id).populate(MESSAGE_POPULATE).lean();
        const out = { ...cleanMessage(full), clientId: payload.clientId };
        emitForMessage(io, out, "message:new", out);
        if (chatType === "group") Space.updateOne({ spaceId: doc.spaceId }, { $set: { updatedAt: new Date() } }).catch(() => {});
        ack({ ok: true, message: out });
      } catch (err) {
        console.error("sendMessage error:", err);
        ack({ ok: false, error: "Could not send message." });
      }
    });

    // ---------------- EDIT ----------------
    socket.on("editMessage", async ({ messageId, message } = {}, ack) => {
      ack = safeAck(ack);
      try {
        const text = typeof message === "string" ? message.trim().slice(0, 5000) : "";
        if (!isId(messageId) || !text) return ack({ ok: false, error: "Nothing to save." });
        const msg = await Message.findOneAndUpdate(
          { _id: messageId, sender: me, deleted: { $ne: true }, fileType: "text", system: { $ne: true } },
          { $set: { message: text, isEdited: true } },
          { new: true }
        ).populate(MESSAGE_POPULATE);
        if (!msg) return ack({ ok: false, error: "You can only edit your own text messages." });
        const out = cleanMessage(msg);
        emitForMessage(io, out, "message:updated", out);
        ack({ ok: true, message: out });
      } catch (err) {
        console.error("Edit error:", err);
        ack({ ok: false, error: "Could not edit message." });
      }
    });

    // ---------------- DELETE (for everyone, soft) ----------------
    socket.on("deleteMessage", async ({ messageId } = {}, ack) => {
      ack = safeAck(ack);
      try {
        if (!isId(messageId)) return ack({ ok: false });
        const msg = await Message.findOneAndUpdate(
          { _id: messageId, sender: me, status: "sent" },
          { $set: { deleted: true, message: "" } },
          { new: true }
        ).populate(MESSAGE_POPULATE);
        if (!msg) return ack({ ok: false, error: "You can only delete your own messages." });
        const out = cleanMessage(msg);
        emitForMessage(io, out, "message:updated", out);
        ack({ ok: true, message: out });
      } catch (err) {
        console.error("Delete error:", err);
        ack({ ok: false, error: "Could not delete message." });
      }
    });

    // ---------------- TYPING ----------------
    socket.on("typing", ({ chatType, to, isTyping } = {}) => {
      const payload = { chatType, from: me, name: socket.data.user?.name, isTyping: !!isTyping };
      if (chatType === "group") {
        const code = String(to || "").toUpperCase();
        if (socket.rooms.has(spaceRoom(code))) socket.to(spaceRoom(code)).emit("typing", { ...payload, spaceId: code });
      } else if (isId(to)) {
        io.to(userRoom(to)).emit("typing", payload);
      }
    });

    // ---------------- DISCONNECT ----------------
    socket.on("disconnect", async () => {
      if (presence.remove(me, socket.id)) {
        const lastSeen = new Date();
        User.updateOne({ _id: me }, { $set: { lastSeen } }).catch(() => {});
        io.emit("presence", { userId: me, online: false, lastSeen });
      }
    });
  });
};

module.exports = socketLogic;
module.exports.deliverMessage = deliverMessage;
