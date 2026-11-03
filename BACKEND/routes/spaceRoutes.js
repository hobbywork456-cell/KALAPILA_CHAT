const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Space = require("../models/Space");
const Message = require("../models/Message");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { idStr, isId, USER_PUBLIC, previewText } = require("../utils/helpers");
const { userRoom, spaceRoom, deliverMessage } = require("../socket/delivery");
const presence = require("../socket/presence");

router.use(requireAuth);

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const CODE_RE = /^[A-Z0-9-]{3,20}$/;

const randomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const systemMessage = async (io, spaceId, userId, text) => {
  try {
    const msg = await Message.create({ chatType: "group", spaceId, sender: userId, message: text, system: true });
    await deliverMessage(io, msg._id);
  } catch (e) {
    console.warn("system message failed", e.message);
  }
};

const shapeSpace = (space, me, extra = {}) => {
  const mine = space.memberOf(me);
  return {
    _id: space._id,
    spaceId: space.spaceId,
    name: space.name,
    description: space.description,
    createdBy: space.createdBy,
    createdAt: space.createdAt,
    memberCount: space.members.length,
    myRole: mine?.role || "member",
    ...extra,
  };
};

// CREATE
router.post("/create", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    let code = (req.body.spaceId || "").trim().toUpperCase().replace(/\s+/g, "-");
    if (!name) return res.status(400).json({ message: "Please enter a space name." });

    if (!code) {
      do code = randomCode();
      while (await Space.exists({ spaceId: code }));
    }
    if (!CODE_RE.test(code))
      return res.status(400).json({ message: "Room code must be 3-20 letters, numbers or dashes." });
    if (await Space.exists({ spaceId: code }))
      return res.status(400).json({ message: `Room code "${code}" is already taken. Try another.` });

    const space = await Space.create({
      spaceId: code,
      name: name.slice(0, 60),
      description: (req.body.description || "").trim().slice(0, 300),
      createdBy: req.userId,
      members: [{ user: req.userId, role: "admin", joinedAt: new Date(), lastReadAt: new Date() }],
    });

    const io = req.app.get("io");
    io?.in(userRoom(req.userId)).socketsJoin(spaceRoom(code));

    res.status(201).json({ message: `Space "${space.name}" created!`, space: shapeSpace(space, req.userId, { unread: 0 }) });
  } catch (err) {
    console.error("Create space error:", err);
    res.status(500).json({ message: "Could not create space." });
  }
});

// JOIN
router.post("/join", async (req, res) => {
  try {
    const code = (req.body.spaceId || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ message: "Please enter a room code." });
    const space = await Space.findOne({ spaceId: code });
    if (!space) return res.status(404).json({ message: `No space found with code "${code}".` });

    const io = req.app.get("io");
    if (space.memberOf(req.userId)) {
      return res.json({ message: `You're already in "${space.name}".`, space: shapeSpace(space, req.userId, { unread: 0 }) });
    }

    space.members.push({ user: req.userId, role: "member", joinedAt: new Date(), lastReadAt: new Date() });
    await space.save();

    io?.in(userRoom(req.userId)).socketsJoin(spaceRoom(code));
    io?.to(spaceRoom(code)).emit("space:members-changed", { spaceId: code });
    const me = await User.findById(req.userId).select("name");
    systemMessage(io, code, req.userId, `${me?.name || "Someone"} joined the space`);

    res.json({ message: `Joined "${space.name}"!`, space: shapeSpace(space, req.userId, { unread: 0 }) });
  } catch (err) {
    console.error("Join space error:", err);
    res.status(500).json({ message: "Could not join space." });
  }
});

// MY SPACES (+ unread counts & last message)
const mySpaces = async (req, res) => {
  try {
    const me = req.userId;
    const spaces = await Space.find({ "members.user": oid(me) }).sort({ updatedAt: -1 });
    const out = await Promise.all(
      spaces.map(async (s) => {
        const mine = s.memberOf(me);
        const since = mine?.lastReadAt || mine?.joinedAt || new Date(0);
        const [unread, last] = await Promise.all([
          Message.countDocuments({
            chatType: "group",
            spaceId: s.spaceId,
            status: "sent",
            system: { $ne: true },
            sender: { $ne: oid(me) },
            createdAt: { $gt: since },
          }),
          Message.findOne({ chatType: "group", spaceId: s.spaceId, status: "sent" })
            .sort({ createdAt: -1 })
            .populate("sender", "name")
            .lean(),
        ]);
        return shapeSpace(s, me, {
          unread,
          lastMessage: last
            ? {
                text: last.system ? last.message : `${last.sender?.name?.split(" ")[0] || "Someone"}: ${previewText(last)}`,
                createdAt: last.createdAt,
              }
            : null,
        });
      })
    );
    out.sort((a, b) => new Date(b.lastMessage?.createdAt || b.createdAt) - new Date(a.lastMessage?.createdAt || a.createdAt));
    res.json(out);
  } catch (err) {
    console.error("My spaces error:", err);
    res.status(500).json({ message: "Could not load spaces." });
  }
};
router.get("/mine", mySpaces);
router.get("/user/:userId", mySpaces); // legacy alias

// MEMBERS
router.get("/:spaceId/members", async (req, res) => {
  try {
    const code = req.params.spaceId.toUpperCase();
    const space = await Space.findOne({ spaceId: code }).populate("members.user", USER_PUBLIC);
    if (!space) return res.status(404).json({ message: "Space not found." });
    if (!space.memberOf(req.userId)) return res.status(403).json({ message: "You are not a member of this space." });

    const members = space.members
      .filter((m) => m.user)
      .map((m) => ({
        _id: m.user._id,
        name: m.user.name,
        email: m.user.email,
        profilePic: m.user.profilePic || "",
        bio: m.user.bio || "",
        lastSeen: m.user.lastSeen,
        role: m.role,
        joinedAt: m.joinedAt,
        online: presence.isOnline(m.user._id),
      }))
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));

    res.json({ space: shapeSpace(space, req.userId), members });
  } catch (err) {
    console.error("Members error:", err);
    res.status(500).json({ message: "Could not load members." });
  }
});

// UPDATE (admin)
router.put("/:spaceId", async (req, res) => {
  const code = req.params.spaceId.toUpperCase();
  const space = await Space.findOne({ spaceId: code });
  if (!space) return res.status(404).json({ message: "Space not found." });
  if (space.memberOf(req.userId)?.role !== "admin") return res.status(403).json({ message: "Only admins can edit this space." });
  if (typeof req.body.name === "string" && req.body.name.trim()) space.name = req.body.name.trim().slice(0, 60);
  if (typeof req.body.description === "string") space.description = req.body.description.trim().slice(0, 300);
  await space.save();
  req.app.get("io")?.to(spaceRoom(code)).emit("space:updated", { spaceId: code, name: space.name, description: space.description });
  res.json({ space: shapeSpace(space, req.userId) });
});

const removeMember = async (req, space, userId) => {
  const io = req.app.get("io");
  const code = space.spaceId;
  const leaving = space.memberOf(userId);
  space.members = space.members.filter((m) => idStr(m.user) !== String(userId));

  if (space.members.length === 0) {
    await Message.deleteMany({ chatType: "group", spaceId: code });
    await space.deleteOne();
    io?.in(userRoom(userId)).socketsLeave(spaceRoom(code));
    return { deleted: true };
  }
  // Keep at least one admin
  if (leaving?.role === "admin" && !space.members.some((m) => m.role === "admin")) {
    space.members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    space.members[0].role = "admin";
  }
  await space.save();
  io?.in(userRoom(userId)).socketsLeave(spaceRoom(code));
  io?.to(userRoom(userId)).emit("space:removed", { spaceId: code });
  io?.to(spaceRoom(code)).emit("space:members-changed", { spaceId: code });
  return { deleted: false };
};

// LEAVE
const leave = async (req, res) => {
  try {
    const code = String(req.params.spaceId || req.body.spaceId || "").toUpperCase();
    const space = await Space.findOne({ spaceId: code });
    if (!space || !space.memberOf(req.userId)) return res.status(404).json({ message: "Space not found." });
    const me = await User.findById(req.userId).select("name");
    const r = await removeMember(req, space, req.userId);
    if (!r.deleted) systemMessage(req.app.get("io"), code, req.userId, `${me?.name || "Someone"} left the space`);
    res.json({ message: `You left "${space.name}".` });
  } catch (err) {
    console.error("Leave error:", err);
    res.status(500).json({ message: "Could not leave space." });
  }
};
router.post("/:spaceId/leave", leave);
router.post("/leave", leave); // legacy

// REMOVE MEMBER (admin)
router.delete("/:spaceId/members/:userId", async (req, res) => {
  const code = req.params.spaceId.toUpperCase();
  if (!isId(req.params.userId)) return res.status(400).json({ message: "Invalid user." });
  const space = await Space.findOne({ spaceId: code });
  if (!space) return res.status(404).json({ message: "Space not found." });
  if (space.memberOf(req.userId)?.role !== "admin") return res.status(403).json({ message: "Only admins can remove members." });
  if (!space.memberOf(req.params.userId)) return res.status(404).json({ message: "That user is not a member." });
  const target = await User.findById(req.params.userId).select("name");
  await removeMember(req, space, req.params.userId);
  systemMessage(req.app.get("io"), code, req.userId, `${target?.name || "A member"} was removed`);
  res.json({ message: "Member removed." });
});

// DELETE SPACE (admin)
router.delete("/:spaceId", async (req, res) => {
  const code = req.params.spaceId.toUpperCase();
  const space = await Space.findOne({ spaceId: code });
  if (!space) return res.status(404).json({ message: "Space not found." });
  if (space.memberOf(req.userId)?.role !== "admin") return res.status(403).json({ message: "Only admins can delete this space." });
  const io = req.app.get("io");
  io?.to(spaceRoom(code)).emit("space:removed", { spaceId: code, deleted: true });
  io?.in(spaceRoom(code)).socketsLeave(spaceRoom(code));
  await Message.deleteMany({ chatType: "group", spaceId: code });
  await space.deleteOne();
  res.json({ message: `Deleted "${space.name}".` });
});

module.exports = router;
