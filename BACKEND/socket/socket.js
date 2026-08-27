const Message = require("../models/Message");
const User = require("../models/User");
const callLogic = require("../routes/call");
// Mapping of userId to socketId
let users = {};

const socketLogic = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    callLogic(socket, io, users);

    // 1. JOIN (Store user mapping)
    socket.on("join", (userId) => {
      if (userId) {
        const normalizedId = userId.toString();
        users[normalizedId] = socket.id;
        socket.data.userId = normalizedId;
        console.log(`👤 User ${normalizedId} associated with socket ${socket.id}`);
        console.log("Current user map:", users);
        socket.emit("joined", { userId: normalizedId, socketId: socket.id });
        io.emit("presence-update", { userId: normalizedId, socketId: socket.id, online: true });
      }
    });

    socket.on("get-online-users", () => {
      const onlineUsers = Object.entries(users).map(([userId, socketId]) => ({ userId, socketId }));
      socket.emit("online-users", onlineUsers);
    });

    // 2. SEND / SCHEDULE (Merged Text & Media Logic)
    socket.on("sendMessage", async ({ senderId, receiverId, message, fileUrl, fileType, scheduledTime }) => {
      try {
        let finalFileUrl = fileUrl;

        // Check if the data is binary (ArrayBuffer/Buffer)
        if (fileUrl instanceof Buffer || fileUrl instanceof ArrayBuffer) {
          const b64 = Buffer.from(fileUrl).toString("base64");

          // Determine the correct MIME type prefix
          const mime = fileType === "image" ? "image/jpeg" :
            fileType === "video" ? "video/mp4" : "audio/mpeg";

          finalFileUrl = `data:${mime};base64,${b64}`;
        }

        const sender = await User.findById(senderId);
        if (!sender) return;

        const newMessage = await Message.create({
          subscriptionId: sender.subscriptionId || "",
          spaceId: sender.spaceId || "",
          sender: senderId,
          receiver: receiverId,
          message: message || "",
          fileUrl: finalFileUrl, // Safely stored as Base64 or URL
          fileType: fileType || "text",
          status: scheduledTime ? "scheduled" : "sent",
          scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        });

        const messageToEmit = newMessage.toObject();
        messageToEmit.senderName = sender.name;

        if (!scheduledTime) {
          const recSocket = users[receiverId.toString()];
          if (recSocket) io.to(recSocket).emit("receiveMessage", messageToEmit);
          socket.emit("receiveMessage", messageToEmit);
        } else {
          // If scheduled, notify sender with confirmation
          socket.emit("messageScheduled", {
            message: `Message scheduled for ${new Date(scheduledTime).toLocaleString()}`,
            data: messageToEmit
          });
        }

      } catch (err) {
        console.error("Critical Upload Error:", err);
      }
    });
    // 3. EDIT
    socket.on("editMessage", async ({ messageId, newMessage, senderId }) => {
      try {
        const msg = await Message.findOneAndUpdate(
          { _id: messageId, sender: senderId },
          { message: newMessage, isEdited: true },
          { returnDocument: 'after' }
        );

        if (msg) {
          const senderSocket = users[msg.sender.toString()];
          const receiverSocket = users[msg.receiver.toString()];

          if (senderSocket) io.to(senderSocket).emit("messageUpdated", msg);
          if (receiverSocket) io.to(receiverSocket).emit("messageUpdated", msg);
        }
      } catch (err) { console.error("Edit Error:", err); }
    });

    // 4. DELETE
    socket.on("deleteMessage", async ({ messageId, senderId }) => {
      try {
        const msg = await Message.findOneAndDelete({ _id: messageId, sender: senderId });

        if (msg) {
          const senderSocket = users[msg.sender.toString()];
          const receiverSocket = users[msg.receiver.toString()];

          if (senderSocket) io.to(senderSocket).emit("messageDeleted", messageId);
          if (receiverSocket) io.to(receiverSocket).emit("messageDeleted", messageId);
        }
      } catch (err) { console.error("Delete Error:", err); }
    });

    // 5. GET HISTORY (SENT ONLY)
    socket.on("getMessages", async ({ senderId, receiverId }) => {
      try {
        const messages = await Message.find({
          status: "sent",
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId }
          ]
        }).sort({ createdAt: 1 });

        socket.emit("messageHistory", messages);
      } catch (err) { console.error("History Error:", err); }
    });

    // 6. DISCONNECT (Cleanup)
    socket.on("disconnect", () => {
      for (const userId in users) {
        if (users[userId] === socket.id) {
          console.log(`🔴 User ${userId} disconnected`);
          delete users[userId];
          io.emit("presence-update", { userId, socketId: socket.id, online: false });
          break;
        }
      }
    });
  });
};

module.exports = socketLogic;