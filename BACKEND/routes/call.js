// socket/call.js
const callLogic = (socket, io, users) => {
  const emitToUser = (userId, event, payload, fallbackSocketId) => {
    if (!userId && !fallbackSocketId) return false;
    const targetSocket = fallbackSocketId || users[userId?.toString()];
    console.log("emitToUser", { userId, targetSocket, event });
    if (targetSocket) {
      io.to(targetSocket).emit(event, payload);
      return true;
    }
    return false;
  };

  socket.on("call-user", ({ to, from, offer, name, callerName, callType, toSocketId }) => {
    console.log("call-user received", { to, from, callType, targetSocket: users[to?.toString()], toSocketId });
    const delivered = emitToUser(to, "incoming-call", {
      from,
      name: name || callerName || "Unknown",
      offer,
      callType: callType || "video",
      fromSocketId: socket.id,
    }, toSocketId);

    if (!delivered) {
      socket.emit("call-failed", { message: "Recipient is not online yet" });
    }
  });

  socket.on("answer-call", ({ to, answer, toSocketId }) => {
    emitToUser(to, "call-answered", { answer }, toSocketId);
  });

  socket.on("ice-candidate", ({ to, candidate, toSocketId }) => {
    emitToUser(to, "ice-candidate", { candidate }, toSocketId);
  });

  socket.on("end-call", ({ to, toSocketId }) => {
    emitToUser(to, "end-call", {}, toSocketId);
  });

  socket.on("reject-call", ({ to }) => {
    emitToUser(to, "call-rejected");
  });
};

module.exports = callLogic;