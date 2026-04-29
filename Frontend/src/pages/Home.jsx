import React, { useEffect, useState, useRef } from "react";
import { 
  Box, Paper, List, ListItem, ListItemButton, 
  ListItemAvatar, ListItemText, Avatar, Divider, TextField, 
  IconButton, Typography, AppBar, Toolbar, Badge 
} from "@mui/material";
import { 
  Send as SendIcon, 
  Logout as LogoutIcon, 
  Search as SearchIcon, 
  Chat as ChatIcon,
  ArrowBack as ArrowBackIcon
} from "@mui/icons-material";
import { API } from "../api";
import { socket } from "../socket";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user"));
  
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  
  const bottomRef = useRef(null);
  const timerRef = useRef(null); // Ref for the inactivity timer

  // --- LOGOUT LOGIC ---
  const handleLogout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem("user");
    navigate("/login");
  };

  // --- AUTO LOGOUT LOGIC ---
  const resetTimer = () => {
    // Clear existing timer
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Set new timer for 2 minutes (120,000 ms)
    timerRef.current = setTimeout(() => {
      console.log("User inactive for 2 minutes. Logging out...");
      handleLogout();
    }, 120000); 
  };

  useEffect(() => {
    // Events that signify the user is active
    const activityEvents = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];

    // Initialize timer
    resetTimer();

    // Add listeners to reset the timer on activity
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup listeners and timer on component unmount
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  // --- AUTH & USER DATA ---
  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    API.get("/auth/users").then((res) => {
      setUsers(res.data.filter((u) => u._id !== currentUser._id));
    });
    socket.emit("join", currentUser._id);
  }, [navigate]);

  // --- CHAT SOCKET LOGIC ---
  useEffect(() => {
    if (!selectedUser) return;
    
    socket.emit("getMessages", { senderId: currentUser._id, receiverId: selectedUser._id });
    
    socket.on("messageHistory", (msgs) => setMessages(msgs));
    
    socket.on("receiveMessage", (msg) => {
      if (msg.sender === selectedUser._id || msg.sender === currentUser._id) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("messageHistory");
    };
  }, [selectedUser, currentUser?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim() || !selectedUser) return;
    socket.emit("sendMessage", { 
        senderId: currentUser._id, 
        receiverId: selectedUser._id, 
        message 
    });
    setMessage("");
  };

  return (
    <Box sx={{ 
      display: "flex", 
      height: "95vh", 
      width: "85vw", 
      bgcolor: "#c43636", 
      margin: "auto",
      mt: "2.5vh"
    }}>
      {/* --- SIDEBAR --- */}
      <Box sx={{ 
        width: { xs: selectedUser ? "0%" : "100%", md: "300px", lg: "320px" },
        display: { xs: selectedUser ? "none" : "flex", md: "flex" },
        flexDirection: "column",
        bgcolor: "#fff",
        borderRight: "1px solid #ddd",
      }}>
        <AppBar position="static" sx={{ bgcolor: "#ededed", color: "#000", boxShadow: "none", borderBottom: "1px solid #ddd" }}>
          <Toolbar variant="dense" sx={{ justifyContent: "space-between" }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "#1976d2", fontSize: "0.9rem" }}>
              {currentUser?.name?.[0].toUpperCase()}
            </Avatar>
            <IconButton size="small" onClick={handleLogout}><LogoutIcon fontSize="small" /></IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search..."
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: "gray", mr: 1, fontSize: 18 }} />,
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#f0f2f5", fontSize: "0.85rem" } }}
          />
        </Box>

        <List sx={{ flex: 1, overflowY: "auto", p: 0 }}>
          {users.map((user) => (
            <React.Fragment key={user._id}>
              <ListItem disablePadding>
                <ListItemButton 
                    dense
                    onClick={() => setSelectedUser(user)} 
                    selected={selectedUser?._id === user._id}
                >
                  <ListItemAvatar sx={{ minWidth: 48 }}>
                    <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} variant="dot" color="success">
                        <Avatar sx={{ width: 36, height: 36, bgcolor: "#5bc0de", fontSize: "1rem" }}>
                          {user.name[0].toUpperCase()}
                        </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={<Typography variant="body2" fontWeight={600}>{user.name}</Typography>} 
                    secondary={<Typography variant="caption" noWrap>Click to chat</Typography>} 
                  />
                </ListItemButton>
              </ListItem>
              <Divider variant="inset" component="li" sx={{ ml: "64px" }} />
            </React.Fragment>
          ))}
        </List>
      </Box>

      {/* --- CHAT AREA --- */}
      <Box sx={{ 
        flex: 1, 
        display: { xs: selectedUser ? "flex" : "none", md: "flex" }, 
        flexDirection: "column", 
        bgcolor: "#efeae2",
      }}>
        {selectedUser ? (
          <>
            <AppBar position="static" sx={{ bgcolor: "#ededed", color: "#000", boxShadow: "none", borderBottom: "1px solid #ddd" }}>
              <Toolbar variant="dense">
                <IconButton 
                  size="small"
                  sx={{ display: { md: "none" }, mr: 1 }} 
                  onClick={() => setSelectedUser(null)}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: "#5bc0de", fontSize: "0.9rem" }}>
                  {selectedUser.name[0].toUpperCase()}
                </Avatar>
                <Typography variant="body2" fontWeight="bold">{selectedUser.name}</Typography>
              </Toolbar>
            </AppBar>

            <Box sx={{ 
                flex: 1, 
                p: 2, 
                overflowY: "auto", 
                display: "flex", 
                flexDirection: "column",
                backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
                backgroundSize: "400px"
            }}>
              {messages.map((msg, i) => {
                const isMe = msg.sender?.toString() === currentUser?._id?.toString();
                return (
                  <Box key={i} sx={{ alignSelf: isMe ? "flex-end" : "flex-start", mb: 0.8, maxWidth: "80%" }}>
                    <Paper elevation={1} sx={{ 
                        p: "5px 10px", 
                        bgcolor: isMe ? "#dcf8c6" : "#fff", 
                        borderRadius: isMe ? "8px 0 8px 8px" : "0 8px 8px 8px" 
                    }}>
                      <Typography variant="body2" sx={{ fontSize: "0.88rem", lineHeight: 1.3 }}>{msg.message}</Typography>
                      <Typography variant="caption" sx={{ display: "block", textAlign: "right", opacity: 0.5, fontSize: "0.65rem", mt: 0.3 }}>
                         {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Paper>
                  </Box>
                );
              })}
              <div ref={bottomRef} />
            </Box>

            <Box sx={{ p: 1, bgcolor: "#f0f2f5", display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Type a message"
                variant="outlined"
                size="small"
                autoComplete="off"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                sx={{ 
                    bgcolor: "#fff", 
                    "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: "0.85rem" } 
                }}
              />
              <IconButton 
                size="small"
                disabled={!message.trim()} 
                onClick={sendMessage}
                sx={{ bgcolor: "#00a884", color: "#fff", "&:hover": { bgcolor: "#008f72" }, p: 1 }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Box>
          </>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", bgcolor: "#f8f9fa" }}>
            <ChatIcon sx={{ fontSize: 60, opacity: 0.1, mb: 1 }} />
            <Typography variant="body2" color="textSecondary">Select a conversation to start</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}