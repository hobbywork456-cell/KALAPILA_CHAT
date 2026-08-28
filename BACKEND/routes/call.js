// socket/call.js
const callLogic = (socket, io, users) => {
  const emitToUser = (targetId, event, payload, fallbackSocketId, targetEmail) => {
    const idStr = targetId?.toString();
    const emailStr = targetEmail?.toString().trim().toLowerCase();

    // Check if target is directly an email
    const isDirectEmail = idStr && idStr.includes("@");
    const cleanEmail = isDirectEmail ? idStr.toLowerCase() : emailStr;
    const cleanId = isDirectEmail ? null : idStr;

    let targetSocket = fallbackSocketId;
    if (!targetSocket && cleanId && users[cleanId]) {
      targetSocket = users[cleanId];
    }
    if (!targetSocket && cleanEmail && users[cleanEmail]) {
      targetSocket = users[cleanEmail];
    }

    console.log(`[Call]: Emitting '${event}' to (id: ${cleanId}, email: ${cleanEmail}, socket: ${targetSocket || fallbackSocketId})`);

    let delivered = false;

    if (targetSocket) {
      io.to(targetSocket).emit(event, payload);
      delivered = true;
    }
    if (cleanId && cleanId !== targetSocket) {
      io.to(cleanId).emit(event, payload);
      delivered = true;
    }
    if (cleanEmail && cleanEmail !== targetSocket) {
      io.to(cleanEmail).emit(event, payload);
      delivered = true;
    }

    return delivered;
  };

  // 1. Initiate Call
  socket.on("call-user", ({ to, toEmail, from, offer, name, callerName, caller, callType, toSocketId }) => {
    const callerNameFinal = caller?.name || name || callerName || "Kalapila User";
    const callerEmailFinal = caller?.email || "";
    const callerProfilePicFinal = caller?.profilePic || "";

    console.log("📞 call-user received:", { to, toEmail, from, callerName: callerNameFinal, callType, toSocketId });

    const delivered = emitToUser(
      to,
      "incoming-call",
      {
        from,
        _id: from,
        name: callerNameFinal,
        email: callerEmailFinal,
        profilePic: callerProfilePicFinal,
        offer,
        callType: callType || "video",
        fromSocketId: socket.id,
      },
      toSocketId,
      toEmail
    );

    if (delivered) {
      socket.emit("call-ringing");
    } else {
      socket.emit("call-failed", { message: "Recipient is not reachable right now." });
    }
  });

  // 2. Answer Call
  socket.on("answer-call", ({ to, toEmail, answer, toSocketId }) => {
    console.log("✅ answer-call received for:", { to, toEmail, toSocketId });
    emitToUser(to, "call-answered", { answer, fromSocketId: socket.id }, toSocketId, toEmail);
  });

  // 3. ICE Candidate Exchange
  socket.on("ice-candidate", ({ to, toEmail, candidate, toSocketId }) => {
    emitToUser(to, "ice-candidate", { candidate, fromSocketId: socket.id }, toSocketId, toEmail);
  });

  // 4. End Call
  socket.on("end-call", ({ to, toEmail, toSocketId }) => {
    emitToUser(to, "call-ended", { fromSocketId: socket.id }, toSocketId, toEmail);
  });

  // 5. Reject Call
  socket.on("reject-call", ({ to, toEmail, toSocketId, reason }) => {
    emitToUser(to, "call-rejected", { reason: reason || "declined", fromSocketId: socket.id }, toSocketId, toEmail);
  });

  // 6. Media State Toggled (Mute Mic, Disable Cam)
  socket.on("toggle-media", ({ to, toEmail, toSocketId, isMuted, isVideoOff }) => {
    emitToUser(to, "peer-media-toggled", { isMuted, isVideoOff, fromSocketId: socket.id }, toSocketId, toEmail);
  });

  // 7. Switch Call Type (Audio <-> Video)
  socket.on("switch-call-type", ({ to, toEmail, toSocketId, newType }) => {
    emitToUser(to, "call-type-switched", { newType, fromSocketId: socket.id }, toSocketId, toEmail);
  });
};

module.exports = callLogic;