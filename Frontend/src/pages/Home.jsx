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
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState([]);
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

  return (
    <Box sx={{ display: "flex", height: "100vh", width: "100vw", bgcolor: "#e3f2fd", overflow: "hidden", position: "fixed" }}>
      <ToastContainer position="bottom-right" autoClose={3000} />
      {/* SIDEBAR */}
      <Box sx={{
        width: { xs: selectedUser ? "0%" : "100%", md: "320px" },
        display: { xs: selectedUser ? "none" : "flex", md: "flex" },
        flexDirection: "column", bgcolor: "#ffffff", borderRight: "1px solid #bbdefb"
      }}>
        <AppBar position="static" sx={{ bgcolor: "#bbdefb", color: "#0d47a1", boxShadow: "none" }}>
          <Toolbar variant="dense">
            <Avatar
              onClick={() => setIsMyProfileOpen(true)}
              sx={{ width: 32, height: 32, bgcolor: "#1be122", mr: 1.5, cursor: 'pointer' }}
              src={currentUser?.profilePic || ""}
            >
              {currentUser?.name?.[0].toUpperCase()}
            </Avatar>
            <Typography variant="subtitle1" fontWeight="bold">Chats</Typography>
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
          <Profile open={isMyProfileOpen} onClose={() => setIsMyProfileOpen(false)} currentUser={currentUser} />
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
                    <Avatar src={user.profilePic} sx={{ bgcolor: "#64b5f6" }}>{user.name[0].toUpperCase()}</Avatar>
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
        </>
      ) : (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f0f7ff" }}>
          <Box sx={{ opacity: 0.4, textAlign: "center" }}>
            <ChatIcon sx={{ fontSize: 80, color: "#90caf9", mb: 2 }} />
            <Typography variant="h6" color="#1976d2">Welcome to {currentUser?.subscriptionId} Space</Typography>
            <Typography variant="body2" color="textSecondary">Select a colleague to start a chat</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}