import React, { useEffect, useState, useRef } from "react";
import {
  Box, List, ListItem, ListItemButton, ListItemAvatar,
  ListItemText, Avatar, TextField, Typography,
  AppBar, Toolbar, Divider, CircularProgress
} from "@mui/material";
import { Search as SearchIcon, Chat as ChatIcon } from "@mui/icons-material";
import { API } from "../api";
import { socket } from "../socket";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// Component Imports
import Chat from "../components/Chat";
import ProfileView from "../components/ProfileView";
import Profile from "../components/Profile";
import CallHandler from "../components/CallHandler";


export default function Home() {
  const navigate = useNavigate();

  // 1. Safe parsing of localStorage
  const [currentUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);

  //------Call States-------
  const [calling, setCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callType, setCallType] = useState("video");

  const bottomRef = useRef(null);
  const timerRef = useRef(null);

  // --- LOGIC HANDLERS ---

  const handleLogout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem("user");
    navigate("/");
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => handleLogout(), 1200000); // 20 mins
  };

  const handleEditMessage = (messageId, newMessage, setEditingId) => {
    if (!currentUser) return;
    socket.emit("editMessage", {
      messageId,
      newMessage,
      senderId: currentUser._id
    });
    setEditingId(null);
    setMessage("");
  };

  const handleDeleteMessage = (messageId) => {
    if (!currentUser) return;
    socket.emit("deleteMessage", {
      messageId,
      senderId: currentUser._id
    });
  };
  const initiateCall = (userToCall, type = "video") => {
    setSelectedUser(userToCall);
    setCallType(type);
    setCalling(true);
  };
  const handleScheduleMessage = (text, time) => {
    if (!currentUser || !selectedUser) return;
    socket.emit("sendMessage", {
      senderId: currentUser._id,
      receiverId: selectedUser._id,
      message: text,
      scheduledTime: time
    });
  };

  const sendMessage = (fileUrl = null, fileType = "text") => {
    if (!message.trim() && !fileUrl) return;

    socket.emit("sendMessage", {
      senderId: currentUser._id,
      receiverId: selectedUser._id,
      message: message,
      fileUrl: fileUrl,  // Send the Base64 here
      fileType: fileType // Send "image", "video", or "audio"
    });

    setMessage("");
  };

  // --- EFFECTS ---

  // 🛡️ Guard: Check if user exists on mount
  useEffect(() => {
    if (!currentUser || !currentUser.subscriptionId) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  // Socket: Join and Listen for Updates
  useEffect(() => {
    if (!socket || !currentUser) return;

    socket.emit("join", currentUser._id);

    const onMessageUpdated = (updatedMsg) => {
      setMessages((prev) => prev.map((m) => m._id === updatedMsg._id ? updatedMsg : m));
    };

    const onMessageDeleted = (deletedId) => {
      setMessages((prev) => prev.filter((m) => m._id !== deletedId));
    };

    const onIncomingCall = (data) => {
      setIncomingCall(data);
    };

    const onCallEnded = () => {
      setIncomingCall(null);
      setCalling(false);
    };

    const onReceiveMessage = (msg) => {
      if (msg.sender?.toString() !== currentUser._id.toString()) {
        const senderDisplayName = msg.senderName || "Someone";
        const notificationText = msg.fileType !== "text"
          ? `Sent a ${msg.fileType}`
          : msg.message;

        toast.info(`New message from ${senderDisplayName}: ${notificationText}`, {
          position: "top-right",
          autoClose: 3000,
          icon: "💬"
        });
      }

      setMessages((prev) => {
        const exists = prev.find((m) => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
    };

    socket.on("messageUpdated", onMessageUpdated);
    socket.on("messageDeleted", onMessageDeleted);
    socket.on("incoming-call", onIncomingCall);
    socket.on("call-ended", onCallEnded);
    socket.on("receiveMessage", onReceiveMessage);

    return () => {
      socket.off("messageUpdated", onMessageUpdated);
      socket.off("messageDeleted", onMessageDeleted);
      socket.off("incoming-call", onIncomingCall);
      socket.off("call-ended", onCallEnded);
      socket.off("receiveMessage", onReceiveMessage);
    };
  }, [socket, currentUser]);

  // Fetch History when user is selected
  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    socket.emit("getMessages", { senderId: currentUser._id, receiverId: selectedUser._id });

    socket.on("messageHistory", (msgs) => setMessages(msgs));

    return () => {
      socket.off("messageHistory");
    };
  }, [selectedUser, currentUser]);

  // Fetch Colleagues
  useEffect(() => {
    if (!currentUser?.subscriptionId) return;

    API.get(`/auth/users?subscriptionId=${currentUser.subscriptionId}`)
      .then((res) => {
        setUsers(res.data.filter((u) => u._id !== currentUser._id));
      })
      .catch((err) => console.error("Error loading colleagues:", err));
  }, [currentUser]);

  // Auto-scroll and Idle Timer
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    resetTimer();
    events.forEach((e) => window.addEventListener(e, resetTimer));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);

  // 🛡️ CRASH PREVENTION: Show loading if data isn't ready
  if (!currentUser) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const filteredUsers = users.filter((u) =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <Box
      sx={{
        display: "flex",
        height: { xs: "100dvh", md: "100vh" },
        width: "100vw",
        bgcolor: "#f0f4f8",
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <ToastContainer position="bottom-right" autoClose={3000} />

      {/* 📱 SIDEBAR / CHATS LIST */}
      <Box
        sx={{
          width: { xs: selectedUser ? "0%" : "100%", md: "340px", lg: "380px" },
          display: { xs: selectedUser ? "none" : "flex", md: "flex" },
          flexDirection: "column",
          bgcolor: "#ffffff",
          borderRight: "1px solid rgba(0, 0, 0, 0.08)",
          height: "100%",
          zIndex: 5
        }}
      >
        {/* Top Header */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: "#ffffff",
            color: "#0f172a",
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)"
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1.5, sm: 2 } }}>
            <Avatar
              onClick={() => setIsMyProfileOpen(true)}
              src={currentUser?.profilePic || ""}
              sx={{
                width: 38,
                height: 38,
                bgcolor: "#2563eb",
                mr: 1.5,
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
                transition: "transform 0.2s",
                "&:hover": { transform: "scale(1.05)" }
              }}
            >
              {currentUser?.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#0f172a", lineHeight: 1.2 }}>
                Chats
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500 }}>
                {currentUser?.subscriptionId} Space
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Search Bar */}
        <Box sx={{ p: 1.5, bgcolor: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search colleagues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: "#94a3b8", mr: 1, fontSize: 20 }} />
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "20px",
                bgcolor: "#f1f5f9",
                fontSize: "0.9rem",
                "& fieldset": { borderColor: "transparent" },
                "&:hover fieldset": { borderColor: "#cbd5e1" },
                "&.Mui-focused fieldset": { borderColor: "#3b82f6" }
              }
            }}
          />
          <Profile open={isMyProfileOpen} onClose={() => setIsMyProfileOpen(false)} currentUser={currentUser} />
        </Box>

        {/* Colleague Chat List */}
        <List sx={{ flex: 1, overflowY: "auto", py: 0.5, WebkitOverflowScrolling: "touch" }}>
          {filteredUsers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center", color: "#94a3b8" }}>
              <Typography variant="body2">
                {searchQuery ? "No colleagues found" : "No other colleagues in this space"}
              </Typography>
            </Box>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUser?._id === user._id;
              return (
                <React.Fragment key={user._id}>
                  <ListItem disablePadding sx={{ px: 1, py: 0.3 }}>
                    <ListItemButton
                      onClick={() => setSelectedUser(user)}
                      selected={isSelected}
                      sx={{
                        borderRadius: "12px",
                        py: 1,
                        px: 1.2,
                        transition: "all 0.15s ease",
                        "&.Mui-selected": {
                          bgcolor: "#e0f2fe",
                          "&:hover": { bgcolor: "#bae6fd" }
                        },
                        "&:hover": {
                          bgcolor: "#f8fafc"
                        }
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 48 }}>
                        <Avatar
                          src={user.profilePic}
                          sx={{
                            width: 42,
                            height: 42,
                            bgcolor: isSelected ? "#2563eb" : "#3b82f6",
                            fontWeight: "bold",
                            fontSize: "1rem"
                          }}
                        >
                          {user.name?.[0]?.toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            fontWeight={isSelected ? 700 : 600}
                            sx={{ color: isSelected ? "#0369a1" : "#1e293b", fontSize: "0.92rem" }}
                            noWrap
                          >
                            {user.name}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ color: "#64748b", fontSize: "0.78rem" }} noWrap>
                            {user.role === "admin" ? "Admin" : "Colleague"}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider sx={{ mx: 2, opacity: 0.3 }} />
                </React.Fragment>
              );
            })
          )}
        </List>
      </Box>

      {/* 💬 MAIN CHAT AREA */}
      {selectedUser ? (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
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
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onScheduleMessage={handleScheduleMessage}
            onStartCall={(type) => initiateCall(selectedUser, type)}
          />

          <ProfileView
            open={profileOpen}
            onClose={() => setProfileOpen(false)}
            user={selectedUser}
          />
          <CallHandler
            incomingCall={incomingCall}
            setIncomingCall={setIncomingCall}
            calling={calling}
            setCalling={setCalling}
            currentUser={currentUser}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            users={users}
            callType={callType}
            setCallType={setCallType}
          />
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#eef4f9",
            p: 3
          }}
        >
          <Box
            sx={{
              p: 4,
              borderRadius: "24px",
              bgcolor: "#ffffff",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              textAlign: "center",
              maxWidth: 380
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                bgcolor: "#e0f2fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2
              }}
            >
              <ChatIcon sx={{ fontSize: 36, color: "#2563eb" }} />
            </Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: "#0f172a", mb: 1 }}>
              {currentUser?.subscriptionId} Space
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.5 }}>
              Select a colleague from the sidebar to start instant messaging, calls, or sharing media.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}