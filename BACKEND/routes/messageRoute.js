const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Space = require("../models/Space");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { isId, idStr, MESSAGE_POPULATE, USER_PUBLIC, cleanMessage, previewText } = require("../utils/helpers");
const { userRoom, spaceRoom } = require("../socket/delivery");
const presence = require("../socket/presence");

router.use(requireAuth);

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const PAGE = 40;

// --- DIRECT MESSAGE CONVERSATIONS (inbox) ---
router.get("/conversations", async (req, res) => {
  try {
    const me = req.userId;
    const msgs = await Message.find({
      status: "sent",
      chatType: { $ne: "group" },
      $or: [{ sender: oid(me) }, { receiver: oid(me) }],
    })
      .sort({ createdAt: -1 })
      .limit(3000)
      .lean();

    const latest = new Map();
    for (const m of msgs) {
      if (!m.receiver) continue;
      const partner = idStr(m.sender) === me ? idStr(m.receiver) : idStr(m.sender);
      if (partner === me || latest.has(partner)) continue;
      latest.set(partner, m);
    }

    const unreadDocs = await Message.find({ receiver: oid(me), seen: false, status: "sent", chatType: { $ne: "group" } })
      .select("sender")
      .lean();
    const unread = {};
    for (const u of unreadDocs) unread[idStr(u.sender)] = (unread[idStr(u.sender)] || 0) + 1;

    const users = await User.find({ _id: { $in: Array.from(latest.keys()).map(oid) } }).select(USER_PUBLIC).lean();
    const result = users
      .map((u) => {
        const m = latest.get(idStr(u._id));
        return {
          user: { ...u, online: presence.isOnline(u._id) },
          lastMessage: {
            _id: m._id,
            text: previewText(m),
            createdAt: m.createdAt,
            sender: idStr(m.sender),
            seen: !!m.seen,
          },
          unread: unread[idStr(u._id)] || 0,
        };
      })
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json(result);
  } catch (err) {
    console.error("Conversations error:", err);
    res.status(500).json({ message: "Could not load conversations." });
  }
});

const pageQuery = (req) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || PAGE, 100);
  const before = req.query.before ? new Date(req.query.before) : null;
  return { limit, before: before && !isNaN(before) ? before : null };
};

const sendPage = async (res, filter, { limit, before }) => {
  if (before) filter.createdAt = { $lt: before };
  const docs = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate(MESSAGE_POPULATE).lean();
  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit).reverse().map(cleanMessage);
  res.json({ messages: page, hasMore });
};

// --- DM HISTORY ---
router.get("/dm/:userId", async (req, res) => {
  try {
    const me = req.userId;
    const other = req.params.userId;
    if (!isId(other)) return res.status(400).json({ message: "Invalid user." });
    await sendPage(
      res,
      {
        status: "sent",
        chatType: { $ne: "group" },
        $or: [
          { sender: oid(me), receiver: oid(other) },
          { sender: oid(other), receiver: oid(me) },
        ],
      },
      pageQuery(req)
    );
  } catch (err) {
    console.error("DM history error:", err);
    res.status(500).json({ message: "Could not load messages." });
  }
});

// --- SPACE GROUP HISTORY ---
router.get("/space/:spaceId", async (req, res) => {
  try {
    const code = req.params.spaceId.toUpperCase();
    const space = await Space.findOne({ spaceId: code });
    if (!space || !space.memberOf(req.userId))
      return res.status(403).json({ message: "You are not a member of this space." });
    await sendPage(res, { status: "sent", chatType: "group", spaceId: code }, pageQuery(req));
  } catch (err) {
    console.error("Space history error:", err);
    res.status(500).json({ message: "Could not load messages." });
  }
});

// --- MARK AS READ ---
router.post("/read", async (req, res) => {
  try {
    const { chatType, id } = req.body;
    const io = req.app.get("io");
    const me = req.userId;

    if (chatType === "group") {
      const code = String(id || "").toUpperCase();
      const space = await Space.findOne({ spaceId: code });
      const member = space?.memberOf(me);
      if (member) {
        member.lastReadAt = new Date();
        await space.save({ timestamps: false });
      }
      return res.json({ ok: true });
    }

    if (!isId(id)) return res.status(400).json({ message: "Invalid chat." });
    const now = new Date();
    const r = await Message.updateMany(
      { sender: oid(id), receiver: oid(me), seen: false, status: "sent" },
      { $set: { seen: true, seenAt: now } }
    );
    if (r.modifiedCount > 0) {
      // Let the sender know their messages were read (blue ticks)
      io?.to(userRoom(id)).emit("messages:read", { by: me, at: now });
    }
    res.json({ ok: true, updated: r.modifiedCount });
  } catch (err) {
    console.error("Read error:", err);
    res.status(500).json({ message: "Could not update read status." });
  }
});

// --- SCHEDULED MESSAGES (mine, for one chat) ---
router.get("/scheduled", async (req, res) => {
  try {
    const { chatType, id } = req.query;
    const filter = { sender: oid(req.userId), status: "scheduled" };
    if (chatType === "group") {
      filter.chatType = "group";
      filter.spaceId = String(id || "").toUpperCase();
    } else if (id) {
      if (!isId(id)) return res.json([]);
      filter.receiver = oid(id);
    }
    const docs = await Message.find(filter).sort({ scheduledTime: 1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Could not load scheduled messages." });
  }
});

router.delete("/scheduled/:id", async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid id." });
  const r = await Message.deleteOne({ _id: req.params.id, sender: oid(req.userId), status: "scheduled" });
  if (!r.deletedCount) return res.status(404).json({ message: "Scheduled message not found." });
  res.json({ ok: true });
});

module.exports = router;
