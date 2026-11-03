import { useEffect, useRef, useState } from "react";
import { Box, Typography, IconButton, Tooltip, useMediaQuery } from "@mui/material";
import {
  Call as CallIcon, CallEnd as EndIcon, Mic as MicIcon, MicOff as MicOffIcon, Videocam as CamIcon, VideocamOff as CamOffIcon,
  Cameraswitch as FlipIcon, ScreenShare as ShareIcon, StopScreenShare as StopShareIcon, VolumeUp as SpeakerIcon, VolumeOff as SpeakerOffIcon,
  Lock as LockIcon,
} from "@mui/icons-material";
import { UserAvatar } from "../Avatars";
import { duration } from "../../lib/format";

function Video({ stream, muted = true, mirror = false, sx }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
    ref.current?.play?.().catch(() => {});
  }, [stream]);
  return <Box component="video" ref={ref} autoPlay playsInline muted={muted} sx={{ objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none", bgcolor: "#000", ...sx }} />;
}

function RemoteAudio({ stream, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    el.play?.().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline muted={muted} style={{ display: "none" }} />;
}

function Ctrl({ title, onClick, active, danger, children, big, hide }) {
  if (hide) return null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
      <Tooltip title={title}>
        <IconButton
          onClick={onClick}
          aria-label={title}
          sx={{
            width: big ? 68 : 56,
            height: big ? 68 : 56,
            borderRadius: "50%",
            color: active ? "#0f172a" : "#fff",
            bgcolor: danger ? "#ef4444" : active ? "#fff" : "rgba(255,255,255,0.16)",
            backdropFilter: "blur(10px)",
            "&:hover": { bgcolor: danger ? "#dc2626" : active ? "#e2e8f0" : "rgba(255,255,255,0.26)" },
            "& svg": { fontSize: big ? 32 : 26 },
          }}
        >
          {children}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default function CallScreen({ call, localStream, remoteStream, screenStream, media, peer, startedAt, onAccept, onDecline, onHangUp, onToggleMute, onToggleVideo, onFlip, onToggleScreen, onToggleSpeaker }) {
  const [now, setNow] = useState(() => Date.now());
  const isMobile = useMediaQuery("(pointer: coarse)");
  const canShare = !isMobile && !!navigator.mediaDevices?.getDisplayMedia;

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const { peer: user, status, type } = call;
  const incoming = status === "incoming";
  const remoteVideoOn = peer.videoTrackLive && !peer.videoOff && status !== "incoming";
  const localPreview = media.sharing ? screenStream : media.videoOn ? localStream : null;

  const statusText = {
    calling: "Calling…",
    ringing: "Ringing…",
    incoming: `Incoming ${type === "video" ? "video" : "voice"} call`,
    connecting: "Connecting…",
    reconnecting: "Reconnecting…",
    connected: startedAt ? duration((now - startedAt) / 1000) : "Connected",
  }[status] || "";

  return (
    <Box
      role="dialog"
      aria-label="Call"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        color: "#fff",
        overflow: "hidden",
        background: "radial-gradient(120% 90% at 50% 0%, #1e40af 0%, #0f1d4a 55%, #070b1a 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <RemoteAudio stream={remoteStream} muted={media.speakerOff} />

      {/* Remote video full-bleed */}
      {remoteVideoOn && <Video stream={remoteStream} muted sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: { xs: "cover", md: "contain" } }} />}
      {remoteVideoOn && <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 70%, rgba(0,0,0,0.65) 100%)" }} />}

      {/* Top info */}
      <Box sx={{ position: "relative", zIndex: 2, pt: "calc(20px + env(safe-area-inset-top))", px: 3, textAlign: remoteVideoOn ? "left" : "center", display: "flex", flexDirection: remoteVideoOn ? "row" : "column", alignItems: "center", gap: remoteVideoOn ? 1.5 : 0 }}>
        {remoteVideoOn && <UserAvatar user={user} size={40} />}
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: remoteVideoOn ? 17 : 15, opacity: remoteVideoOn ? 1 : 0.8, display: "flex", alignItems: "center", gap: 0.75, justifyContent: remoteVideoOn ? "flex-start" : "center" }}>
            {!remoteVideoOn && <LockIcon sx={{ fontSize: 14 }} />}
            {remoteVideoOn ? user?.name : "End-to-end encrypted"}
          </Typography>
          {remoteVideoOn && <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{statusText}</Typography>}
        </Box>
      </Box>

      {/* Center avatar when no remote video */}
      {!remoteVideoOn && (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, px: 3, textAlign: "center" }}>
          <Box sx={{ position: "relative", mb: 3, display: "grid", placeItems: "center" }}>
            {(incoming || status === "ringing" || status === "calling") && (
              <>
                <Box sx={pulse(0)} />
                <Box sx={pulse(0.8)} />
              </>
            )}
            <UserAvatar user={user} size={132} sx={{ border: "4px solid rgba(255,255,255,0.9)", boxShadow: "0 18px 40px rgba(0,0,0,0.35)" }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 28, letterSpacing: -0.5 }}>{user?.name || "Kalapila user"}</Typography>
          <Typography sx={{ mt: 0.75, fontSize: 16, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>{statusText}</Typography>
          {status === "connected" && peer.muted && <Typography sx={{ mt: 1, fontSize: 13, opacity: 0.75, display: "flex", alignItems: "center", gap: 0.5 }}><MicOffIcon sx={{ fontSize: 16 }} /> {user?.name?.split(" ")[0]} is muted</Typography>}
        </Box>
      )}
      {remoteVideoOn && <Box sx={{ flex: 1 }} />}
      {remoteVideoOn && peer.muted && (
        <Box sx={{ position: "relative", zIndex: 2, alignSelf: "center", mb: 2, px: 1.5, py: 0.5, borderRadius: 10, bgcolor: "rgba(0,0,0,0.45)", fontSize: 13, display: "flex", alignItems: "center", gap: 0.5 }}>
          <MicOffIcon sx={{ fontSize: 16 }} /> Muted
        </Box>
      )}

      {/* Local preview */}
      {localPreview && !incoming && (
        <Box sx={{ position: "absolute", zIndex: 3, top: "calc(76px + env(safe-area-inset-top))", right: 16, width: { xs: 104, sm: 180 }, aspectRatio: media.sharing ? "16/10" : { xs: "3/4", sm: "4/3" }, borderRadius: 3, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.45)", border: "2px solid rgba(255,255,255,0.7)" }}>
          <Video stream={localPreview} muted mirror={!media.sharing && media.facing === "user"} sx={{ width: "100%", height: "100%", objectFit: media.sharing ? "contain" : "cover" }} />
        </Box>
      )}

      {/* Controls */}
      <Box sx={{ position: "relative", zIndex: 3, pb: "calc(36px + env(safe-area-inset-bottom))", pt: 2, px: 2 }}>
        {incoming ? (
          <Box sx={{ display: "flex", justifyContent: "space-evenly", alignItems: "flex-end", maxWidth: 420, mx: "auto" }}>
            <Box sx={{ textAlign: "center" }}>
              <Ctrl title="Decline" danger big onClick={onDecline}><EndIcon /></Ctrl>
              <Typography sx={{ mt: 1, fontSize: 13, opacity: 0.85 }}>Decline</Typography>
            </Box>
            {type === "video" && (
              <Box sx={{ textAlign: "center" }}>
                <Ctrl title="Answer without video" onClick={() => onAccept(true)}><CallIcon /></Ctrl>
                <Typography sx={{ mt: 1, fontSize: 13, opacity: 0.85 }}>Voice only</Typography>
              </Box>
            )}
            <Box sx={{ textAlign: "center" }}>
              <IconButton onClick={() => onAccept(false)} aria-label="Accept" sx={{ width: 68, height: 68, borderRadius: "50%", bgcolor: "#22c55e", color: "#fff", animation: "kpBounce 1.4s infinite", "@keyframes kpBounce": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } }, "&:hover": { bgcolor: "#16a34a" }, "& svg": { fontSize: 32 } }}>
                {type === "video" ? <CamIcon /> : <CallIcon />}
              </IconButton>
              <Typography sx={{ mt: 1, fontSize: 13, opacity: 0.85 }}>Accept</Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: { xs: 1.5, sm: 2.5 }, flexWrap: "wrap", px: 2, py: 1.5, mx: "auto", width: "fit-content", borderRadius: 99, bgcolor: "rgba(15,23,42,0.35)", backdropFilter: "blur(16px)" }}>
            <Ctrl title={media.speakerOff ? "Unmute speaker" : "Mute speaker"} active={media.speakerOff} onClick={onToggleSpeaker}>{media.speakerOff ? <SpeakerOffIcon /> : <SpeakerIcon />}</Ctrl>
            <Ctrl title={media.videoOn ? "Turn camera off" : "Turn camera on"} active={media.videoOn} onClick={onToggleVideo}>{media.videoOn ? <CamIcon /> : <CamOffIcon />}</Ctrl>
            <Ctrl title="Switch camera" onClick={onFlip} hide={!media.videoOn || !isMobile}><FlipIcon /></Ctrl>
            <Ctrl title={media.sharing ? "Stop sharing" : "Share screen"} active={media.sharing} onClick={onToggleScreen} hide={!canShare}>{media.sharing ? <StopShareIcon /> : <ShareIcon />}</Ctrl>
            <Ctrl title={media.muted ? "Unmute" : "Mute"} active={media.muted} onClick={onToggleMute}>{media.muted ? <MicOffIcon /> : <MicIcon />}</Ctrl>
            <Ctrl title="End call" danger onClick={onHangUp}><EndIcon /></Ctrl>
          </Box>
        )}
      </Box>
    </Box>
  );
}

const pulse = (delay) => ({
  position: "absolute",
  width: 132,
  height: 132,
  borderRadius: "50%",
  bgcolor: "rgba(255,255,255,0.18)",
  animation: `kpPulse 2.2s ${delay}s infinite ease-out`,
  "@keyframes kpPulse": { "0%": { transform: "scale(1)", opacity: 0.9 }, "100%": { transform: "scale(1.9)", opacity: 0 } },
});
