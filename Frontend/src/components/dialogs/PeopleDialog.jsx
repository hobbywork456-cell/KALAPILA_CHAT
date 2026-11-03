import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, Box, IconButton, InputBase, List, ListItemButton, Typography, CircularProgress, Tooltip, useMediaQuery } from "@mui/material";
import { Close as CloseIcon, Search as SearchIcon, Call as CallIcon, Videocam as VideoIcon, ChatBubbleOutlineOutlined as ChatIcon } from "@mui/icons-material";
import { API } from "../../lib/api";
import { useChat } from "../../state/ChatContext";
import { useCall } from "../call/CallContext";
import { UserAvatar } from "../Avatars";
import { idOf } from "../../lib/format";

// "New chat" and "Call by email" – find anyone by name or email
export default function PeopleDialog({ open, mode = "chat", onClose, onOpened }) {
  const { conversations, online, openChat } = useChat();
  const { startCall } = useCall();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const fullScreen = useMediaQuery((t) => t.breakpoints.down("sm"));

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return setResults([]);
    setLoading(true);
    const t = setTimeout(() => {
      API.get("/auth/search-users", { params: { query } })
        .then((r) => setResults(r.data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const recent = conversations.map((c) => c.user).slice(0, 8);
  const list = q.trim().length >= 2 ? results : recent;

  const message = (u) => {
    openChat("personal", u);
    onOpened?.();
    onClose();
  };
  const call = (u, type) => {
    onClose();
    startCall(u, type);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pt: fullScreen ? "calc(16px + env(safe-area-inset-top))" : 2 }}>
        <Typography component="span" sx={{ flex: 1, fontWeight: 800, fontSize: 19 }}>{mode === "call" ? "Call someone" : "New chat"}</Typography>
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 46, borderRadius: 3, bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(148,163,184,0.1)" : "#eef2f7"), mb: 1.5 }}>
          <SearchIcon sx={{ color: "text.secondary" }} />
          <InputBase autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email address" sx={{ flex: 1 }} inputProps={{ "aria-label": "Search people", inputMode: "email" }} />
          {loading && <CircularProgress size={18} />}
        </Box>
        {list.length > 0 && (
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: "text.secondary", px: 1, mb: 0.5, letterSpacing: 0.5 }}>
            {q.trim().length >= 2 ? "RESULTS" : "RECENT"}
          </Typography>
        )}
        <List disablePadding>
          {list.map((u) => (
            <ListItemButton key={idOf(u)} onClick={() => (mode === "call" ? call(u, "audio") : message(u))} sx={{ gap: 1.5, py: 1 }}>
              <UserAvatar user={u} size={42} online={!!online[idOf(u)]} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700 }}>{u.name}</Typography>
                <Typography noWrap sx={{ fontSize: 13, color: "text.secondary" }}>{u.email}</Typography>
              </Box>
              <Box sx={{ display: "flex" }} onClick={(e) => e.stopPropagation()}>
                {mode === "call" && (
                  <Tooltip title="Message"><IconButton onClick={() => message(u)} aria-label="Message"><ChatIcon /></IconButton></Tooltip>
                )}
                <Tooltip title="Voice call"><IconButton onClick={() => call(u, "audio")} color="primary" aria-label="Voice call"><CallIcon /></IconButton></Tooltip>
                <Tooltip title="Video call"><IconButton onClick={() => call(u, "video")} color="primary" aria-label="Video call"><VideoIcon /></IconButton></Tooltip>
              </Box>
            </ListItemButton>
          ))}
        </List>
        {q.trim().length >= 2 && !loading && results.length === 0 && (
          <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>No one found for “{q.trim()}”.</Typography>
        )}
        {q.trim().length < 2 && recent.length === 0 && (
          <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4, px: 2 }}>
            Type at least 2 letters of a name or email to find people on Kalapila.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
