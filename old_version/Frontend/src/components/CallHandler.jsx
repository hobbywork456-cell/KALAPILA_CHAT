import React, { useEffect, useState } from "react";
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Avatar,
  Chip,
} from "@mui/material";
import {
  Phone as PhoneIcon,
  PhoneDisabled as PhoneDisabledIcon,
  Videocam as VideocamIcon,
} from "@mui/icons-material";
import VideoCall from "./VideoCall";
import { socket } from "../socket";
import { callSounds } from "../utils/callSounds";

export default function CallHandler({
  incomingCall,
  setIncomingCall,
  calling,
  setCalling,
  currentUser,
  selectedUser,
  setSelectedUser,
  users = [],
  callType,
  setCallType,
}) {
  const [activeIncomingCallData, setActiveIncomingCallData] = useState(null);
  const [bufferedCandidates, setBufferedCandidates] = useState([]);

  // Buffer ICE candidates arriving before the user clicks 'Accept'
  useEffect(() => {
    const handleIncomingCandidate = ({ candidate }) => {
      if (candidate && incomingCall) {
        console.log("📥 [CallHandler] Buffered incoming ICE candidate during ringing");
        setBufferedCandidates((prev) => [...prev, candidate]);
      }
    };

    socket.on("ice-candidate", handleIncomingCandidate);
    return () => {
      socket.off("ice-candidate", handleIncomingCandidate);
    };
  }, [incomingCall]);

  // Play incoming ringtone when incomingCall arrives
  useEffect(() => {
    if (incomingCall && !calling) {
      callSounds.playIncomingRing();
    } else if (!incomingCall && !calling) {
      callSounds.stopAllSounds();
    }

    return () => {
      if (!calling) {
        callSounds.stopAllSounds();
      }
    };
  }, [incomingCall, calling]);

  const handleAccept = () => {
    callSounds.stopAllSounds();
    const callerData = incomingCall;

    // Match or create partner user object
    const caller = users.find(
      (u) =>
        (callerData?.from && u._id === callerData.from) ||
        (callerData?._id && u._id === callerData._id) ||
        (callerData?.email && u.email?.toLowerCase() === callerData.email.toLowerCase())
    ) || {
      _id: callerData?.from || callerData?._id,
      name: callerData?.name || "Kalapila User",
      email: callerData?.email || "",
      profilePic: callerData?.profilePic || "",
      socketId: callerData?.fromSocketId,
    };

    setSelectedUser(caller);
    setCallType(callerData?.callType || "video");
    setActiveIncomingCallData({
      ...callerData,
      initialCandidates: [...bufferedCandidates],
    });
    setBufferedCandidates([]);
    setIncomingCall(null);
    setCalling(true);
  };

  const handleDecline = () => {
    callSounds.stopAllSounds();
    setBufferedCandidates([]);
    if (incomingCall) {
      socket.emit("reject-call", {
        to: incomingCall.from || incomingCall._id,
        toEmail: incomingCall.email,
        toSocketId: incomingCall.fromSocketId,
        reason: "declined",
      });
    }
    setIncomingCall(null);
  };

  const handleEndCall = () => {
    setCalling(false);
    setIncomingCall(null);
    setActiveIncomingCallData(null);
    setBufferedCandidates([]);
    setCallType("video");
  };

  const isVideo = (incomingCall?.callType || callType) === "video";

  return (
    <>
      {/* WhatsApp-Style Incoming Call Dialog using Kalapila Theme */}
      <Dialog
        open={Boolean(incomingCall)}
        onClose={handleDecline}
        PaperProps={{
          sx: {
            borderRadius: "28px",
            background: "linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #1e88e5 100%)",
            color: "#ffffff",
            p: 1,
            minWidth: { xs: 280, sm: 340 },
            textAlign: "center",
            boxShadow: "0 25px 50px rgba(21, 101, 192, 0.45)",
            border: "1.5px solid rgba(255, 255, 255, 0.25)",
            overflow: "hidden",
          },
        }}
      >
        <Box sx={{ p: 3, pt: 4, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Pulsing Avatar */}
          <Box sx={{ position: "relative", mb: 2.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Box
              sx={{
                position: "absolute",
                width: 120,
                height: 120,
                borderRadius: "50%",
                bgcolor: "rgba(255, 255, 255, 0.25)",
                animation: "pulseRing 2s infinite ease-out",
              }}
            />
            <Avatar
              src={incomingCall?.profilePic || ""}
              sx={{
                width: 90,
                height: 90,
                bgcolor: "#ffffff",
                color: "#1565c0",
                fontSize: "2.4rem",
                fontWeight: "bold",
                border: "3px solid #ffffff",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
                zIndex: 2,
              }}
            >
              {incomingCall?.name?.[0]?.toUpperCase()}
            </Avatar>
          </Box>

          <Typography variant="h5" fontWeight="800" sx={{ mb: 0.5, color: "#ffffff" }}>
            {incomingCall?.name || "Kalapila User"}
          </Typography>

          {incomingCall?.email && (
            <Typography variant="body2" sx={{ color: "#e3f2fd", opacity: 0.9, mb: 1.5, fontSize: "0.85rem" }}>
              {incomingCall.email}
            </Typography>
          )}

          <Chip
            icon={isVideo ? <VideocamIcon sx={{ color: "#fff !important" }} /> : <PhoneIcon sx={{ color: "#fff !important" }} />}
            label={`Incoming ${isVideo ? "Video" : "Voice"} Call...`}
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(10px)",
              color: "#ffffff",
              fontWeight: "600",
              fontSize: "0.8rem",
              mb: 4,
            }}
          />

          {/* Action Buttons: Green Accept & Red Decline */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 5, width: "100%", mt: 1 }}>
            {/* Decline Button */}
            <Box sx={{ textAlign: "center" }}>
              <IconButton
                onClick={handleDecline}
                sx={{
                  bgcolor: "#d32f2f",
                  color: "#ffffff",
                  p: 2,
                  boxShadow: "0 6px 18px rgba(211, 47, 47, 0.4)",
                  "&:hover": { bgcolor: "#b71c1c", transform: "scale(1.08)" },
                  transition: "all 0.2s",
                }}
              >
                <PhoneDisabledIcon sx={{ fontSize: 28 }} />
              </IconButton>
              <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#ffcdd2", fontWeight: 600 }}>
                Decline
              </Typography>
            </Box>

            {/* Accept Button */}
            <Box sx={{ textAlign: "center" }}>
              <IconButton
                onClick={handleAccept}
                sx={{
                  bgcolor: "#2e7d32",
                  color: "#ffffff",
                  p: 2,
                  boxShadow: "0 6px 18px rgba(46, 125, 50, 0.4)",
                  animation: "bounceAccept 1.5s infinite",
                  "&:hover": { bgcolor: "#1b5e20", transform: "scale(1.08)" },
                  transition: "all 0.2s",
                }}
              >
                <PhoneIcon sx={{ fontSize: 28 }} />
              </IconButton>
              <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#c8e6c9", fontWeight: 600 }}>
                Accept
              </Typography>
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Active Call Overlay */}
      {calling && (
        <VideoCall
          currentUser={currentUser}
          selectedUser={selectedUser}
          incomingCallData={activeIncomingCallData}
          callType={activeIncomingCallData?.callType || callType}
          onEndCall={handleEndCall}
        />
      )}

      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(0.95); opacity: 0.8; }
          70% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes bounceAccept {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}