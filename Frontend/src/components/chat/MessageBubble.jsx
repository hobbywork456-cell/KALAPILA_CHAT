import { memo, useRef, useState } from "react";
import { Box, Typography, IconButton, Menu, MenuItem, ListItemIcon, CircularProgress, Button, LinearProgress } from "@mui/material";
import {
  Done as DoneIcon, DoneAll as DoneAllIcon, Schedule as ClockIcon, ExpandMore as MoreIcon,
  Reply as ReplyIcon, ContentCopy as CopyIcon, Edit as EditIcon, DeleteOutlineOutlined as DeleteIcon,
  Download as DownloadIcon, InsertDriveFileOutlined as FileIcon, Block as BlockIcon, ErrorOutlineOutlined as ErrorIcon,
  PictureAsPdfOutlined as PdfIcon,
} from "@mui/icons-material";
import { toast } from "sonner";
import { UserAvatar } from "../Avatars";
import { timeOf, fileSize, colorFor, previewOf, idOf } from "../../lib/format";
import { fileUrl } from "../../lib/config";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

function Linkified({ text }) {
  const parts = String(text || "").split(URL_RE);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <Box key={i} component="a" href={p} target="_blank" rel="noreferrer" sx={{ color: "inherit", textDecoration: "underline", wordBreak: "break-all" }} onClick={(e) => e.stopPropagation()}>
        {p}
      </Box>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function MessageBubble({ msg, mine, isGroup, showAvatar, showName, onReply, onEdit, onDelete, onOpenMedia, onJumpTo, onRetry, onDiscard, highlighted }) {
  const [menu, setMenu] = useState(null); // {x,y} or element
  const pressTimer = useRef(null);
  const bubbleRef = useRef(null);

  if (msg.system) {
    return (
      <Box id={`msg-${msg._id}`} sx={{ display: "flex", justifyContent: "center", my: 1 }}>
        <Typography sx={{ fontSize: 12.5, px: 1.5, py: 0.5, borderRadius: 10, bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)"), color: "text.secondary", fontWeight: 600 }}>
          {msg.message}
        </Typography>
      </Box>
    );
  }

  const url = fileUrl(msg.fileUrl);
  const canAct = !msg.pending && !msg.deleted;
  const openMenu = (e) => {
    if (!canAct) return;
    e.preventDefault?.();
    setMenu(e.clientX ? { mouseX: e.clientX, mouseY: e.clientY } : { el: bubbleRef.current });
  };
  const startPress = (e) => {
    if (!canAct) return;
    const touch = e.touches?.[0];
    pressTimer.current = setTimeout(() => {
      navigator.vibrate?.(15);
      setMenu(touch ? { mouseX: touch.clientX, mouseY: touch.clientY } : { el: bubbleRef.current });
    }, 450);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  const bg = mine ? "chat.mine" : "chat.theirs";
  const radius = mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px";
  const media = ["image", "video"].includes(msg.fileType) && !msg.deleted;

  const ticks = mine && (
    msg.failed ? <ErrorIcon sx={{ fontSize: 15, color: "error.main" }} /> :
    msg.pending ? <ClockIcon sx={{ fontSize: 13 }} /> :
    !isGroup && msg.seen ? <DoneAllIcon sx={{ fontSize: 16, color: "#3b82f6" }} /> :
    <DoneIcon sx={{ fontSize: 15 }} />
  );

  const meta = (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: 11, color: media && !msg.message ? "#fff" : "text.secondary", whiteSpace: "nowrap", ...(media && !msg.message ? { position: "absolute", right: 8, bottom: 6, px: 0.8, py: 0.2, borderRadius: 2, bgcolor: "rgba(0,0,0,0.45)" } : { float: "right", ml: 1.25, mt: 0.6, position: "relative", top: 4 }) }}>
      {msg.isEdited && !msg.deleted && <span>edited</span>}
      {timeOf(msg.createdAt)}
      {ticks}
    </Box>
  );

  const reply = msg.replyTo && typeof msg.replyTo === "object" && (
    <Box
      onClick={(e) => { e.stopPropagation(); onJumpTo?.(msg.replyTo._id); }}
      sx={{ mb: 0.75, px: 1.25, py: 0.6, borderRadius: 2, borderLeft: "3px solid", borderColor: colorFor(idOf(msg.replyTo.sender) || ""), bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"), cursor: "pointer", maxWidth: 320 }}
    >
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: colorFor(idOf(msg.replyTo.sender) || "") }} noWrap>
        {msg.replyTo.sender?.name || "Message"}
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }} noWrap>
        {msg.replyTo.deleted ? "Message deleted" : previewOf(msg.replyTo)}
      </Typography>
    </Box>
  );

  let body;
  if (msg.deleted) {
    body = (
      <Typography sx={{ fontSize: 14.5, fontStyle: "italic", color: "text.secondary", display: "flex", alignItems: "center", gap: 0.75 }}>
        <BlockIcon sx={{ fontSize: 16 }} /> This message was deleted {meta}
      </Typography>
    );
  } else if (msg.fileType === "image") {
    body = (
      <>
        <Box sx={{ position: "relative", borderRadius: 3, overflow: "hidden", cursor: "zoom-in", bgcolor: "rgba(0,0,0,0.06)", minWidth: 120, minHeight: 80 }} onClick={() => !msg.pending && onOpenMedia?.(msg)}>
          <Box component="img" src={url} alt={msg.fileName || "Photo"} loading="lazy" sx={{ display: "block", maxWidth: "100%", width: { xs: 240, sm: 300 }, maxHeight: 360, objectFit: "cover" }} />
          {msg.pending && <UploadOverlay progress={msg.progress} failed={msg.failed} />}
          {!msg.message && meta}
        </Box>
        {msg.message && <Typography sx={{ mt: 0.75, fontSize: 15, whiteSpace: "pre-wrap", wordBreak: "break-word" }}><Linkified text={msg.message} />{meta}</Typography>}
      </>
    );
  } else if (msg.fileType === "video") {
    body = (
      <>
        <Box sx={{ position: "relative", borderRadius: 3, overflow: "hidden", bgcolor: "#000" }}>
          <Box component="video" src={url} controls={!msg.pending} playsInline preload="metadata" sx={{ display: "block", width: { xs: 240, sm: 300 }, maxHeight: 360 }} />
          {msg.pending && <UploadOverlay progress={msg.progress} failed={msg.failed} />}
        </Box>
        <Box sx={{ mt: 0.5, minHeight: 16 }}>{msg.message && <Linkified text={msg.message} />}{meta}</Box>
      </>
    );
  } else if (msg.fileType === "audio") {
    body = (
      <Box>
        <Box component="audio" src={url} controls preload="metadata" sx={{ width: { xs: 220, sm: 260 }, height: 40, display: "block" }} />
        {msg.pending && <LinearProgress variant={msg.progress ? "determinate" : "indeterminate"} value={msg.progress || 0} sx={{ mt: 0.5, borderRadius: 2 }} />}
        <Box sx={{ minHeight: 14 }}>{meta}</Box>
      </Box>
    );
  } else if (msg.fileType === "file") {
    const isPdf = /pdf/i.test(msg.mimeType || msg.fileName || "");
    body = (
      <Box>
        <Box
          component={msg.pending ? "div" : "a"}
          href={msg.pending ? undefined : `${url}?download=1`}
          target="_blank"
          rel="noreferrer"
          sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1, pr: 1.5, borderRadius: 2.5, textDecoration: "none", color: "inherit", bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"), minWidth: 220, maxWidth: 300 }}
        >
          <Box sx={{ width: 42, height: 42, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: isPdf ? "#ef4444" : "primary.main", color: "#fff", flexShrink: 0 }}>
            {msg.pending ? <CircularProgress size={22} sx={{ color: "#fff" }} variant={msg.progress ? "determinate" : "indeterminate"} value={msg.progress} /> : isPdf ? <PdfIcon /> : <FileIcon />}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 14 }}>{msg.fileName || "File"}</Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{fileSize(msg.fileSize)}{msg.pending && msg.progress ? ` · ${msg.progress}%` : ""}</Typography>
          </Box>
          {!msg.pending && <DownloadIcon sx={{ color: "text.secondary" }} />}
        </Box>
        <Box sx={{ mt: 0.5, minHeight: 14 }}>{msg.message && <Linkified text={msg.message} />}{meta}</Box>
      </Box>
    );
  } else {
    body = (
      <Typography component="div" sx={{ fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        <Linkified text={msg.message} />
        {meta}
      </Typography>
    );
  }

  return (
    <Box
      id={`msg-${msg._id}`}
      sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", gap: 1, mt: showAvatar || showName ? 1 : 0.35, px: { xs: 1, sm: 2 }, alignItems: "flex-end" }}
    >
      {isGroup && !mine && (
        <Box sx={{ width: 32, flexShrink: 0 }}>{showAvatar && <UserAvatar user={msg.sender} size={32} />}</Box>
      )}
      <Box sx={{ maxWidth: { xs: "82%", sm: "70%", lg: "60%" }, display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
        <Box
          ref={bubbleRef}
          onContextMenu={openMenu}
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          sx={{
            position: "relative",
            bgcolor: bg,
            color: mine ? "chat.mineText" : "text.primary",
            borderRadius: radius,
            p: media && !msg.message && !msg.replyTo ? 0.5 : "8px 12px",
            boxShadow: "0 1px 1.5px rgba(15,23,42,0.08)",
            outline: highlighted ? "2px solid" : "none",
            outlineColor: "primary.main",
            transition: "outline-color .3s",
            opacity: msg.failed ? 0.75 : 1,
            WebkitUserSelect: "text",
            "&:hover .msg-more": { opacity: 1 },
          }}
        >
          {isGroup && !mine && showName && (
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: colorFor(idOf(msg.sender) || ""), mb: 0.25, px: media ? 0.75 : 0 }}>
              {msg.sender?.name}
            </Typography>
          )}
          {reply}
          {body}
          {canAct && (
            <IconButton
              className="msg-more"
              size="small"
              onClick={(e) => { e.stopPropagation(); setMenu({ el: e.currentTarget }); }}
              aria-label="Message options"
              sx={{ position: "absolute", top: 2, right: 2, opacity: 0, transition: "opacity .15s", p: 0.25, bgcolor: bg, display: { xs: "none", md: "inline-flex" }, "&:hover": { bgcolor: bg } }}
            >
              <MoreIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>
        {msg.failed && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
            <Typography sx={{ fontSize: 12, color: "error.main" }}>Not sent</Typography>
            <Button size="small" onClick={() => onRetry?.(msg)} sx={{ minWidth: 0, py: 0, fontSize: 12 }}>Retry</Button>
            <Button size="small" color="inherit" onClick={() => onDiscard?.(msg)} sx={{ minWidth: 0, py: 0, fontSize: 12, color: "text.secondary" }}>Remove</Button>
          </Box>
        )}
      </Box>

      <Menu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchorEl={menu?.el}
        anchorReference={menu?.mouseX ? "anchorPosition" : "anchorEl"}
        anchorPosition={menu?.mouseX ? { top: menu.mouseY, left: menu.mouseX } : undefined}
      >
        <MenuItem onClick={() => { setMenu(null); onReply?.(msg); }}>
          <ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon>Reply
        </MenuItem>
        {msg.message && (
          <MenuItem onClick={() => { setMenu(null); navigator.clipboard?.writeText(msg.message).then(() => toast.success("Copied")); }}>
            <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>Copy text
          </MenuItem>
        )}
        {msg.fileUrl && (
          <MenuItem component="a" href={`${url}${url.startsWith("data:") ? "" : "?download=1"}`} download={msg.fileName || true} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Download
          </MenuItem>
        )}
        {mine && msg.fileType === "text" && (
          <MenuItem onClick={() => { setMenu(null); onEdit?.(msg); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Edit
          </MenuItem>
        )}
        {mine && (
          <MenuItem onClick={() => { setMenu(null); onDelete?.(msg); }} sx={{ color: "error.main" }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>Delete for everyone
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}

function UploadOverlay({ progress, failed }) {
  return (
    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(0,0,0,0.35)" }}>
      {failed ? (
        <ErrorIcon sx={{ color: "#fff", fontSize: 36 }} />
      ) : (
        <Box sx={{ position: "relative", display: "grid", placeItems: "center" }}>
          <CircularProgress variant={progress ? "determinate" : "indeterminate"} value={progress || 0} size={46} thickness={4} sx={{ color: "#fff" }} />
          {!!progress && <Typography sx={{ position: "absolute", color: "#fff", fontSize: 11, fontWeight: 800 }}>{progress}%</Typography>}
        </Box>
      )}
    </Box>
  );
}

export default memo(MessageBubble);
