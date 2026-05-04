import React, { useState, useRef } from "react";
import { 
  Box, Paper, TextField, IconButton, Typography, 
  AppBar, Toolbar, Avatar, Menu, MenuItem, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button
} from "@mui/material";
import { 
  Send as SendIcon, ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon, Edit as EditIcon,
  Delete as DeleteIcon, ScheduleSend as ScheduleIcon,
  Check as CheckIcon, Close as CloseIcon,
  AttachFile as AttachIcon
} from "@mui/icons-material";

function Chat({ 
  selectedUser, setSelectedUser, messages, currentUser, 
  message, setMessage, sendMessage, bottomRef, setProfileOpen,
  onEditMessage, onDeleteMessage, onScheduleMessage
}) {
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeMsg, setActiveMsg] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  
  const fileInputRef = useRef(null);

  if (!selectedUser) return null;

  // --- MENU HANDLERS ---
  const handleOpenMenu = (event, msg) => {
    setAnchorEl(event.currentTarget);
    setActiveMsg(msg);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveMsg(null);
  };

  const startEditing = () => {
    setEditingId(activeMsg._id);
    setMessage(activeMsg.message);
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

  // 1. Check file size (Base64 can't handle huge files easily)
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    alert("File is too large. Please upload less than 5MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    let type = "image";
    if (file.type.startsWith("video")) type = "video";
    if (file.type.startsWith("audio")) type = "audio";

    // reader.result is now an ArrayBuffer (Binary)
    // This stops 'is-binary.js' from crashing
    sendMessage(reader.result, type);
  };
  
  reader.readAsArrayBuffer(file); // Use ArrayBuffer instead of DataURL
};
  const handleScheduleSubmit = () => {
    if (!scheduleDate || !message.trim()) return;
    onScheduleMessage(message, scheduleDate);
    setScheduleOpen(false);
    setScheduleDate("");
    setMessage("");
  };

  // Rendering Helper for different message types
  const renderMessageContent = (msg) => {
    if (msg.fileType === "image") return <img src={msg.fileUrl} alt="sent" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '5px' }} />;
    if (msg.fileType === "video") return <video src={msg.fileUrl} controls style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '5px' }} />;
    if (msg.fileType === "audio") return <audio src={msg.fileUrl} controls style={{ maxWidth: '100%', marginTop: '5px' }} />;
    return <Typography variant="body2" sx={{ pr: 2, whiteSpace: "pre-wrap" }}>{msg.message}</Typography>;
  };

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", bgcolor: "#f0f2f5" }}>
      {/* HEADER */}
      <AppBar position="static" sx={{ bgcolor: "#ffffff", color: "#1a237e", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
        <Toolbar variant="dense">
          <IconButton size="small" sx={{ display: { md: "none" }, mr: 1 }} onClick={() => setSelectedUser(null)}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Avatar 
            onClick={() => setProfileOpen(true)}
            sx={{ width: 36, height: 36, mr: 1.5, cursor: "pointer" }}
            src={selectedUser?.profilePic}
          />
          <Box sx={{ flexGrow: 1, cursor: "pointer" }} onClick={() => setProfileOpen(true)}>
            <Typography variant="subtitle2" fontWeight="bold">{selectedUser?.name}</Typography>
            <Typography variant="caption" color="success.main">online</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* MESSAGES LIST */}
      <Box sx={{ flex: 1, p: 2, overflowY: "auto", display: "flex", flexDirection: "column", backgroundImage: `url('https://www.transparenttextures.com/patterns/cubes.png')` }}>
        {messages.map((msg, i) => {
          const isMe = msg.sender?._id?.toString() === currentUser?._id?.toString() || msg.sender?.toString() === currentUser?._id?.toString();
          return (
            <Box key={msg._id || i} sx={{ alignSelf: isMe ? "flex-end" : "flex-start", mb: 1, maxWidth: "75%" }}>
              <Paper elevation={0} sx={{ 
                  p: "6px 10px", 
                  bgcolor: isMe ? "#dcf8c6" : "#ffffff",
                  borderRadius: isMe ? "10px 0px 10px 10px" : "0px 10px 10px 10px",
                  boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
                  position: "relative",
                  "&:hover .msg-actions": { opacity: 1 }
              }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  {renderMessageContent(msg)}
                  {isMe && (
                    <IconButton className="msg-actions" size="small" onClick={(e) => handleOpenMenu(e, msg)} sx={{ opacity: 0, transition: "0.2s", p: 0 }}>
                      <MoreVertIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mt: 0.2, gap: 0.5 }}>
                  {msg.isEdited && <Typography sx={{ fontSize: "0.6rem", fontStyle: "italic", opacity: 0.5 }}>edited</Typography>}
                  <Typography variant="caption" sx={{ fontSize: "0.6rem", opacity: 0.5 }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
              </Paper>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      {/* MENU & DIALOGS */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem onClick={startEditing} sx={{ fontSize: "0.85rem" }}>
          <EditIcon sx={{ fontSize: 16, mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { onDeleteMessage(activeMsg?._id); handleCloseMenu(); }} sx={{ fontSize: "0.85rem", color: "error.main" }}>
          <DeleteIcon sx={{ fontSize: 16, mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)}>
        <DialogTitle sx={{ fontSize: "1rem" }}>Schedule Message</DialogTitle>
        <DialogContent>
          <TextField autoFocus type="datetime-local" fullWidth variant="standard" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleOpen(false)} size="small">Cancel</Button>
          <Button onClick={handleScheduleSubmit} variant="contained" size="small" disabled={!scheduleDate || !message.trim()}>Schedule</Button>
        </DialogActions>
      </Dialog>

      {/* INPUT AREA */}
      <Box sx={{ p: 1.5, bgcolor: "#f0f2f5", display: "flex", flexDirection: "column", gap: 1 }}>
        {editingId && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "#e3f2fd", p: 1, borderRadius: 2 }}>
            <Typography variant="caption" color="primary">Editing message...</Typography>
            <IconButton size="small" onClick={cancelEdit}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
          </Box>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <input type="file" accept="image/*,video/*,audio/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          
          <IconButton size="small" onClick={() => fileInputRef.current.click()} sx={{ color: "#54656f" }}>
            <AttachIcon />
          </IconButton>

          <Tooltip title="Schedule Message">
            <IconButton size="small" onClick={() => setScheduleOpen(true)} sx={{ color: "#54656f" }}>
              <ScheduleIcon />
            </IconButton>
          </Tooltip>

          <TextField
            fullWidth placeholder="Type a message..." variant="outlined" size="small" multiline maxRows={4} value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (message.trim()) {
                  editingId ? onEditMessage(editingId, message, setEditingId) : sendMessage();
                }
              }
            }}
            sx={{ bgcolor: "#ffffff", "& .MuiOutlinedInput-root": { borderRadius: 3, fontSize: "0.9rem" } }}
          />

          <IconButton 
            disabled={!message.trim() && !editingId} 
            onClick={editingId ? () => onEditMessage(editingId, message, setEditingId) : sendMessage}
            sx={{ 
              bgcolor: (message.trim() || editingId) ? "#00a884" : "transparent", 
              color: (message.trim() || editingId) ? "#fff" : "#54656f",
              "&:hover": { bgcolor: "#008f72" } 
            }}
          >
            {editingId ? <CheckIcon fontSize="small" /> : <SendIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

// --- THIS IS THE CRITICAL LINE FOR OPTION 1 ---
export default Chat;