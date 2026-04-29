import React, { useEffect, useState, useRef } from "react";
import { 
  Box, List, ListItem, ListItemButton, ListItemAvatar, 
  ListItemText, Avatar, TextField, Typography, 
  AppBar, Toolbar, Divider 
} from "@mui/material";
import { Search as SearchIcon, Chat as ChatIcon } from "@mui/icons-material";
import { API } from "../api";
import { socket } from "../socket";
import { useNavigate } from "react-router-dom";

// Component Imports
import Chat from "../components/Chat";
import ProfileView from "../components/ProfileView";

export default function Home() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user"));
  
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  
  const bottomRef = useRef(null);
  const timerRef = useRef(null);

  // Logout Logic for Auto-Logout
  const handleLogout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem("user");
    navigate("/login");
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => handleLogout(), 120000); 
  };

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    resetTimer();
    events.forEach((e) => window.addEventListener(e, resetTimer));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);

  useEffect(() => {
    // 🔍 Validate user and subscription ID
    if (!currentUser || !currentUser.subscriptionId) { 
      navigate("/login"); 
      return; 
    }

    // ✅ FETCH USERS: Scoped by subscriptionId
    API.get(`/auth/users?subscriptionId=${currentUser.subscriptionId}`)
      .then((res) => {
        // Filter out the current user from the company list
        setUsers(res.data.filter((u) => u._id !== currentUser._id));
      })
      .catch((err) => console.error("Error loading colleagues:", err));

    socket.emit("join", currentUser._id);
  }, [navigate]);

  useEffect(() => {
    if (!selectedUser) return;
    
    // Request messages for this specific pair
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = () => {
    if (!message.trim() || !selectedUser) return;
    
    // Note: Backend now checks subscriptionId match before saving/sending
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
      height: "100vh", 
      width: "100vw", 
      bgcolor: "#e3f2fd", 
      margin: 0, 
      padding: 0, 
      overflow: "hidden", 
      position: "fixed", 
      top: 0, 
      left: 0 
    }}>
      
      {/* SIDEBAR */}
      <Box sx={{ 
        width: { xs: selectedUser ? "0%" : "100%", md: "320px" }, 
        display: { xs: selectedUser ? "none" : "flex", md: "flex" }, 
        flexDirection: "column", bgcolor: "#ffffff", borderRight: "1px solid #bbdefb" 
      }}>
        <AppBar position="static" sx={{ bgcolor: "#bbdefb", color: "#0d47a1", boxShadow: "none" }}>
          <Toolbar variant="dense">
            <Avatar sx={{ width: 32, height: 32, bgcolor: "#1976d2", mr: 1.5 }}>
              {currentUser?.name?.[0].toUpperCase()}
            </Avatar>
            <Typography variant="subtitle1" fontWeight="bold">Chats</Typography>
            {/* Displaying Subscription ID for reference (Optional) */}
            <Typography variant="caption" sx={{ ml: "auto", opacity: 0.7 }}>
              ID: {currentUser?.subscriptionId}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 2, bgcolor: "#f5f9ff" }}>
          <TextField 
            fullWidth size="small" placeholder="Search colleagues..." 
            InputProps={{ startAdornment: <SearchIcon sx={{ color: "#90caf9", mr: 1 }} /> }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "#fff", fontSize: "0.85rem" } }}
          />
        </Box>

        <List sx={{ flex: 1, overflowY: "auto", py: 0 }}>
          {users.map((user) => (
            <React.Fragment key={user._id}>
              <ListItem disablePadding>
                <ListItemButton 
                  onClick={() => setSelectedUser(user)} 
                  selected={selectedUser?._id === user._id}
                  sx={{ "&.Mui-selected": { bgcolor: "#e3f2fd" } }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: "#64b5f6" }}>{user.name[0].toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={<Typography variant="body2" fontWeight={600} color="#1a237e">{user.name}</Typography>} 
                    secondary={<Typography variant="caption" color="textSecondary">Colleague</Typography>}
                  />
                </ListItemButton>
              </ListItem>
              <Divider sx={{ mx: 2, opacity: 0.5 }} />
            </React.Fragment>
          ))}
          {users.length === 0 && (
            <Typography variant="caption" sx={{ p: 3, textAlign: "center", display: "block", color: "text.secondary" }}>
              No other members in this group yet.
            </Typography>
          )}
        </List>
      </Box>

      {/* CHAT AREA */}
      {selectedUser ? (
        <>
          <Chat 
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            messages={messages}
            currentUser={currentUser}
            message={message}
            setMessage={setMessage}
            sendMessage={sendMessage}
            bottomRef={bottomRef}
            setProfileOpen={setProfileOpen}
          />
          <ProfileView 
            open={profileOpen} 
            onClose={() => setProfileOpen(false)} 
            user={selectedUser} 
          />
        </>
      ) : (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f0f7ff" }}>
          <Box sx={{ opacity: 0.4, textAlign: "center" }}>
             <ChatIcon sx={{ fontSize: 80, color: "#90caf9", mb: 2 }} />
             <Typography variant="h6" color="#1976d2">Welcome to {currentUser?.subscriptionId} Space</Typography>
             <Typography variant="body2" color="textSecondary">Select a colleague to start a private chat</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}