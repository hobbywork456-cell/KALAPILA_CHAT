const Message = require("../models/Message");
const User = require("../models/User");
const callLogic = require("../routes/call");

// Mapping of userId to socketId
let users = {};

const socketLogic = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    callLogic(socket, io, users);

    // Helper to register user
    const registerUser = async (data) => {
      if (!data) return;
      let userId = typeof data === "object" ? data.userId : data;
      let email = typeof data === "object" ? data.email : null;

      if (!userId && !email) return;

      if (userId) {
        const normalizedId = userId.toString();
        users[normalizedId] = socket.id;
        socket.data.userId = normalizedId;
        socket.join(normalizedId);
        console.log(`👤 User ID ${normalizedId} associated with socket ${socket.id}`);
      }

      if (email) {
        const normalizedEmail = email.trim().toLowerCase();
        users[normalizedEmail] = socket.id;
        socket.data.email = normalizedEmail;
        socket.join(normalizedEmail);
        console.log(`📧 User Email ${normalizedEmail} associated with socket ${socket.id}`);
      } else if (userId && !email) {
        // Asynchronously fetch email to also map email -> socket
        try {
          const userDoc = await User.findById(userId).select("email");
          if (userDoc?.email) {
            const userEmail = userDoc.email.trim().toLowerCase();
            users[userEmail] = socket.id;
            socket.data.email = userEmail;
            socket.join(userEmail);
            console.log(`📧 [Auto-linked] ${userEmail} -> socket ${socket.id}`);
          }
        } catch (e) {
          // Ignore DB lookup error if userId is not an ObjectId
        }
      }

      const primaryId = userId ? userId.toString() : email;
      socket.emit("joined", { userId: primaryId, socketId: socket.id });
      io.emit("presence-update", { userId: primaryId, socketId: socket.id, online: true });
    };

    // 1. JOIN (Store user mapping & join user room)
    socket.on("join", (data) => {
      registerUser(data);
    });

    socket.on("get-online-users", () => {
      const onlineUsers = Object.entries(users).map(([userId, socketId]) => ({ userId, socketId }));
      socket.emit("online-users", onlineUsers);
    });

    // 2. SEND / SCHEDULE (Merged Text & Media Logic)
    socket.on("sendMessage", async ({ senderId, receiverId, message, fileUrl, fileType, scheduledTime }) => {
      try {
        if (!senderId) {
          console.error("SendMessage Error: senderId is required");
          return;
        }

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
        if (!sender) {
          console.warn(`SendMessage: Sender not found for ID ${senderId}`);
        }

        const newMessage = await Message.create({
          subscriptionId: sender?.subscriptionId || "",
          spaceId: sender?.spaceId || "",
          sender: senderId,
          receiver: receiverId || null,
          message: message || "",
          fileUrl: finalFileUrl, // Safely stored as Base64 or URL
          fileType: fileType || "text",
          status: scheduledTime ? "scheduled" : "sent",
          scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        });

        const messageToEmit = newMessage.toObject();
        messageToEmit.senderName = sender?.name || "User";

        if (!scheduledTime) {
          const senderIdStr = senderId.toString();
          const receiverIdStr = receiverId ? receiverId.toString() : null;

          // Deliver to receiver via socket ID and room
          if (receiverIdStr) {
            const recSocket = users[receiverIdStr];
            if (recSocket && recSocket !== socket.id) {
              io.to(recSocket).emit("receiveMessage", messageToEmit);
            }
            io.to(receiverIdStr).emit("receiveMessage", messageToEmit);
          }

          // Deliver back to sender socket and sender room (for other open tabs)
          socket.emit("receiveMessage", messageToEmit);
          io.to(senderIdStr).emit("receiveMessage", messageToEmit);
        } else {
          // If scheduled, notify sender with confirmation
          socket.emit("messageScheduled", {
            message: `Message scheduled for ${new Date(scheduledTime).toLocaleString()}`,
            data: messageToEmit
          });
        }

      } catch (err) {
        console.error("Critical Upload/SendMessage Error:", err);
      }
    });

    // 3. EDIT
    socket.on("editMessage", async ({ messageId, newMessage, senderId }) => {
      try {
        if (!messageId || !senderId) return;

        const msg = await Message.findOneAndUpdate(
          { _id: messageId, sender: senderId },
          { message: newMessage, isEdited: true },
          { new: true, returnDocument: 'after' }
        );

        if (msg) {
          const senderIdStr = msg.sender?.toString();
          const receiverIdStr = msg.receiver?.toString();

          // Acknowledge directly to sending socket
          socket.emit("messageUpdated", msg);

          if (senderIdStr) {
            io.to(senderIdStr).emit("messageUpdated", msg);
            const senderSocket = users[senderIdStr];
            if (senderSocket && senderSocket !== socket.id) {
              io.to(senderSocket).emit("messageUpdated", msg);
            }
          }

          if (receiverIdStr) {
            io.to(receiverIdStr).emit("messageUpdated", msg);
            const receiverSocket = users[receiverIdStr];
            if (receiverSocket) {
              io.to(receiverSocket).emit("messageUpdated", msg);
            }
          }
        }
      } catch (err) {
        console.error("Edit Error:", err);
      }
    });

    // 4. DELETE
    socket.on("deleteMessage", async ({ messageId, senderId }) => {
      try {
        if (!messageId || !senderId) return;

        const msg = await Message.findOneAndDelete({ _id: messageId, sender: senderId });

        if (msg) {
          const senderIdStr = msg.sender?.toString();
          const receiverIdStr = msg.receiver?.toString();

          // Acknowledge directly to sending socket
          socket.emit("messageDeleted", messageId);

          if (senderIdStr) {
            io.to(senderIdStr).emit("messageDeleted", messageId);
            const senderSocket = users[senderIdStr];
            if (senderSocket && senderSocket !== socket.id) {
              io.to(senderSocket).emit("messageDeleted", messageId);
            }
          }

          if (receiverIdStr) {
            io.to(receiverIdStr).emit("messageDeleted", messageId);
            const receiverSocket = users[receiverIdStr];
            if (receiverSocket) {
              io.to(receiverSocket).emit("messageDeleted", messageId);
            }
          }
        }
      } catch (err) {
        console.error("Delete Error:", err);
      }
    });

    // 5. GET HISTORY (SENT ONLY)
    socket.on("getMessages", async ({ senderId, receiverId }) => {
      try {
        if (!senderId || !receiverId) return;

        const messages = await Message.find({
          status: "sent",
          $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId }
          ]
        }).sort({ createdAt: 1 });

        socket.emit("messageHistory", messages);
      } catch (err) {
        console.error("History Error:", err);
      }
    });

    // 6. DISCONNECT (Cleanup)
    socket.on("disconnect", (reason) => {
      let notifiedUserId = null;
      for (const key in users) {
        if (users[key] === socket.id) {
          console.log(`🔴 User/Email ${key} disconnected (${reason})`);
          delete users[key];
          if (!notifiedUserId) notifiedUserId = key;
        }
      }
      if (notifiedUserId) {
        io.emit("presence-update", { userId: notifiedUserId, socketId: socket.id, online: false });
      }
    });
  });
};

module.exports = socketLogic;