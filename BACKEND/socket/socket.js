const Message = require("../models/Message");
const User = require("../models/User");

let users = {}; // { userId: socketId }

const socketLogic = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // ✅ JOIN USER
    socket.on("join", (userId) => {
      if (!userId) return;
      users[userId.toString()] = socket.id;
      console.log("👤 Joined:", userId);
    });

    // ✅ SEND MESSAGE (Scoped by Subscription)
    socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
      try {
        if (!senderId || !receiverId || !message?.trim()) return;

        // 🔍 1. Verify both users belong to the same subscription
        const senderUser = await User.findById(senderId);
        const receiverUser = await User.findById(receiverId);

        if (!senderUser || !receiverUser) return;

        // 🔥 BLOCK if they are from different companies
        if (senderUser.subscriptionId !== receiverUser.subscriptionId) {
          console.warn("🚫 Security Alert: Cross-subscription message blocked!");
          return;
        }

        // 2. Save to DB with subscriptionId
        const newMessage = await Message.create({
          subscriptionId: senderUser.subscriptionId,
          sender: senderId,
          receiver: receiverId,
          message: message.trim(),
        });

        const receiverSocket = users[receiverId.toString()];

        // 3. Send to receiver if online
        if (receiverSocket) {
          io.to(receiverSocket).emit("receiveMessage", newMessage);
        }

        // 4. Always send back to sender
        socket.emit("receiveMessage", newMessage);
      } catch (err) {
        console.error("❌ Send Message Error:", err);
      }
    });

    // ✅ GET CHAT HISTORY (Scoped by Subscription)
    socket.on("getMessages", async ({ senderId, receiverId }) => {
      try {
        if (!senderId || !receiverId) return;

        // 🔍 Verify sender to get their subscriptionId
        const requester = await User.findById(senderId);
        if (!requester) return;

        const messages = await Message.find({
          subscriptionId: requester.subscriptionId, // 🔥 ONLY fetch within this company
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId },
          ],
        }).sort({ createdAt: 1 });

        socket.emit("messageHistory", messages);
      } catch (err) {
        console.error("❌ Fetch Messages Error:", err);
      }
    });

    // ❌ DISCONNECT
    socket.on("disconnect", () => {
      console.log("🔴 User disconnected:", socket.id);
      for (let userId in users) {
        if (users[userId] === socket.id) {
          delete users[userId];
          break;
        }
      }
    });
  });
};

module.exports = socketLogic;