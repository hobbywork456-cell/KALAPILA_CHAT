import { useCallback, useEffect, useState } from "react";
import { Box, Typography, Button, List, ListItemButton, Chip, IconButton, Menu, MenuItem, ListItemIcon, TextField, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress, Tooltip } from "@mui/material";
import { ContentCopy as CopyIcon, Share as ShareIcon, ExitToApp as LeaveIcon, DeleteForever as DeleteIcon, MoreVert as MoreIcon, ChatBubbleOutlineOutlined as ChatIcon, Call as CallIcon, Videocam as VideoIcon, PersonRemove as RemoveIcon, Edit as EditIcon, Check as CheckIcon } from "@mui/icons-material";
import { toast } from "sonner";
import PanelShell, { Section } from "./PanelShell";
import { SpaceAvatar, UserAvatar } from "../Avatars";
import { useChat } from "../../state/ChatContext";
import { useCall } from "../call/CallContext";
import { API, errorMessage } from "../../lib/api";
import { lastSeenText, idOf } from "../../lib/format";
import { isNativeApp } from "../../lib/config";

const WEB_URL = import.meta.env.VITE_WEB_URL || "https://kalapila-chat.vercel.app";

export default function SpaceInfo({ space, open, onClose, onOpenUser }) {
  const { me, online, lastSeen, openChat, membersVersion, refreshSpaces, closeChat } = useChat();
  const { startCall } = useCall();
  const [members, setMembers] = useState(null);
  const [menu, setMenu] = useState(null); // { el, member }
  const [confirm, setConfirm] = useState(null); // 'leave' | 'delete' | {remove: member}
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const code = space?.spaceId;
  const load = useCallback(() => {
    if (!code) return;
    API.get(`/spaces/${code}/members`)
      .then((r) => setMembers(r.data.members))
      .catch(() => setMembers([]));
  }, [code]);

  useEffect(() => {
    if (open) load();
  }, [open, load, membersVersion]);

  useEffect(() => {
    if (open && space) {
      setName(space.name);
      setDesc(space.description || "");
      setEditing(false);
    }
  }, [open, space]);

  if (!space) return null;
  const amAdmin = members?.find((m) => idOf(m) === me)?.role === "admin" || space.myRole === "admin";
  const inviteLink = `${isNativeApp() ? WEB_URL : window.location.origin}/join/${code}`;

  const copy = (text, msg) => navigator.clipboard?.writeText(text).then(() => toast.success(msg)).catch(() => toast.error("Could not copy"));
  const share = async () => {
    const text = `Join "${space.name}" on Kalapila with code ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Kalapila invite", text, url: inviteLink });
      } catch {
        /* cancelled */
      }
    } else copy(`${text}: ${inviteLink}`, "Invite link copied");
  };

  const doConfirm = async () => {
    try {
      if (confirm === "leave") {
        await API.post(`/spaces/${code}/leave`);
        toast.success(`You left ${space.name}`);
      } else if (confirm === "delete") {
        await API.delete(`/spaces/${code}`);
        toast.success(`${space.name} was deleted`);
      } else if (confirm?.remove) {
        await API.delete(`/spaces/${code}/members/${idOf(confirm.remove)}`);
        toast.success(`${confirm.remove.name} was removed`);
        setConfirm(null);
        load();
        return;
      }
      setConfirm(null);
      onClose();
      closeChat();
      refreshSpaces();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const saveEdit = async () => {
    try {
      await API.put(`/spaces/${code}`, { name, description: desc });
      setEditing(false);
      refreshSpaces();
      toast.success("Space updated");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onlineCount = members?.filter((m) => online[idOf(m)]).length || 0;

  return (
    <PanelShell open={open} onClose={onClose} title="Space info">
      <Box sx={{ bgcolor: "background.paper", py: 4, px: 2.5, textAlign: "center" }}>
        <SpaceAvatar space={space} size={104} sx={{ mx: "auto" }} />
        {editing ? (
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5, textAlign: "left" }}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 60 } }} />
            <TextField label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 300 } }} />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button color="inherit" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="contained" startIcon={<CheckIcon />} onClick={saveEdit} disabled={!name.trim()}>Save</Button>
            </Box>
          </Box>
        ) : (
          <>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mt: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{space.name}</Typography>
              {amAdmin && (
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => setEditing(true)} aria-label="Edit space"><EditIcon fontSize="small" /></IconButton>
                </Tooltip>
              )}
            </Box>
            <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
              {members ? `${members.length} members · ${onlineCount} online` : `${space.memberCount} members`}
            </Typography>
            {space.description && <Typography sx={{ mt: 1.5, fontSize: 14.5 }}>{space.description}</Typography>}
          </>
        )}
      </Box>

      <Section title="Invite people">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.25, pl: 2, borderRadius: 3, bgcolor: "chat.selected" }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>Room code</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 20, letterSpacing: 3 }}>{code}</Typography>
          </Box>
          <Tooltip title="Copy code">
            <IconButton onClick={() => copy(code, "Room code copied")} aria-label="Copy room code"><CopyIcon /></IconButton>
          </Tooltip>
        </Box>
        <Button fullWidth startIcon={<ShareIcon />} sx={{ mt: 1.5 }} variant="outlined" onClick={share}>Share invite link</Button>
      </Section>

      <Section title={`Members${members ? ` (${members.length})` : ""}`} sx={{ px: 1 }}>
        {!members ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 3 }}><CircularProgress size={24} /></Box>
        ) : (
          <List disablePadding>
            {members.map((m) => {
              const id = idOf(m);
              const isMe = id === me;
              return (
                <ListItemButton key={id} onClick={() => !isMe && onOpenUser(m)} sx={{ gap: 1.5, py: 1 }}>
                  <UserAvatar user={m} size={42} online={!!online[id]} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700 }}>{isMe ? `${m.name} (You)` : m.name}</Typography>
                    <Typography noWrap sx={{ fontSize: 13, color: online[id] ? "success.main" : "text.secondary" }}>
                      {online[id] ? "online" : isMe ? m.email : lastSeenText(lastSeen[id] || m.lastSeen)}
                    </Typography>
                  </Box>
                  {m.role === "admin" && <Chip label="Admin" size="small" color="primary" variant="outlined" />}
                  {!isMe && (
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenu({ el: e.currentTarget, member: m }); }} aria-label="Member options">
                      <MoreIcon />
                    </IconButton>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Section>

      <Section>
        <Button fullWidth color="error" startIcon={<LeaveIcon />} onClick={() => setConfirm("leave")} sx={{ justifyContent: "flex-start", py: 1.25 }}>Leave space</Button>
        {amAdmin && (
          <Button fullWidth color="error" startIcon={<DeleteIcon />} onClick={() => setConfirm("delete")} sx={{ justifyContent: "flex-start", py: 1.25 }}>Delete space for everyone</Button>
        )}
      </Section>

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { openChat("personal", menu.member); setMenu(null); onClose(); }}>
          <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>Message
        </MenuItem>
        <MenuItem onClick={() => { const m = menu.member; setMenu(null); onClose(); startCall(m, "audio"); }}>
          <ListItemIcon><CallIcon fontSize="small" /></ListItemIcon>Voice call
        </MenuItem>
        <MenuItem onClick={() => { const m = menu.member; setMenu(null); onClose(); startCall(m, "video"); }}>
          <ListItemIcon><VideoIcon fontSize="small" /></ListItemIcon>Video call
        </MenuItem>
        {amAdmin && (
          <MenuItem onClick={() => { setConfirm({ remove: menu.member }); setMenu(null); }} sx={{ color: "error.main" }}>
            <ListItemIcon><RemoveIcon fontSize="small" color="error" /></ListItemIcon>Remove from space
          </MenuItem>
        )}
      </Menu>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirm === "leave" ? "Leave this space?" : confirm === "delete" ? "Delete this space?" : `Remove ${confirm?.remove?.name}?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm === "leave"
              ? "You'll stop receiving messages from this space. You can rejoin later with the room code."
              : confirm === "delete"
              ? "The space and all of its messages will be permanently deleted for everyone."
              : "They will be removed from the space and its group chat."}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={doConfirm}>
            {confirm === "leave" ? "Leave" : confirm === "delete" ? "Delete" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </PanelShell>
  );
}
