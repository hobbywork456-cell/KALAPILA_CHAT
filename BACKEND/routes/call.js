// WebRTC call signalling over Socket.IO.
// A call is tracked on the server so we can handle busy users, multiple devices,
// ring time-outs and dropped connections reliably.
const crypto = require("crypto");
const { isId } = require("../utils/helpers");
const { userRoom } = require("../socket/delivery");
const presence = require("../socket/presence");

const RING_TIMEOUT_MS = 45 * 1000;
const calls = new Map(); // callId -> call
const userCall = new Map(); // userId -> callId

const cleanup = (call) => {
  if (!call) return;
  clearTimeout(call.timer);
  calls.delete(call.id);
  if (userCall.get(call.callerId) === call.id) userCall.delete(call.callerId);
  if (userCall.get(call.calleeId) === call.id) userCall.delete(call.calleeId);
};

const callLogic = (socket, io) => {
  const me = socket.data.userId;
  const ack0 = (a) => (typeof a === "function" ? a : () => {});

  // Who is "the other side" of this call for the current socket?
  const otherTarget = (call) => {
    if (socket.id === call.callerSocket) return call.calleeSocket || userRoom(call.calleeId);
    if (socket.id === call.calleeSocket) return call.callerSocket;
    return null;
  };

  // 1. Start a call
  socket.on("call-user", ({ to, offer, callType } = {}, ack) => {
    ack = ack0(ack);
    if (!isId(to) || to === me || !offer) return ack({ ok: false, reason: "invalid" });
    if (userCall.has(me)) {
      // stale call of mine (e.g. refreshed page) – end it
      const old = calls.get(userCall.get(me));
      if (old) {
        io.to([old.callerSocket, old.calleeSocket || userRoom(old.calleeId)].filter(Boolean)).emit("call-ended", { callId: old.id, reason: "ended" });
        cleanup(old);
      }
    }
    if (!presence.isOnline(to)) return ack({ ok: false, reason: "offline" });
    if (userCall.has(to)) return ack({ ok: false, reason: "busy" });

    const call = {
      id: crypto.randomBytes(8).toString("hex"),
      callerId: me,
      callerSocket: socket.id,
      calleeId: to,
      calleeSocket: null,
      type: callType === "audio" ? "audio" : "video",
      state: "ringing",
    };
    call.timer = setTimeout(() => {
      if (calls.get(call.id)?.state === "ringing") {
        io.to([call.callerSocket, userRoom(call.calleeId)]).emit("call-ended", { callId: call.id, reason: "no-answer" });
        cleanup(call);
      }
    }, RING_TIMEOUT_MS);
    calls.set(call.id, call);
    userCall.set(me, call.id);
    userCall.set(to, call.id);

    io.to(userRoom(to)).emit("incoming-call", {
      callId: call.id,
      from: socket.data.user,
      offer,
      callType: call.type,
    });
    ack({ ok: true, callId: call.id });
  });

  // 2. Callee answers (on one of their devices)
  socket.on("answer-call", ({ callId, answer } = {}, ack) => {
    ack = ack0(ack);
    const call = calls.get(callId);
    if (!call || call.calleeId !== me || call.state !== "ringing") return ack({ ok: false });
    call.state = "active";
    call.calleeSocket = socket.id;
    clearTimeout(call.timer);
    io.to(call.callerSocket).emit("call-answered", { callId, answer });
    socket.to(userRoom(me)).emit("call-handled-elsewhere", { callId });
    ack({ ok: true });
  });

  // 3. Callee declines
  socket.on("reject-call", ({ callId, reason } = {}) => {
    const call = calls.get(callId);
    if (!call || call.calleeId !== me) return;
    io.to(call.callerSocket).emit("call-rejected", { callId, reason: reason || "declined" });
    socket.to(userRoom(me)).emit("call-handled-elsewhere", { callId });
    cleanup(call);
  });

  // 4. ICE candidates
  socket.on("ice-candidate", ({ callId, candidate } = {}) => {
    const call = calls.get(callId);
    if (!call || !candidate) return;
    const target = otherTarget(call);
    if (target) io.to(target).emit("ice-candidate", { callId, candidate });
  });

  // 5. Generic renegotiation / ICE-restart relay
  socket.on("call-signal", ({ callId, data } = {}) => {
    const call = calls.get(callId);
    if (!call) return;
    const target = otherTarget(call);
    if (target) io.to(target).emit("call-signal", { callId, data });
  });

  // 6. Mic / camera state
  socket.on("toggle-media", ({ callId, isMuted, isVideoOff } = {}) => {
    const call = calls.get(callId);
    if (!call) return;
    const target = otherTarget(call);
    if (target) io.to(target).emit("peer-media-toggled", { callId, isMuted, isVideoOff });
  });

  // 7. Hang up / cancel
  socket.on("end-call", ({ callId } = {}) => {
    const call = calls.get(callId);
    if (!call) return;
    const target = otherTarget(call) || (call.callerId === me ? userRoom(call.calleeId) : call.callerSocket);
    io.to(target).emit("call-ended", { callId, reason: call.state === "ringing" ? "cancelled" : "ended" });
    cleanup(call);
  });

  // 8. Connection dropped
  socket.on("disconnect", () => {
    // This runs before presence is updated, so check the user's room (already left by this socket).
    const meOnline = !!io.sockets.adapter.rooms.get(userRoom(me))?.size;
    for (const call of Array.from(calls.values())) {
      const isCaller = call.callerSocket === socket.id;
      const isCallee = call.calleeSocket === socket.id;
      const calleeGone = call.state === "ringing" && call.calleeId === me && !meOnline;
      if (isCaller || isCallee || calleeGone) {
        const target = isCaller ? call.calleeSocket || userRoom(call.calleeId) : call.callerSocket;
        io.to(target).emit("call-ended", { callId: call.id, reason: "disconnected" });
        cleanup(call);
      }
    }
  });
};

module.exports = callLogic;
