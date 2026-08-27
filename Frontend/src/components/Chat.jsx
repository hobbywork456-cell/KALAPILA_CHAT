import React, { useState, useRef } from "react";
import {
  Box, Paper, IconButton, Typography,
  AppBar, Toolbar, Avatar, Menu, MenuItem, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  InputBase, Badge
} from "@mui/material";
import {
  Send as SendIcon, ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon, Edit as EditIcon,
  Delete as DeleteIcon, ScheduleSend as ScheduleIcon,
  Check as CheckIcon, Close as CloseIcon,
  AttachFile as AttachIcon,
  Phone as PhoneIcon,
  Videocam as VideocamIcon,
  DoneAll as DoneAllIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  ZoomIn as ZoomInIcon
} from "@mui/icons-material";

function Chat({
  selectedUser, setSelectedUser, messages, currentUser,
  message, setMessage, sendMessage, bottomRef, setProfileOpen,
  onEditMessage, onDeleteMessage, onScheduleMessage, onStartCall
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeMsg, setActiveMsg] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null); // { url, type, name }

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  if (!selectedUser) return null;

  // --- MENU HANDLERS ---
  const handleOpenMenu = (event, msg) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setActiveMsg(msg);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveMsg(null);
  };

  const startEditing = () => {
    if (activeMsg) {
      setEditingId(activeMsg._id);
      setMessage(activeMsg.message);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
    handleCloseMenu();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setMessage("");
  };

  // --- FILE HANDLING LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      let type = "image";
      if (file.type.startsWith("video")) type = "video";
      if (file.type.startsWith("audio")) type = "audio";

      sendMessage(reader.result, type);
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleScheduleSubmit = () => {
    if (!scheduleDate || !message.trim()) return;
    onScheduleMessage(message, scheduleDate);
    setScheduleOpen(false);
    setScheduleDate("");
    setMessage("");
  };

  const handleSendOrSave = () => {
    if (editingId) {
      if (message.trim()) {
        onEditMessage(editingId, message, setEditingId);
      }
    } else {
      if (message.trim()) {
        sendMessage();
      }
    }
  };

  // Rendering Helper for different message types
  const renderMessageContent = (msg) => {
    if (msg.fileType === "image") {
      return (
        <Box
          onClick={() => setPreviewMedia({ url: msg.fileUrl, type: "image", name: "Image Preview" })}
          sx={{
            mt: 0.5,
            borderRadius: "12px",
            overflow: "hidden",
            cursor: "pointer",
            position: "relative",
            "&:hover .zoom-overlay": { opacity: 1 },
          }}
        >
          <img
            src={msg.fileUrl}
            alt="media"
            style={{
              maxWidth: "100%",
              maxHeight: "320px",
              objectFit: "cover",
              display: "block",
              borderRadius: "10px",
              transition: "transform 0.2s ease"
            }}
          />
          <Box
            className="zoom-overlay"
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s ease",
              borderRadius: "10px"
            }}
          >
            <ZoomInIcon sx={{ color: "#ffffff", fontSize: 28 }} />
          </Box>
        </Box>
      );
    }
    if (msg.fileType === "video") {
      return (
        <Box sx={{ mt: 0.5, borderRadius: "12px", overflow: "hidden", position: "relative" }}>
          <video
            src={msg.fileUrl}
            controls
            style={{ maxWidth: "100%", maxHeight: "300px", display: "block", borderRadius: "10px" }}
          />
          <Button
            size="small"
            onClick={() => setPreviewMedia({ url: msg.fileUrl, type: "video", name: "Video Player" })}
            startIcon={<OpenInNewIcon sx={{ fontSize: "14px !important" }} />}
            sx={{
              mt: 0.5,
              fontSize: "0.75rem",
              textTransform: "none",
              color: "#2563eb",
              p: 0.3
            }}
          >
            Expand Viewer
          </Button>
        </Box>
      );
    }
    if (msg.fileType === "audio") {
      return (
        <Box sx={{ mt: 0.5, width: "100%", minWidth: { xs: "200px", sm: "240px" } }}>
          <audio src={msg.fileUrl} controls style={{ width: "100%", height: "36px" }} />
        </Box>
      );
    }
    return (
      <Typography
        variant="body2"
        sx={{
          fontSize: { xs: "0.92rem", sm: "0.95rem" },
          lineHeight: 1.45,
          color: "#111827",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap"
        }}
      >
        {msg.message}
      </Typography>
    );
  };

  const hasContent = Boolean(message.trim()) || Boolean(editingId);

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        bgcolor: "#e4ecf4",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* 🌟 TELEGRAM-STYLE TOP APPBAR */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: "#ffffff",
          color: "#1e293b",
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          zIndex: 10
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: "56px", sm: "64px" },
            px: { xs: 1, sm: 2 },
            gap: { xs: 0.5, sm: 1 }
          }}
        >
          {/* Back button for mobile */}
          <IconButton
            size="medium"
            onClick={() => setSelectedUser(null)}
            sx={{
              display: { md: "none" },
              color: "#3b82f6",
              p: 0.8,
              mr: 0.2
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          {/* User Avatar with Online Badge */}
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            variant="dot"
            sx={{
              "& .MuiBadge-badge": {
                bgcolor: "#22c55e",
                color: "#22c55e",
                boxShadow: "0 0 0 2px #fff",
                width: 10,
                height: 10,
                borderRadius: "50%"
              }
            }}
          >
            <Avatar
              onClick={() => setProfileOpen(true)}
              src={selectedUser?.profilePic}
              sx={{
                width: { xs: 38, sm: 42 },
                height: { xs: 38, sm: 42 },
                bgcolor: "#2563eb",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)"
              }}
            >
              {selectedUser?.name?.[0]?.toUpperCase()}
            </Avatar>
          </Badge>

          {/* User Name & Status */}
          <Box
            sx={{
              flexGrow: 1,
              cursor: "pointer",
              ml: 1,
              overflow: "hidden"
            }}
            onClick={() => setProfileOpen(true)}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              noWrap
              sx={{
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                color: "#0f172a",
                lineHeight: 1.2
              }}
            >
              {selectedUser?.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: { xs: "0.72rem", sm: "0.78rem" },
                color: "#2563eb",
                fontWeight: 500,
                display: "block"
              }}
            >
              online
            </Typography>
          </Box>

          {/* Call & Video Call Action Buttons */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.2, sm: 0.8 } }}>
            <Tooltip title="Voice Call">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onStartCall("audio");
                }}
                sx={{
                  color: "#2563eb",
                  bgcolor: "rgba(37, 99, 235, 0.08)",
                  p: { xs: 0.9, sm: 1.1 },
                  "&:hover": { bgcolor: "rgba(37, 99, 235, 0.15)" }
                }}
                aria-label="start audio call"
              >
                <PhoneIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Video Call">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onStartCall("video");
                }}
                sx={{
                  color: "#2563eb",
                  bgcolor: "rgba(37, 99, 235, 0.08)",
                  p: { xs: 0.9, sm: 1.1 },
                  "&:hover": { bgcolor: "rgba(37, 99, 235, 0.15)" }
                }}
                aria-label="start video call"
              >
                <VideocamIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 💬 TELEGRAM-STYLE MESSAGE LIST */}
      <Box
        sx={{
          flex: 1,
          p: { xs: 1.5, sm: 2.5 },
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          backgroundImage: `radial-gradient(#c5d8ea 1px, transparent 1px), radial-gradient(#c5d8ea 1px, #e4ecf4 1px)`,
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 12px 12px"
        }}
      >
        {messages.map((msg, i) => {
          const isMe =
            msg.sender?._id?.toString() === currentUser?._id?.toString() ||
            msg.sender?.toString() === currentUser?._id?.toString();

          return (
            <Box
              key={msg._id || i}
              sx={{
                alignSelf: isMe ? "flex-end" : "flex-start",
                maxWidth: { xs: "86%", sm: "75%", md: "65%" },
                position: "relative",
                transition: "all 0.15s ease"
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: { xs: "8px 12px", sm: "9px 14px" },
                  bgcolor: isMe ? "#e1ffc7" : "#ffffff",
                  color: "#1e293b",
                  borderRadius: isMe
                    ? "16px 16px 4px 16px"
                    : "16px 16px 16px 4px",
                  boxShadow: isMe
                    ? "0 1px 2px rgba(0, 128, 0, 0.12)"
                    : "0 1px 2px rgba(0, 0, 0, 0.08)",
                  position: "relative",
                  "&:hover .msg-actions": { opacity: 1 }
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                  <Box sx={{ flex: 1 }}>{renderMessageContent(msg)}</Box>
                  {isMe && (
                    <IconButton
                      className="msg-actions"
                      size="small"
                      onClick={(e) => handleOpenMenu(e, msg)}
                      sx={{
                        opacity: { xs: 0.6, sm: 0 },
                        transition: "0.2s",
                        p: 0.2,
                        ml: 0.5,
                        color: "#64748b",
                        "&:hover": { color: "#0f172a" }
                      }}
                    >
                      <MoreVertIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>

                {/* Timestamp & Status */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    mt: 0.4,
                    gap: 0.4
                  }}
                >
                  {msg.isEdited && (
                    <Typography sx={{ fontSize: "0.65rem", fontStyle: "italic", color: "#64748b" }}>
                      edited
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.68rem",
                      color: "#64748b",
                      fontWeight: 500
                    }}
                  >
                    {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Typography>
                  {isMe && (
                    <DoneAllIcon
                      sx={{
                        fontSize: 14,
                        color: "#3b82f6"
                      }}
                    />
                  )}
                </Box>
              </Paper>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      {/* --- MENU & SCHEDULE DIALOG --- */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          elevation: 4,
          sx: {
            borderRadius: "12px",
            minWidth: 140,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
          }
        }}
      >
        <MenuItem onClick={startEditing} sx={{ fontSize: "0.88rem", py: 1 }}>
          <EditIcon sx={{ fontSize: 18, mr: 1.5, color: "#2563eb" }} /> Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            onDeleteMessage(activeMsg?._id);
            handleCloseMenu();
          }}
          sx={{ fontSize: "0.88rem", py: 1, color: "#ef4444" }}
        >
          <DeleteIcon sx={{ fontSize: 18, mr: 1.5 }} /> Delete
        </MenuItem>
      </Menu>

      <Dialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        PaperProps={{ sx: { borderRadius: "16px", p: 1 } }}
      >
        <DialogTitle sx={{ fontSize: "1.1rem", fontWeight: 700, pb: 1 }}>
          📅 Schedule Message
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Choose a date and time to automatically send this message.
          </Typography>
          <InputBase
            autoFocus
            type="datetime-local"
            fullWidth
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            sx={{
              p: 1.2,
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              bgcolor: "#f8fafc",
              fontSize: "0.95rem"
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setScheduleOpen(false)} sx={{ textTransform: "none", color: "#64748b" }}>
            Cancel
          </Button>
          <Button
            onClick={handleScheduleSubmit}
            variant="contained"
            disabled={!scheduleDate || !message.trim()}
            sx={{
              textTransform: "none",
              borderRadius: "8px",
              bgcolor: "#2563eb",
              "&:hover": { bgcolor: "#1d4ed8" }
            }}
          >
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🚀 TELEGRAM-STYLE MOBILE INPUT BAR */}
      <Box
        sx={{
          p: { xs: "8px 10px", sm: "10px 16px" },
          pb: { xs: "max(10px, env(safe-area-inset-bottom))", sm: "12px" },
          bgcolor: "transparent",
          display: "flex",
          flexDirection: "column",
          gap: 0.8,
          zIndex: 10
        }}
      >
        {/* Editing indicator */}
        {editingId && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "#e0f2fe",
              p: "6px 14px",
              borderRadius: "16px",
              border: "1px solid #bae6fd",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <EditIcon sx={{ fontSize: 16, color: "#0284c7" }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#0284c7" }}>
                Editing Message
              </Typography>
            </Box>
            <IconButton size="small" onClick={cancelEdit} sx={{ color: "#0284c7", p: 0.2 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}

        {/* Input Pill & Floating Circular Send Button */}
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: { xs: 0.8, sm: 1.2 } }}>
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />

          {/* Telegram-style Capsule Pill */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              bgcolor: "#ffffff",
              borderRadius: "26px",
              p: "4px 8px",
              minHeight: { xs: "46px", sm: "50px" },
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
              border: "1px solid rgba(0, 0, 0, 0.05)",
              transition: "box-shadow 0.2s ease, border-color 0.2s ease",
              "&:focus-within": {
                boxShadow: "0 3px 12px rgba(37, 99, 235, 0.15)",
                borderColor: "#93c5fd"
              }
            }}
          >
            {/* Attachment Button */}
            <Tooltip title="Attach Media">
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  color: "#64748b",
                  p: { xs: 0.8, sm: 1 },
                  "&:hover": { color: "#2563eb", bgcolor: "rgba(37, 99, 235, 0.08)" }
                }}
              >
                <AttachIcon sx={{ fontSize: { xs: 22, sm: 24 }, transform: "rotate(45deg)" }} />
              </IconButton>
            </Tooltip>

            {/* Message Input Field */}
            <InputBase
              inputRef={inputRef}
              fullWidth
              placeholder="Message"
              multiline
              maxRows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendOrSave();
                }
              }}
              sx={{
                px: 1,
                fontSize: { xs: "0.95rem", sm: "1rem" },
                color: "#0f172a",
                lineHeight: 1.4,
                "& input::placeholder, & textarea::placeholder": {
                  color: "#94a3b8",
                  opacity: 1
                }
              }}
            />

            {/* Schedule Message Button */}
            <Tooltip title="Schedule Send">
              <IconButton
                size="small"
                onClick={() => setScheduleOpen(true)}
                sx={{
                  color: "#64748b",
                  p: { xs: 0.8, sm: 1 },
                  "&:hover": { color: "#2563eb", bgcolor: "rgba(37, 99, 235, 0.08)" }
                }}
              >
                <ScheduleIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
              </IconButton>
            </Tooltip>
          </Paper>

          {/* 🌟 Telegram Floating Circular Send Action Button */}
          <IconButton
            onClick={handleSendOrSave}
            disabled={!hasContent}
            sx={{
              width: { xs: 46, sm: 50 },
              height: { xs: 46, sm: 50 },
              minWidth: { xs: 46, sm: 50 },
              borderRadius: "50%",
              bgcolor: editingId
                ? "#22c55e"
                : hasContent
                ? "#2481cc"
                : "#94a3b8",
              color: "#ffffff",
              boxShadow: hasContent
                ? editingId
                  ? "0 3px 10px rgba(34, 197, 94, 0.4)"
                  : "0 3px 10px rgba(36, 129, 204, 0.4)"
                : "none",
              transition: "transform 0.15s ease, background-color 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                bgcolor: editingId ? "#16a34a" : "#1d71b8",
                transform: "scale(1.05)"
              },
              "&:active": {
                transform: "scale(0.95)"
              },
              "&.Mui-disabled": {
                bgcolor: "#cbd5e1",
                color: "#ffffff"
              }
            }}
          >
            {editingId ? (
              <CheckIcon sx={{ fontSize: { xs: 22, sm: 24 } }} />
            ) : (
              <SendIcon
                sx={{
                  fontSize: { xs: 20, sm: 22 },
                  ml: "2px"
                }}
              />
            )}
          </IconButton>
        </Box>
      </Box>

      {/* 🖼️ MEDIA POPUP / LIGHTBOX VIEWER */}
      <Dialog
        open={Boolean(previewMedia)}
        onClose={() => setPreviewMedia(null)}
        maxWidth="lg"
        PaperProps={{
          sx: {
            bgcolor: "rgba(10, 15, 29, 0.95)",
            backdropFilter: "blur(16px)",
            borderRadius: "24px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
            color: "#ffffff",
            overflow: "hidden",
            m: { xs: 1, sm: 2 },
            maxHeight: "92vh",
            maxWidth: "92vw",
            display: "flex",
            flexDirection: "column",
          }
        }}
      >
        {/* Lightbox Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: { xs: 1.5, sm: 2 },
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            bgcolor: "rgba(255, 255, 255, 0.03)"
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#f8fafc" }}>
            {previewMedia?.name || (previewMedia?.type === "image" ? "Image Viewer" : "Video Player")}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {previewMedia?.url && (
              <IconButton
                component="a"
                href={previewMedia.url}
                download={previewMedia.type === "image" ? "image.jpg" : "video.mp4"}
                target="_blank"
                rel="noreferrer"
                size="small"
                sx={{
                  color: "#94a3b8",
                  bgcolor: "rgba(255, 255, 255, 0.08)",
                  "&:hover": { color: "#ffffff", bgcolor: "rgba(255, 255, 255, 0.15)" }
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={() => setPreviewMedia(null)}
              sx={{
                color: "#94a3b8",
                bgcolor: "rgba(255, 255, 255, 0.08)",
                "&:hover": { color: "#ffffff", bgcolor: "#ef4444" }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Lightbox Content Body */}
        <Box
          sx={{
            p: { xs: 1, sm: 3 },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            flex: 1
          }}
        >
          {previewMedia?.type === "image" ? (
            <img
              src={previewMedia.url}
              alt="fullscreen preview"
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
              }}
            />
          ) : previewMedia?.type === "video" ? (
            <video
              src={previewMedia?.url}
              controls
              autoPlay
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
              }}
            />
          ) : null}
        </Box>
      </Dialog>
    </Box>
  );
}

export default Chat;