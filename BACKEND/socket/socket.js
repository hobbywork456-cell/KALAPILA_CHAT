const Message = require("../models/Message");
const User = require("../models/User");

// Mapping of userId to socketId
let users = {}; 

const socketLogic = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // 1. JOIN (Store user mapping)
    socket.on("join", (userId) => {
      if (userId) {
        users[userId.toString()] = socket.id;
        console.log(`👤 User ${userId} associated with socket ${socket.id}`);
      }
    });

    // 2. SEND / SCHEDULE (Merged Text & Media Logic)
    socket.on("sendMessage", async ({ senderId, receiverId, message, fileUrl, fileType, scheduledTime }) => {
  try {
    let finalFileUrl = fileUrl;

    // 1. Handle Binary to Base64 conversion (prevents the 'Maximum call stack' crash)
    if (fileUrl instanceof Buffer || fileUrl instanceof ArrayBuffer) {
      const b64 = Buffer.from(fileUrl).toString("base64");
      const mime = fileType === "image" ? "image/jpeg" : fileType === "video" ? "video/mp4" : "audio/mpeg";
      finalFileUrl = `data:${mime};base64,${b64}`;
    }

    const sender = await User.findById(senderId);
    if (!sender) return;

    // 2. Create the message in the database
    const newMessage = await Message.create({
      subscriptionId: sender.subscriptionId,
      sender: senderId,
      receiver: receiverId,
      message: message || "",
      fileUrl: finalFileUrl, 
      fileType: fileType || "text",
      status: scheduledTime ? "scheduled" : "sent",
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null
    });

    // 3. Prepare the message for the Frontend
    // We convert the Mongoose document to a plain JS object so we can add properties
    const messageWithSender = newMessage.toObject();
    messageWithSender.senderName = sender.name; // <--- Attach the NAME here

    if (!scheduledTime) {
      const recSocket = users[receiverId.toString()];
      if (recSocket) {
        // Send the message including the senderName to the receiver
        io.to(recSocket).emit("receiveMessage", messageWithSender);
      }
    }
    
    // Send it back to the sender as well
    socket.emit("receiveMessage", messageWithSender);

  } catch (err) {
    console.error("Upload Error:", err);
  }
});
    // 3. EDIT
    socket.on("editMessage", async ({ messageId, newMessage, senderId }) => {
      try {
        const msg = await Message.findOneAndUpdate(
          { _id: messageId, sender: senderId }, 
          { message: newMessage, isEdited: true },
          { new: true }
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
          break;
        }
      }
    });
  });
};

module.exports = socketLogic;