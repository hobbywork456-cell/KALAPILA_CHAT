import { useCallback, useMemo, useRef, useState } from "react";
import { Box, IconButton, Typography, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from "@mui/material";
import { ArrowBack as BackIcon, Call as CallIcon, Videocam as VideoIcon, InfoOutlined as InfoIcon, CloudUpload as DropIcon, Schedule as ClockIcon } from "@mui/icons-material";
import { useChat, chatKey as keyOf } from "../../state/ChatContext";
import { useCall } from "../call/CallContext";
import { UserAvatar, SpaceAvatar } from "../Avatars";
import MessageList from "./MessageList";
import Composer from "./Composer";
import ScheduleDialog from "../dialogs/ScheduleDialog";
import MediaViewer from "../dialogs/MediaViewer";
import { lastSeenText } from "../../lib/format";

// Rendered with key={chatKey} so all per-chat UI state resets when switching chats
export default function ChatWindow({ onBack, onInfo }) {
  const chat = useChat();
  const { startCall } = useCall();
  const { active, chats, me, online, lastSeen, typing } = chat;
  const key = keyOf(active.type, active.id);
  const state = chats[key];
  const isGroup = active.type === "group";

  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [schedule, setSchedule] = useState(null); // { text, done } | { listOnly: true }
  const [media, setMedia] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const typingNames = useMemo(() => Object.values(typing[key] || {}), [typing, key]);

  const title = isGroup ? active.space?.name : active.user?.name;
  let subtitle;
  if (typingNames.length) subtitle = isGroup ? `${typingNames[0].split(" ")[0]} is typing…` : "typing…";
  else if (isGroup) subtitle = `${active.space?.memberCount || 0} members · Code ${active.space?.spaceId}`;
  else subtitle = online[active.id] ? "online" : lastSeenText(lastSeen[active.id] || active.user?.lastSeen);

  const mediaItems = useMemo(
    () => (state?.messages || []).filter((m) => (m.fileType === "image" || m.fileType === "video") && !m.deleted && !m.pending),
    [state?.messages]
  );

  const sendFiles = useCallback(
    (files) => {
      files.forEach((f, i) => chat.sendFile(f, { replyTo: i === 0 ? replyTo : null }));
      setReplyTo(null);
    },
    [chat, replyTo]
  );

  const onDrop = (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) sendFiles(files.filter((f) => f.size <= 25 * 1024 * 1024));
  };

  return (
    <Box
      sx={{ height: "100%", display: "flex", flexDirection: "column", position: "relative", bgcolor: "background.paper" }}
      onDragEnter={(e) => { if (e.dataTransfer?.types?.includes("Files")) { dragDepth.current++; setDragging(true); } }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 0.5, sm: 1.5 }, pt: "calc(8px + env(safe-area-inset-top))", pb: 1, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", zIndex: 3 }}>
        <IconButton onClick={onBack} sx={{ display: { md: "none" } }} aria-label="Back">
          <BackIcon />
        </IconButton>
        <Box onClick={onInfo} sx={{ display: "flex", alignItems: "center", gap: 1.25, flex: 1, minWidth: 0, cursor: "pointer", borderRadius: 3, py: 0.25, pr: 1 }}>
          {isGroup ? <SpaceAvatar space={active.space} size={42} /> : <UserAvatar user={active.user} size={42} online={!!online[active.id]} />}
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.25 }}>{title}</Typography>
            <Typography noWrap sx={{ fontSize: 13, color: typingNames.length || (!isGroup && online[active.id]) ? "primary.main" : "text.secondary", fontWeight: typingNames.length ? 600 : 500 }}>
              {subtitle}
            </Typography>
          </Box>
        </Box>
        {!isGroup && (
          <>
            <Tooltip title="Voice call">
              <IconButton onClick={() => startCall(active.user, "audio")} aria-label="Voice call" sx={{ color: "primary.main" }}>
                <CallIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Video call">
              <IconButton onClick={() => startCall(active.user, "video")} aria-label="Video call" sx={{ color: "primary.main" }}>
                <VideoIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Tooltip title="Scheduled messages">
          <IconButton onClick={() => setSchedule({ listOnly: true })} aria-label="Scheduled messages">
            <ClockIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={isGroup ? "Space info & members" : "Contact info"}>
          <IconButton onClick={onInfo} aria-label="Info" sx={{ display: { xs: isGroup ? "inline-flex" : "none", sm: "inline-flex" } }}>
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <MessageList
        chatKey={key}
        state={state}
        me={me}
        isGroup={isGroup}
        typingNames={typingNames}
        emptyHint={isGroup ? `Say hello to everyone in ${active.space?.name}.` : `Send a message to start chatting with ${active.user?.name?.split(" ")[0] || "them"}.`}
        onLoadOlder={() => chat.loadHistory(active, { older: true })}
        onReply={(m) => { setEditing(null); setReplyTo(m); }}
        onEdit={(m) => { setReplyTo(null); setEditing(m); }}
        onDelete={(m) => setToDelete(m)}
        onOpenMedia={(m) => setMedia(m)}
        onRetry={chat.retryMessage}
        onDiscard={chat.discardMessage}
      />

      <Composer
        chatKey={key}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onTyping={chat.sendTyping}
        onSendText={(t) => { chat.sendText(t, replyTo); setReplyTo(null); }}
        onSendFiles={sendFiles}
        onSaveEdit={async (m, t) => { setEditing(null); await chat.editMessage(m._id, t); }}
        onSchedule={(text, done) => setSchedule({ text, done })}
      />

      {dragging && (
        <Box sx={{ position: "absolute", inset: 0, zIndex: 20, bgcolor: "rgba(37,99,235,0.12)", border: "3px dashed", borderColor: "primary.main", borderRadius: 3, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <Box sx={{ textAlign: "center", color: "primary.main" }}>
            <DropIcon sx={{ fontSize: 48 }} />
            <Typography sx={{ fontWeight: 800 }}>Drop files to send</Typography>
          </Box>
        </Box>
      )}

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete message?</DialogTitle>
        <DialogContent>
          <DialogContentText>This message will be deleted for everyone in the chat.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setToDelete(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { chat.deleteMessage(toDelete._id); setToDelete(null); }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <ScheduleDialog
        open={!!schedule}
        text={schedule?.text}
        listOnly={!!schedule?.listOnly}
        chat={active}
        onClose={() => setSchedule(null)}
        onScheduled={() => { schedule?.done?.(); setSchedule(null); }}
      />

      <MediaViewer item={media} items={mediaItems} onClose={() => setMedia(null)} onChange={setMedia} />
    </Box>
  );
}
