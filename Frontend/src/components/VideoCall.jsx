import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box,
  IconButton,
  Paper,
  Typography,
  Avatar,
  Chip,
  Tooltip,
} from "@mui/material";
import {
  CallEnd as CallEndIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  Cameraswitch as CameraswitchIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Lock as LockIcon,
  Phone as PhoneIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
} from "@mui/icons-material";
import { socket } from "../socket";
import { callSounds } from "../utils/callSounds";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

export default function VideoCall({
  currentUser,
  selectedUser,
  incomingCallData,
  callType: initialCallType = "video",
  onEndCall,
}) {
  const [callType, setCallType] = useState(initialCallType);
  const [callState, setCallState] = useState(incomingCallData ? "connecting" : "calling");
  const [callDuration, setCallDuration] = useState(0);

  // Media States
  const [isMuted, setIsMuted] = useState(false);
  const [isVidOff, setIsVidOff] = useState(initialCallType === "audio");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [peerVideoOff, setPeerVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState("user");

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const containerRef = useRef(null);
  const peerConnection = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pendingIceCandidates = useRef([]);
  const timerIntervalRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const isCleaningUp = useRef(false);

  const isIncoming = Boolean(incomingCallData && incomingCallData.offer);
  const partnerUser = incomingCallData
    ? {
        _id: incomingCallData.from || incomingCallData._id,
        name: incomingCallData.name,
        email: incomingCallData.email,
        profilePic: incomingCallData.profilePic,
        socketId: incomingCallData.fromSocketId,
      }
    : selectedUser;

  const partnerId = partnerUser?._id;
  const partnerSocketId = partnerUser?.socketId;

  // Format Duration (MM:SS or HH:MM:SS)
  const formatTime = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Safe End Call & Cleanup
  const closeConnection = useCallback((notify = true) => {
    if (isCleaningUp.current) return;
    isCleaningUp.current = true;

    callSounds.stopAllSounds();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

    if (notify && partnerId) {
      socket.emit("end-call", {
        to: partnerId,
        toSocketId: partnerSocketId,
      });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    onEndCall();
  }, [partnerId, partnerSocketId, onEndCall]);

  // Handle Initial Media Stream and WebRTC Setup
  useEffect(() => {
    let isMounted = true;

    const setupConnection = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("Audio/Video calling requires camera and microphone permissions.");
          closeConnection(false);
          return;
        }

        const wantsVideo = callType === "video";
        const stream = await navigator.mediaDevices.getUserMedia({
          video: wantsVideo ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && wantsVideo) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnection.current = pc;

        // Add all local tracks to peer connection
        stream.getTracks().forEach((track) => {
          track.enabled = true;
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          console.log("🔊 WebRTC Remote track received:", event.track.kind, event.streams);
          const incomingStream = event.streams[0] || new MediaStream([event.track]);

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = incomingStream;
            remoteVideoRef.current.play().catch((e) => console.log("remoteVideo.play() note:", e));
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = incomingStream;
            remoteAudioRef.current.play().catch((e) => console.log("remoteAudio.play() note:", e));
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && partnerId) {
            socket.emit("ice-candidate", {
              to: partnerId,
              candidate: event.candidate,
              toSocketId: partnerSocketId,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setCallState("connected");
            callSounds.stopAllSounds();
            callSounds.playConnectedSound();

            if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

            if (!timerIntervalRef.current) {
              timerIntervalRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
              }, 1000);
            }
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            callSounds.playEndedSound();
            closeConnection(false);
          }
        };

        if (isIncoming) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));

          while (pendingIceCandidates.current.length > 0) {
            const candidate = pendingIceCandidates.current.shift();
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("answer-call", {
            to: partnerId,
            answer,
            toSocketId: partnerSocketId,
          });
        } else {
          callSounds.playOutgoingRing();

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit("call-user", {
            to: partnerId,
            toEmail: partnerUser?.email,
            from: currentUser?._id,
            caller: {
              _id: currentUser?._id,
              name: currentUser?.name,
              email: currentUser?.email,
              profilePic: currentUser?.profilePic,
              subscriptionId: currentUser?.subscriptionId,
            },
            offer,
            callType,
            toSocketId: partnerSocketId,
          });

          timeoutTimerRef.current = setTimeout(() => {
            alert("No answer from recipient.");
            callSounds.playEndedSound();
            closeConnection(true);
          }, 45000);
        }
      } catch (err) {
        console.error("WebRTC Setup Error:", err);
        alert(`Could not access camera/mic: ${err.message}`);
        closeConnection(false);
      }
    };

    setupConnection();

    const handleCallRinging = () => {
      setCallState("ringing");
    };

    const handleCallAnswered = async ({ answer }) => {
      if (peerConnection.current && answer) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));

          while (pendingIceCandidates.current.length > 0) {
            const candidate = pendingIceCandidates.current.shift();
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (e) {
          console.error("Error setting remote description:", e);
        }
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding received ICE candidate:", e);
        }
      } else {
        pendingIceCandidates.current.push(candidate);
      }
    };

    const handleCallEnded = () => {
      callSounds.playEndedSound();
      closeConnection(false);
    };

    const handleCallRejected = ({ reason }) => {
      callSounds.playBusySound();
      alert(`Call declined by ${partnerUser?.name || "recipient"}`);
      closeConnection(false);
    };

    const handleCallFailed = ({ message }) => {
      callSounds.playBusySound();
      alert(message || "Call could not be completed.");
      closeConnection(false);
    };

    const handlePeerMediaToggled = ({ isVideoOff: peerVidOff }) => {
      if (peerVidOff !== undefined) setPeerVideoOff(peerVidOff);
    };

    const handleCallTypeSwitched = ({ newType }) => {
      setCallType(newType);
      if (newType === "video") setIsVidOff(false);
      else setIsVidOff(true);
    };

    socket.on("call-ringing", handleCallRinging);
    socket.on("call-answered", handleCallAnswered);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);
    socket.on("call-rejected", handleCallRejected);
    socket.on("call-failed", handleCallFailed);
    socket.on("peer-media-toggled", handlePeerMediaToggled);
    socket.on("call-type-switched", handleCallTypeSwitched);

    return () => {
      isMounted = false;
      socket.off("call-ringing", handleCallRinging);
      socket.off("call-answered", handleCallAnswered);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEnded);
      socket.off("call-rejected", handleCallRejected);
      socket.off("call-failed", handleCallFailed);
      socket.off("peer-media-toggled", handlePeerMediaToggled);
      socket.off("call-type-switched", handleCallTypeSwitched);

      callSounds.stopAllSounds();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [currentUser, incomingCallData, isIncoming, partnerId, partnerSocketId, partnerUser?.email, partnerUser?.name, initialCallType, closeConnection]);

  // Toggle Microphone Mute
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);

        socket.emit("toggle-media", {
          to: partnerId,
          toSocketId: partnerSocketId,
          isMuted: newMuted,
        });
      }
    }
  };

  // Toggle Camera On / Off
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    let videoTrack = localStreamRef.current.getVideoTracks()[0];

    if (!videoTrack && isVidOff) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newTrack);

        if (peerConnection.current) {
          const sender = peerConnection.current.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(newTrack);
          } else {
            peerConnection.current.addTrack(newTrack, localStreamRef.current);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsVidOff(false);
        setCallType("video");

        socket.emit("toggle-media", {
          to: partnerId,
          toSocketId: partnerSocketId,
          isVideoOff: false,
        });
        return;
      } catch (e) {
        console.error("Failed to enable video track:", e);
        return;
      }
    }

    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const newVidOff = !videoTrack.enabled;
      setIsVidOff(newVidOff);

      socket.emit("toggle-media", {
        to: partnerId,
        toSocketId: partnerSocketId,
        isVideoOff: newVidOff,
      });
    }
  };

  // Flip Camera (Front / Back)
  const flipCamera = async () => {
    if (!localStreamRef.current) return;
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];

      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
      }

      localStreamRef.current.addTrack(newTrack);

      if (peerConnection.current) {
        const sender = peerConnection.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(newTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } catch (e) {
      console.warn("Could not switch camera facing mode:", e);
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        if (peerConnection.current) {
          const sender = peerConnection.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);

        screenTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Screen share error:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      if (peerConnection.current && cameraTrack) {
        const sender = peerConnection.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }

    setIsScreenSharing(false);
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Toggle Remote Audio Speaker
  const toggleSpeaker = () => {
    const newSpeakerMuted = !isSpeakerMuted;
    setIsSpeakerMuted(newSpeakerMuted);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = newSpeakerMuted;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = newSpeakerMuted;
    }
  };

  const isAudioCall = callType === "audio";

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        // Kalapila theme: signature blue radial gradient
        background: isAudioCall || isVidOff
          ? "radial-gradient(circle at center, #1e88e5 0%, #1565c0 45%, #0d47a1 100%)"
          : "#0a192f",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* 🔊 Dedicated Persistent Audio Element for Voice and Video Calls */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      />

      {/* 1. TOP HEADER OVERLAY */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          p: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
          background: "linear-gradient(to bottom, rgba(10,25,47,0.85) 0%, transparent 100%)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            src={partnerUser?.profilePic || ""}
            sx={{ width: 44, height: 44, bgcolor: "#1976d2", border: "2px solid #90caf9" }}
          >
            {partnerUser?.name?.[0]?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="700" color="#ffffff" sx={{ lineHeight: 1.2 }}>
              {partnerUser?.name || "Kalapila User"}
            </Typography>
            <Typography variant="caption" sx={{ color: "#bbdefb", opacity: 0.9 }}>
              {partnerUser?.email || "Connected"}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Chip
            icon={<LockIcon sx={{ fontSize: 14, color: "#90caf9 !important" }} />}
            label={callState === "connected" ? formatTime(callDuration) : callState === "ringing" ? "Ringing..." : "Calling..."}
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.18)",
              backdropFilter: "blur(12px)",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "0.85rem",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              px: 1,
            }}
          />
          <IconButton size="small" onClick={toggleFullscreen} sx={{ color: "#fff", bgcolor: "rgba(255,255,255,0.15)" }}>
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {/* 2. MAIN MEDIA AREA */}
      <Box
        sx={{
          flex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Remote Video Stream (Single Persistent Video Tag) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            display: isAudioCall || peerVideoOff ? "none" : "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Voice Call / Camera Off View (Avatar with concentric rings) */}
        {(isAudioCall || peerVideoOff || callState !== "connected") && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              zIndex: 5,
            }}
          >
            <Box
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 3,
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: 190,
                  height: 190,
                  borderRadius: "50%",
                  bgcolor: "rgba(255, 255, 255, 0.15)",
                  animation: "pulseRing 2s infinite ease-out",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  width: 155,
                  height: 155,
                  borderRadius: "50%",
                  bgcolor: "rgba(255, 255, 255, 0.25)",
                  animation: "pulseRing 2s infinite ease-out 0.5s",
                }}
              />
              <Avatar
                src={partnerUser?.profilePic || ""}
                sx={{
                  width: 125,
                  height: 125,
                  bgcolor: "#1976d2",
                  fontSize: "3.2rem",
                  fontWeight: "bold",
                  color: "#ffffff",
                  border: "4px solid #ffffff",
                  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
                  zIndex: 2,
                }}
              >
                {partnerUser?.name?.[0]?.toUpperCase()}
              </Avatar>
            </Box>

            <Typography variant="h5" fontWeight="800" color="#ffffff" sx={{ mb: 0.5 }}>
              {partnerUser?.name}
            </Typography>
            <Typography variant="body2" sx={{ color: "#bbdefb", mb: 2 }}>
              {partnerUser?.email}
            </Typography>

            <Chip
              label={
                callState === "connected"
                  ? isAudioCall ? "Voice Call in Progress" : "Video Call (Camera Off)"
                  : callState === "ringing" ? "Ringing..." : "Calling..."
              }
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontWeight: "600",
                fontSize: "0.82rem",
                backdropFilter: "blur(10px)",
                px: 1.5,
              }}
            />
          </Box>
        )}

        {/* LOCAL VIDEO PIP */}
        {!isVidOff && (
          <Paper
            elevation={8}
            sx={{
              position: "absolute",
              bottom: { xs: 110, sm: 120 },
              right: { xs: 16, sm: 30 },
              width: { xs: 110, sm: 160 },
              height: { xs: 160, sm: 220 },
              borderRadius: "18px",
              overflow: "hidden",
              border: "2.5px solid rgba(255, 255, 255, 0.8)",
              bgcolor: "#000",
              zIndex: 20,
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
              }}
            />
            <IconButton
              size="small"
              onClick={flipCamera}
              sx={{
                position: "absolute",
                top: 6,
                right: 6,
                bgcolor: "rgba(0,0,0,0.6)",
                color: "#fff",
                p: 0.5,
              }}
            >
              <CameraswitchIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Paper>
        )}
      </Box>

      {/* 3. FLOATING CONTROLS BAR */}
      <Paper
        elevation={10}
        sx={{
          mb: { xs: 3, sm: 4 },
          px: { xs: 2.5, sm: 4 },
          py: 1.8,
          borderRadius: "50px",
          bgcolor: "rgba(13, 71, 161, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: { xs: 2, sm: 3 },
          zIndex: 30,
          boxShadow: "0 15px 35px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Toggle Video */}
        <Tooltip title={isVidOff ? "Turn Camera On" : "Turn Camera Off"}>
          <IconButton
            onClick={toggleVideo}
            sx={{
              bgcolor: isVidOff ? "rgba(255, 255, 255, 0.15)" : "rgba(25, 118, 210, 0.5)",
              color: "#ffffff",
              p: 1.5,
              "&:hover": { bgcolor: isVidOff ? "rgba(255, 255, 255, 0.25)" : "rgba(25, 118, 210, 0.7)" },
            }}
          >
            {isVidOff ? <VideocamOffIcon /> : <VideocamIcon />}
          </IconButton>
        </Tooltip>

        {/* Toggle Microphone */}
        <Tooltip title={isMuted ? "Unmute Microphone" : "Mute Microphone"}>
          <IconButton
            onClick={toggleMic}
            sx={{
              bgcolor: isMuted ? "#d32f2f" : "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              p: 1.5,
              "&:hover": { bgcolor: isMuted ? "#b71c1c" : "rgba(255, 255, 255, 0.25)" },
            }}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
          </IconButton>
        </Tooltip>

        {/* Toggle Speaker */}
        <Tooltip title={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}>
          <IconButton
            onClick={toggleSpeaker}
            sx={{
              bgcolor: isSpeakerMuted ? "#f57c00" : "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              p: 1.5,
              display: { xs: "none", sm: "inline-flex" },
              "&:hover": { bgcolor: isSpeakerMuted ? "#e65100" : "rgba(255, 255, 255, 0.25)" },
            }}
          >
            {isSpeakerMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
        </Tooltip>

        {/* Screen Share */}
        <Tooltip title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}>
          <IconButton
            onClick={toggleScreenShare}
            sx={{
              bgcolor: isScreenSharing ? "#0288d1" : "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              p: 1.5,
              display: { xs: "none", sm: "inline-flex" },
              "&:hover": { bgcolor: isScreenSharing ? "#0277bd" : "rgba(255, 255, 255, 0.25)" },
            }}
          >
            {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
          </IconButton>
        </Tooltip>

        {/* Flip Camera */}
        {!isVidOff && (
          <Tooltip title="Switch Camera">
            <IconButton
              onClick={flipCamera}
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                p: 1.5,
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.25)" },
              }}
            >
              <CameraswitchIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* HANG UP */}
        <Tooltip title="End Call">
          <IconButton
            onClick={() => closeConnection(true)}
            sx={{
              bgcolor: "#d32f2f",
              color: "#ffffff",
              p: 1.8,
              boxShadow: "0 6px 20px rgba(211, 47, 47, 0.5)",
              transform: "rotate(135deg)",
              "&:hover": {
                bgcolor: "#b71c1c",
                transform: "rotate(135deg) scale(1.06)",
              },
              transition: "all 0.2s",
            }}
          >
            <PhoneIcon sx={{ fontSize: 26 }} />
          </IconButton>
        </Tooltip>
      </Paper>

      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(0.95); opacity: 0.8; }
          70% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </Box>
  );
}