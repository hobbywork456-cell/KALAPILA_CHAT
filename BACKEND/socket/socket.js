const Message = require("../models/Message");

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

    // ✅ SEND MESSAGE
    socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
      try {
        if (!senderId || !receiverId || !message?.trim()) return;

        const sender = senderId.toString();
        const receiver = receiverId.toString();

        // Save to DB
        const newMessage = await Message.create({
          sender,
          receiver,
          message,
        });

        const receiverSocket = users[receiver];

        // Send to receiver if online
        if (receiverSocket) {
          io.to(receiverSocket).emit("receiveMessage", newMessage);
        }

        // Always send back to sender
        socket.emit("receiveMessage", newMessage);
      } catch (err) {
        console.error("❌ Send Message Error:", err);
      }
    });

    // ✅ GET CHAT HISTORY
    socket.on("getMessages", async ({ senderId, receiverId }) => {
      try {
        if (!senderId || !receiverId) return;

        const sender = senderId.toString();
        const receiver = receiverId.toString();

        const messages = await Message.find({
          $or: [
            { sender: sender, receiver: receiver },
            { sender: receiver, receiver: sender },
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