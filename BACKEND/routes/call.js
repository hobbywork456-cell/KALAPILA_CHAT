// socket/call.js
const callLogic = (socket, io, users) => {
  const emitToUser = (userId, event, payload, fallbackSocketId) => {
    if (!userId && !fallbackSocketId) return false;
    const userIdStr = userId?.toString();
    const targetSocket = fallbackSocketId || (userIdStr ? users[userIdStr] : null);
    console.log(`[Call]: Emitting '${event}' to user ${userIdStr || fallbackSocketId}`);

    let delivered = false;
    if (targetSocket) {
      io.to(targetSocket).emit(event, payload);
      delivered = true;
    }
    if (userIdStr) {
      io.to(userIdStr).emit(event, payload);
      delivered = true;
    }
    return delivered;
  };

  // 1. Initiate Call
  socket.on("call-user", ({ to, from, offer, name, callerName, caller, callType, toSocketId }) => {
    const callerNameFinal = caller?.name || name || callerName || "Kalapila User";
    const callerEmailFinal = caller?.email || "";
    const callerProfilePicFinal = caller?.profilePic || "";

    console.log("call-user received:", { to, from, callerName: callerNameFinal, callType, toSocketId });

    const delivered = emitToUser(to, "incoming-call", {
      from,
      _id: from,
      name: callerNameFinal,
      email: callerEmailFinal,
      profilePic: callerProfilePicFinal,
      offer,
      callType: callType || "video",
      fromSocketId: socket.id,
    }, toSocketId);

    if (delivered) {
      socket.emit("call-ringing");
    } else {
      socket.emit("call-failed", { message: "Recipient is not reachable right now." });
    }
  });

  // 2. Answer Call
  socket.on("answer-call", ({ to, answer, toSocketId }) => {
    emitToUser(to, "call-answered", { answer }, toSocketId);
  });

  // 3. ICE Candidate Exchange
  socket.on("ice-candidate", ({ to, candidate, toSocketId }) => {
    emitToUser(to, "ice-candidate", { candidate }, toSocketId);
  });

  // 4. End Call
  socket.on("end-call", ({ to, toSocketId }) => {
    emitToUser(to, "call-ended", {}, toSocketId);
  });

  // 5. Reject Call
  socket.on("reject-call", ({ to, toSocketId, reason }) => {
    emitToUser(to, "call-rejected", { reason: reason || "declined" }, toSocketId);
  });

  // 6. Media State Toggled (Mute Mic, Disable Cam)
  socket.on("toggle-media", ({ to, toSocketId, isMuted, isVideoOff }) => {
    emitToUser(to, "peer-media-toggled", { isMuted, isVideoOff }, toSocketId);
  });

  // 7. Switch Call Type (Audio <-> Video)
  socket.on("switch-call-type", ({ to, toSocketId, newType }) => {
    emitToUser(to, "call-type-switched", { newType }, toSocketId);
  });
};

module.exports = callLogic;