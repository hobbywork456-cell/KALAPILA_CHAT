const Message = require("../models/Message");
const User = require("../models/User");

const initMessageScheduler = (io) => {
  const checkAndReleaseScheduledMessages = async () => {
    try {
      const now = new Date();

      // 1. Find messages that are scheduled and time has passed
      const pendingMessages = await Message.find({
        status: "scheduled",
        scheduledTime: { $lte: now }
      });

      if (pendingMessages.length > 0) {
        for (let msg of pendingMessages) {
          // 2. Update status to 'sent'
          msg.status = "sent";
          await msg.save();

          // 3. Real-time delivery via Socket.io
          if (io) {
            const sender = await User.findById(msg.sender);
            const messageToEmit = msg.toObject();
            messageToEmit.senderName = sender?.name || "Someone";

            // Broadcast to all sockets (client-side filters for active chat)
            io.emit("receiveMessage", messageToEmit);

            console.log(`🕒 [Scheduler]: Message ${msg._id} released from ${msg.sender} (${sender?.name}) to ${msg.receiver}`);
          }
        }
      }
    } catch (err) {
      console.error("[Scheduler Error]:", err);
    }
  };

  // Run immediately on boot, then check every 10 seconds
  checkAndReleaseScheduledMessages();
  setInterval(checkAndReleaseScheduledMessages, 10000);
};

module.exports = initMessageScheduler;