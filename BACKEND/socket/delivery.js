const Message = require("../models/Message");
const { MESSAGE_POPULATE, idStr } = require("../utils/helpers");

const userRoom = (id) => `user:${idStr(id)}`;
const spaceRoom = (spaceId) => `space:${String(spaceId).toUpperCase()}`;

// Load a message with sender + reply info, as a plain object for the client.
const loadMessage = async (id) => Message.findById(id).populate(MESSAGE_POPULATE).lean();

// Emit an event to everyone who should see a message (both DM participants, or the whole space).
const emitForMessage = (io, msg, event, payload = msg) => {
  if (!io || !msg) return;
  if (msg.chatType === "group" && msg.spaceId) {
    io.to(spaceRoom(msg.spaceId)).emit(event, payload);
  } else {
    const rooms = [userRoom(msg.sender)];
    if (msg.receiver) rooms.push(userRoom(msg.receiver));
    io.to(rooms).emit(event, payload);
  }
};

const deliverMessage = async (io, messageId) => {
  const msg = await loadMessage(messageId);
  if (msg) emitForMessage(io, msg, "message:new", msg);
  return msg;
};

module.exports = { userRoom, spaceRoom, loadMessage, emitForMessage, deliverMessage };
