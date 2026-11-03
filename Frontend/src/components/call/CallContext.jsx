import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useChat } from "../../state/ChatContext";
import { API } from "../../lib/api";
import { emitAck } from "../../lib/socket";
import { callSounds } from "../../lib/callSounds";
import { notify } from "../../lib/notify";
import { idOf } from "../../lib/format";
import CallScreen from "./CallScreen";

const CallContext = createContext({ startCall: () => {} });
export const useCall = () => useContext(CallContext);

const FALLBACK_ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
let iceCache = null;
const getIceServers = async () => {
  if (iceCache) return iceCache;
  try {
    const r = await API.get("/config/ice", { timeout: 8000 });
    iceCache = r.data?.iceServers?.length ? r.data.iceServers : FALLBACK_ICE;
  } catch {
    iceCache = FALLBACK_ICE;
  }
  return iceCache;
};

const REASONS = {
  offline: (n) => `${n} is offline right now. Try again later or send a message.`,
  busy: (n) => `${n} is on another call.`,
  declined: (n) => `${n} declined the call.`,
  "no-answer": (n) => `${n} didn't answer.`,
  cancelled: () => "Call cancelled.",
  disconnected: () => "Call ended – connection lost.",
};

const getMedia = async (wantVideo, facingMode = "user") => {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Calls need a secure (https) connection and a browser that supports WebRTC.");
  if (wantVideo) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio, video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch (e) {
      // camera unavailable – continue as voice call
      console.warn("camera failed, falling back to audio", e);
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio, video: false });
};

export function CallProvider({ children }) {
  const { socket } = useChat();
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [media, setMedia] = useState({ muted: false, videoOn: false, sharing: false, facing: "user", speakerOff: false });
  const [peer, setPeer] = useState({ muted: false, videoOff: false, videoTrackLive: false });
  const [startedAt, setStartedAt] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  const callRef = useRef(null);
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const screenRef = useRef(null);
  const remoteCandidates = useRef([]);
  const outgoingCandidates = useRef([]);
  const disconnectTimer = useRef(null);
  const vibrateTimer = useRef(null);
  const toggleScreenShareRef = useRef(() => {});

  const update = useCallback((patch) => {
    setCall((c) => {
      const next = c ? { ...c, ...patch } : c;
      callRef.current = next;
      return next;
    });
  }, []);

  const cleanup = useCallback((message) => {
    callSounds.stopAllSounds();
    clearInterval(vibrateTimer.current);
    navigator.vibrate?.(0);
    clearTimeout(disconnectTimer.current);
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    screenRef.current = null;
    remoteCandidates.current = [];
    outgoingCandidates.current = [];
    const hadCall = !!callRef.current;
    callRef.current = null;
    setCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setStartedAt(null);
    setMedia({ muted: false, videoOn: false, sharing: false, facing: "user", speakerOff: false });
    setPeer({ muted: false, videoOff: false, videoTrackLive: false });
    if (hadCall && message) toast(message);
  }, []);

  const createPeer = useCallback(
    async (stream) => {
      const pc = new RTCPeerConnection({ iceServers: await getIceServers(), iceCandidatePoolSize: 4 });
      pcRef.current = pc;
      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const id = callRef.current?.id;
        if (id) socket?.emit("ice-candidate", { callId: id, candidate: e.candidate });
        else outgoingCandidates.current.push(e.candidate);
      };

      pc.ontrack = (e) => {
        const track = e.track;
        if (!remote.getTracks().includes(track)) remote.addTrack(track);
        if (track.kind === "video") {
          const sync = () => setPeer((p) => ({ ...p, videoTrackLive: !track.muted && track.readyState === "live" }));
          track.onmute = sync;
          track.onunmute = sync;
          track.onended = sync;
          sync();
        }
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "connected") {
          clearTimeout(disconnectTimer.current);
          callSounds.stopAllSounds();
          if (callRef.current?.status !== "connected") {
            callSounds.playConnectedSound();
            setStartedAt((s) => s || Date.now());
          }
          update({ status: "connected" });
        } else if (st === "disconnected") {
          update({ status: "reconnecting" });
          clearTimeout(disconnectTimer.current);
          disconnectTimer.current = setTimeout(() => {
            if (pcRef.current === pc && pc.connectionState !== "connected") {
              socket?.emit("end-call", { callId: callRef.current?.id });
              callSounds.playEndedSound();
              cleanup("Call ended – connection lost.");
            }
          }, 12000);
        } else if (st === "failed") {
          socket?.emit("end-call", { callId: callRef.current?.id });
          callSounds.playEndedSound();
          cleanup("Couldn't connect the call. The network may be blocking it.");
        }
      };

      // Always negotiate both an audio and a video line so the camera can be turned on later
      // without renegotiation (voice call -> video call).
      stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));
      const v = stream.getVideoTracks()[0];
      return { pc, videoTrack: v };
    },
    [socket, update, cleanup]
  );

  const drainRemoteCandidates = async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const list = remoteCandidates.current.splice(0);
    for (const c of list) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn("ICE add failed", e);
      }
    }
  };

  // ------------------------------------------------------------------ outgoing
  const startCall = useCallback(
    async (user, type = "video") => {
      if (!user) return;
      if (callRef.current) return toast.info("You're already in a call.");
      if (!socket?.connected) return toast.error("You're offline. Reconnecting…");
      const peerUser = { _id: idOf(user), name: user.name, email: user.email, profilePic: user.profilePic };
      const initial = { id: null, direction: "out", peer: peerUser, type, status: "calling" };
      callRef.current = initial;
      setCall(initial);

      let stream;
      try {
        stream = await getMedia(type === "video", "user");
      } catch (e) {
        cleanup();
        return toast.error(e?.name === "NotAllowedError" ? "Please allow microphone/camera access to make calls." : e.message || "Could not access microphone.");
      }
      if (!callRef.current) return stream.getTracks().forEach((t) => t.stop()); // cancelled meanwhile
      localRef.current = stream;
      setLocalStream(stream);
      const hasVideo = stream.getVideoTracks().length > 0;
      setMedia((m) => ({ ...m, videoOn: hasVideo }));

      const { pc, videoTrack } = await createPeer(stream);
      if (videoTrack) pc.addTrack(videoTrack, stream);
      else pc.addTransceiver("video", { direction: "sendrecv" });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      callSounds.playOutgoingRing();

      const res = await emitAck("call-user", { to: peerUser._id, offer: pc.localDescription, callType: hasVideo ? "video" : "audio" });
      if (!callRef.current) return;
      if (!res.ok) {
        callSounds.playBusySound();
        const fn = REASONS[res.reason];
        return cleanup(fn ? fn(peerUser.name) : res.error || "Call could not be started.");
      }
      update({ id: res.callId, status: "ringing" });
      callRef.current = { ...callRef.current, id: res.callId };
      outgoingCandidates.current.splice(0).forEach((c) => socket.emit("ice-candidate", { callId: res.callId, candidate: c }));
      if (!hasVideo && type === "video") socket.emit("toggle-media", { callId: res.callId, isVideoOff: true });
    },
    [socket, createPeer, cleanup, update]
  );

  // ------------------------------------------------------------------ incoming
  const acceptCall = useCallback(
    async (asAudio = false) => {
      const c = callRef.current;
      if (!c || c.status !== "incoming") return;
      callSounds.stopAllSounds();
      clearInterval(vibrateTimer.current);
      navigator.vibrate?.(0);
      update({ status: "connecting" });
      let stream;
      try {
        stream = await getMedia(c.type === "video" && !asAudio, "user");
      } catch (e) {
        socket?.emit("reject-call", { callId: c.id, reason: "declined" });
        return cleanup(e?.name === "NotAllowedError" ? "Microphone access is needed to answer calls." : "Could not access microphone.");
      }
      if (!callRef.current) return stream.getTracks().forEach((t) => t.stop());
      localRef.current = stream;
      setLocalStream(stream);
      const hasVideo = stream.getVideoTracks().length > 0;
      setMedia((m) => ({ ...m, videoOn: hasVideo }));

      try {
        const { pc, videoTrack } = await createPeer(stream);
        await pc.setRemoteDescription(new RTCSessionDescription(c.offer));
        const vt = pc.getTransceivers().find((t) => t.receiver.track?.kind === "video");
        if (vt) {
          vt.direction = "sendrecv";
          if (videoTrack) await vt.sender.replaceTrack(videoTrack);
        } else if (videoTrack) pc.addTrack(videoTrack, stream);
        pc.getTransceivers().forEach((t) => {
          if (t.receiver.track?.kind === "audio") t.direction = "sendrecv";
        });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const res = await emitAck("answer-call", { callId: c.id, answer: pc.localDescription });
        if (!res.ok) return cleanup("This call is no longer available.");
        outgoingCandidates.current.splice(0).forEach((cand) => socket.emit("ice-candidate", { callId: c.id, candidate: cand }));
        await drainRemoteCandidates();
        if (!hasVideo) socket.emit("toggle-media", { callId: c.id, isVideoOff: true });
      } catch (e) {
        console.error("accept failed", e);
        socket?.emit("end-call", { callId: c.id });
        cleanup("Could not connect the call.");
      }
    },
    [socket, createPeer, cleanup, update]
  );

  const declineCall = useCallback(() => {
    const c = callRef.current;
    if (c?.id) socket?.emit("reject-call", { callId: c.id, reason: "declined" });
    cleanup();
  }, [socket, cleanup]);

  const hangUp = useCallback(() => {
    const c = callRef.current;
    if (c?.id) socket?.emit("end-call", { callId: c.id });
    callSounds.playEndedSound();
    cleanup();
  }, [socket, cleanup]);

  // ------------------------------------------------------------------ socket events
  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ callId, from, offer, callType }) => {
      if (callRef.current) {
        socket.emit("reject-call", { callId, reason: "busy" });
        return;
      }
      const c = { id: callId, direction: "in", peer: from, type: callType, offer, status: "incoming" };
      callRef.current = c;
      remoteCandidates.current = [];
      setCall(c);
      callSounds.playIncomingRing();
      if (navigator.vibrate) {
        navigator.vibrate([400, 300, 400]);
        vibrateTimer.current = setInterval(() => navigator.vibrate([400, 300, 400]), 2400);
      }
      notify(`Incoming ${callType === "video" ? "video" : "voice"} call`, from?.name || "Someone is calling you");
    };
    const forThis = (id) => callRef.current && callRef.current.id === id;
    const onAnswered = async ({ callId, answer }) => {
      if (!forThis(callId) || !pcRef.current) return;
      callSounds.stopAllSounds();
      update({ status: "connecting" });
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await drainRemoteCandidates();
      } catch (e) {
        console.error("setRemoteDescription(answer) failed", e);
      }
    };
    const onIce = async ({ callId, candidate }) => {
      if (!forThis(callId)) return;
      const pc = pcRef.current;
      if (pc?.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("ICE add failed", e);
        }
      } else remoteCandidates.current.push(candidate);
    };
    const onRejected = ({ callId, reason }) => {
      if (!forThis(callId)) return;
      callSounds.playBusySound();
      const fn = REASONS[reason] || REASONS.declined;
      cleanup(fn(callRef.current?.peer?.name || "They"));
    };
    const onEnded = ({ callId, reason }) => {
      if (!forThis(callId)) return;
      const c = callRef.current;
      callSounds.playEndedSound();
      if (c.status === "incoming") cleanup(reason === "cancelled" || reason === "no-answer" ? `Missed call from ${c.peer?.name}` : undefined);
      else cleanup(reason === "no-answer" ? REASONS["no-answer"](c.peer?.name) : reason === "disconnected" ? REASONS.disconnected() : "Call ended.");
    };
    const onElsewhere = ({ callId }) => {
      if (forThis(callId) && callRef.current.status === "incoming") cleanup();
    };
    const onPeerMedia = ({ callId, isMuted, isVideoOff }) => {
      if (!forThis(callId)) return;
      setPeer((p) => ({ ...p, ...(isMuted !== undefined ? { muted: isMuted } : {}), ...(isVideoOff !== undefined ? { videoOff: isVideoOff } : {}) }));
    };

    socket.on("incoming-call", onIncoming);
    socket.on("call-answered", onAnswered);
    socket.on("ice-candidate", onIce);
    socket.on("call-rejected", onRejected);
    socket.on("call-ended", onEnded);
    socket.on("call-handled-elsewhere", onElsewhere);
    socket.on("peer-media-toggled", onPeerMedia);
    return () => {
      socket.off("incoming-call", onIncoming);
      socket.off("call-answered", onAnswered);
      socket.off("ice-candidate", onIce);
      socket.off("call-rejected", onRejected);
      socket.off("call-ended", onEnded);
      socket.off("call-handled-elsewhere", onElsewhere);
      socket.off("peer-media-toggled", onPeerMedia);
    };
  }, [socket, cleanup, update]);

  // Hang up if the page is closed mid-call
  useEffect(() => {
    const onUnload = () => {
      const c = callRef.current;
      if (c?.id) socket?.emit(c.status === "incoming" ? "reject-call" : "end-call", { callId: c.id });
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [socket]);

  // ------------------------------------------------------------------ controls
  const videoSender = () => pcRef.current?.getTransceivers().find((t) => t.receiver.track?.kind === "video")?.sender;

  const toggleMute = () => {
    const t = localRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMedia((m) => ({ ...m, muted: !t.enabled }));
    socket?.emit("toggle-media", { callId: callRef.current?.id, isMuted: !t.enabled });
  };

  const toggleVideo = async () => {
    const stream = localRef.current;
    if (!stream) return;
    let track = stream.getVideoTracks()[0];
    if (media.videoOn && track) {
      // turn camera fully off (releases the camera light)
      track.stop();
      stream.removeTrack(track);
      await videoSender()?.replaceTrack(null);
      setLocalStream(new MediaStream(stream.getTracks()));
      setMedia((m) => ({ ...m, videoOn: false }));
      socket?.emit("toggle-media", { callId: callRef.current?.id, isVideoOff: true });
      return;
    }
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: media.facing, width: { ideal: 1280 }, height: { ideal: 720 } } });
      track = cam.getVideoTracks()[0];
      stream.addTrack(track);
      const sender = videoSender();
      if (sender) {
        await sender.replaceTrack(track);
        const tr = pcRef.current.getTransceivers().find((t) => t.sender === sender);
        if (tr && tr.direction !== "sendrecv") tr.direction = "sendrecv";
      }
      setLocalStream(new MediaStream(stream.getTracks()));
      setMedia((m) => ({ ...m, videoOn: true, sharing: false }));
      socket?.emit("toggle-media", { callId: callRef.current?.id, isVideoOff: false });
    } catch {
      toast.error("Could not turn on the camera.");
    }
  };

  const flipCamera = async () => {
    const stream = localRef.current;
    if (!stream || !media.videoOn) return;
    const facing = media.facing === "user" ? "environment" : "user";
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } } }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } }));
      const nt = cam.getVideoTracks()[0];
      const old = stream.getVideoTracks()[0];
      old?.stop();
      if (old) stream.removeTrack(old);
      stream.addTrack(nt);
      await videoSender()?.replaceTrack(nt);
      setLocalStream(new MediaStream(stream.getTracks()));
      setMedia((m) => ({ ...m, facing }));
    } catch {
      toast.error("Couldn't switch camera.");
    }
  };

  const toggleScreenShare = async () => {
    if (media.sharing) {
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
      setScreenStream(null);
      const cam = localRef.current?.getVideoTracks()[0] || null;
      await videoSender()?.replaceTrack(cam);
      setMedia((m) => ({ ...m, sharing: false }));
      socket?.emit("toggle-media", { callId: callRef.current?.id, isVideoOff: !cam });
      return;
    }
    try {
      const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenRef.current = scr;
      setScreenStream(scr);
      const st = scr.getVideoTracks()[0];
      const sender = videoSender();
      await sender?.replaceTrack(st);
      const tr = pcRef.current?.getTransceivers().find((t) => t.sender === sender);
      if (tr && tr.direction !== "sendrecv") tr.direction = "sendrecv";
      st.onended = () => {
        if (screenRef.current === scr) toggleScreenShareRef.current();
      };
      setMedia((m) => ({ ...m, sharing: true }));
      socket?.emit("toggle-media", { callId: callRef.current?.id, isVideoOff: false });
    } catch {
      /* user cancelled */
    }
  };
  useEffect(() => {
    toggleScreenShareRef.current = toggleScreenShare;
  });

  const toggleSpeaker = () => setMedia((m) => ({ ...m, speakerOff: !m.speakerOff }));

  return (
    <CallContext.Provider value={{ startCall, inCall: !!call }}>
      {children}
      {call && (
        <CallScreen
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          screenStream={media.sharing ? screenStream : null}
          media={media}
          peer={peer}
          startedAt={startedAt}
          onAccept={acceptCall}
          onDecline={declineCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onFlip={flipCamera}
          onToggleScreen={toggleScreenShare}
          onToggleSpeaker={toggleSpeaker}
        />
      )}
    </CallContext.Provider>
  );
}
