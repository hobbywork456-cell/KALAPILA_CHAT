import React from "react";
import { 
  Box, Paper, TextField, IconButton, Typography, 
  AppBar, Toolbar, Avatar 
} from "@mui/material";
import { 
  Send as SendIcon, 
  ArrowBack as ArrowBackIcon 
} from "@mui/icons-material";

export default function Chat({ 
  selectedUser, 
  setSelectedUser, 
  messages, 
  currentUser, 
  message, 
  setMessage, 
  sendMessage, 
  bottomRef, 
  setProfileOpen 
}) {
  return (
    <Box sx={{ 
      flex: 1, 
      display: "flex", 
      flexDirection: "column", 
      bgcolor: "#f0f7ff", // Light Blue Chat Background
    }}>
      {/* --- HEADER --- */}
      <AppBar position="static" sx={{ bgcolor: "#ffffff", color: "#1a237e", boxShadow: "none", borderBottom: "1px solid #bbdefb" }}>
        <Toolbar variant="dense">
          <IconButton 
            size="small"
            sx={{ display: { md: "none" }, mr: 1, color: "#1976d2" }} 
            onClick={() => setSelectedUser(null)}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          
          <Avatar 
            onClick={() => setProfileOpen(true)}
            sx={{ width: 34, height: 34, mr: 1.5, bgcolor: "#1976d2", fontSize: "0.9rem", cursor: "pointer" }}
          >
            {selectedUser.name[0].toUpperCase()}
          </Avatar>

          <Box sx={{ flexGrow: 1, cursor: "pointer" }} onClick={() => setProfileOpen(true)}>
            <Typography variant="body2" fontWeight="bold">
              {selectedUser.name}
            </Typography>
            <Typography variant="caption" sx={{ color: "success.main", display: "block", mt: -0.5 }}>
              online
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* --- MESSAGES LIST --- */}
      <Box sx={{ 
          flex: 1, 
          p: 2, 
          overflowY: "auto", 
          display: "flex", 
          flexDirection: "column",
          // Blue-tinted chat pattern background
          backgroundImage: `url('https://www.transparenttextures.com/patterns/cubes.png')`,
          bgcolor: "#f0f7ff"
      }}>
        {messages.map((msg, i) => {
          // Robust check for sender ID comparison
          const isMe = msg.sender?._id?.toString() === currentUser?._id?.toString() || 
                       msg.sender?.toString() === currentUser?._id?.toString();
          
          return (
            <Box key={i} sx={{ alignSelf: isMe ? "flex-end" : "flex-start", mb: 1, maxWidth: "75%" }}>
              <Paper elevation={0} sx={{ 
                  p: "8px 12px", 
                  bgcolor: isMe ? "#1976d2" : "#ffffff", 
                  color: isMe ? "#fff" : "#000",
                  borderRadius: isMe ? "15px 15px 2px 15px" : "15px 15px 15px 2px",
                  border: isMe ? "none" : "1px solid #e3f2fd"
              }}>
                <Typography variant="body2" sx={{ fontSize: "0.9rem", lineHeight: 1.4 }}>
                  {msg.message}
                </Typography>
                <Typography variant="caption" sx={{ 
                    display: "block", 
                    textAlign: "right", 
                    opacity: 0.7, 
                    fontSize: "0.65rem", 
                    mt: 0.5,
                    color: isMe ? "#e3f2fd" : "text.secondary"
                }}>
                   {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Paper>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      {/* --- INPUT AREA --- */}
      <Box sx={{ p: 2, bgcolor: "#ffffff", display: "flex", alignItems: "center", gap: 1.5, borderTop: "1px solid #e3f2fd" }}>
        <TextField
          fullWidth
          placeholder="Type a message..."
          variant="outlined"
          size="small"
          autoComplete="off"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          sx={{ 
              bgcolor: "#f5f9ff", 
              "& .MuiOutlinedInput-root": { borderRadius: 4, fontSize: "0.88rem", px: 1 } 
          }}
        />
        <IconButton 
          disabled={!message.trim()} 
          onClick={sendMessage}
          sx={{ 
            bgcolor: "#1976d2", 
            color: "#fff", 
            "&:hover": { bgcolor: "#1565c0" },
            "&.Mui-disabled": { bgcolor: "#e3f2fd", color: "#90caf9" },
            p: 1.2 
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}