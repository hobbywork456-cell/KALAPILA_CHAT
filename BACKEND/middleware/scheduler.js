const cron = require("node-cron");
const Message = require("../models/Message");

const initMessageScheduler = (io) => {
  // Runs every minute
  cron.schedule("* * * * *", async () => {
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
            // FIX: Changed .recipient to .receiver to match your schema
            const receiverId = msg.receiver.toString();
            const senderId = msg.sender.toString();

            // Emit 'receiveMessage' so the UI updates exactly like a normal message
            io.emit("receiveMessage", msg); 
            
            // Log it for your own tracking
            console.log(`[Scheduler]: Message ${msg._id} released from ${senderId} to ${receiverId}`);
          }
        }
      }
    } catch (err) {
      console.error("[Scheduler Error]:", err);
    }
  });
};

module.exports = initMessageScheduler;