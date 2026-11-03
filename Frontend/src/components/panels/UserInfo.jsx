import { Box, Typography, Button } from "@mui/material";
import { Call as CallIcon, Videocam as VideoIcon, ChatBubbleOutlineOutlined as ChatIcon, EmailOutlined as EmailIcon } from "@mui/icons-material";
import PanelShell, { Section } from "./PanelShell";
import { UserAvatar } from "../Avatars";
import { useChat } from "../../state/ChatContext";
import { useCall } from "../call/CallContext";
import { lastSeenText, idOf } from "../../lib/format";

export default function UserInfo({ user, open, onClose }) {
  const { online, lastSeen, openChat, active } = useChat();
  const { startCall } = useCall();
  if (!user) return null;
  const id = idOf(user);
  const isOn = !!online[id];
  const inThisChat = active?.type === "personal" && active.id === id;

  return (
    <PanelShell open={open} onClose={onClose} title="Contact info">
      <Box sx={{ bgcolor: "background.paper", py: 4, px: 2, textAlign: "center" }}>
        <UserAvatar user={user} size={120} sx={{ mx: "auto" }} />
        <Typography sx={{ mt: 2, fontWeight: 800, fontSize: 22 }}>{user.name}</Typography>
        <Typography sx={{ color: isOn ? "success.main" : "text.secondary", fontWeight: 600, fontSize: 14 }}>
          {isOn ? "online" : lastSeenText(lastSeen[id] || user.lastSeen)}
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1.5, mt: 3 }}>
          {!inThisChat && <ActionBtn icon={<ChatIcon />} label="Message" onClick={() => { openChat("personal", user); onClose(); }} />}
          <ActionBtn icon={<CallIcon />} label="Voice" onClick={() => { onClose(); startCall(user, "audio"); }} />
          <ActionBtn icon={<VideoIcon />} label="Video" onClick={() => { onClose(); startCall(user, "video"); }} />
        </Box>
      </Box>
      <Section title="About">
        <Typography sx={{ fontSize: 15 }}>{user.bio || "Hey there! I am using Kalapila."}</Typography>
      </Section>
      <Section title="Email">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <EmailIcon color="action" />
          <Typography component="a" href={`mailto:${user.email}`} sx={{ color: "text.primary", textDecoration: "none", wordBreak: "break-all" }}>{user.email}</Typography>
        </Box>
      </Section>
    </PanelShell>
  );
}

export function ActionBtn({ icon, label, onClick, color = "primary" }) {
  return (
    <Button onClick={onClick} color={color} sx={{ flexDirection: "column", gap: 0.5, minWidth: 84, py: 1.25, borderRadius: 3, border: 1, borderColor: "divider", fontSize: 13 }}>
      {icon}
      {label}
    </Button>
  );
}
