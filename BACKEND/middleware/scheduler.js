const Message = require("../models/Message");
const { deliverMessage } = require("../socket/delivery");

// Releases scheduled messages when their time arrives and delivers them only to the
// people in that conversation (DM pair or space members).
const initMessageScheduler = (io) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await Message.find({ status: "scheduled", scheduledTime: { $lte: new Date() } })
        .select("_id")
        .limit(200)
        .lean();
      for (const { _id } of due) {
        const now = new Date();
        // Atomic claim so a message is never sent twice
        const r = await Message.collection.updateOne(
          { _id, status: "scheduled" },
          { $set: { status: "sent", createdAt: now, updatedAt: now } }
        );
        if (r.modifiedCount === 1) await deliverMessage(io, _id);
      }
    } catch (err) {
      console.error("[Scheduler]", err.message);
    } finally {
      running = false;
    }
  };
  tick();
  return setInterval(tick, 10000);
};

module.exports = initMessageScheduler;
