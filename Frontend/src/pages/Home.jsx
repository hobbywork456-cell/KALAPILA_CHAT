import React, { useEffect, useState, useRef } from "react";
import {
  Box, List, ListItem, ListItemButton, ListItemAvatar,
  ListItemText, Avatar, TextField, Typography,
  AppBar, Toolbar, Divider, CircularProgress, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tabs, Tab, Chip, Paper
} from "@mui/material";
import {
  Search as SearchIcon, Chat as ChatIcon, Add as AddIcon,
  ContentCopy as ContentCopyIcon, Groups as GroupsIcon,
  MeetingRoom as MeetingRoomIcon, AddCircle as CreateIcon,
  Logout as LogoutIcon, Close as CloseIcon, Check as CheckIcon
} from "@mui/icons-material";
import { API } from "../api";
import { socket } from "../socket";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

  // Space States
  const [spaces, setSpaces] = useState([]);
  const [activeSpace, setActiveSpace] = useState(null);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [spaceModalTab, setSpaceModalTab] = useState(0); // 0 = Join, 1 = Create
  const [joinCode, setJoinCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [isSubmittingSpace, setIsSubmittingSpace] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat & Colleague States
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessageMap, setLastMessageMap] = useState({});
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);

  // Call States
  const [calling, setCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callType, setCallType] = useState("video");

  const bottomRef = useRef(null);
  const timerRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // --- AUTH & IDLE TIMEOUT ---
  const handleLogout = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem("user");
    navigate("/");
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => handleLogout(), 1200000); // 20 mins
  };

  // --- SELECTION & MESSAGE HANDLERS ---
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    if (user?._id) {
      setUnreadCounts((prev) => ({
        ...prev,
        [user._id.toString()]: 0,
      }));
    }
  };

  const handleEditMessage = (messageId, newMessage, setEditingId) => {
    if (!currentUser) return;
    socket.emit("editMessage", {
      messageId,
      newMessage,
      senderId: currentUser._id,
    });
    setEditingId(null);
    setMessage("");
  };

  const handleDeleteMessage = (messageId) => {
    if (!currentUser) return;
    socket.emit("deleteMessage", {
      messageId,
      senderId: currentUser._id,
    });
  };

  const initiateCall = (userToCall, type = "video") => {
    handleSelectUser(userToCall);
    setCallType(type);
    setCalling(true);
  };

  const handleScheduleMessage = (text, time) => {
    if (!currentUser || !selectedUser) return;
    socket.emit("sendMessage", {
      senderId: currentUser._id,
      receiverId: selectedUser._id,
      message: text,
      scheduledTime: time,
    });
  };

  const sendMessage = (fileUrl = null, fileType = "text") => {
    if (!message.trim() && !fileUrl) return;

    const messageText = message;
    socket.emit("sendMessage", {
      senderId: currentUser._id,
      receiverId: selectedUser._id,
      message: messageText,
      fileUrl: fileUrl,
      fileType: fileType,
    });

    if (selectedUser?._id) {
      setLastMessageMap((prev) => ({
        ...prev,
        [selectedUser._id.toString()]: {
          message: fileType !== "text" ? `[${fileType}]` : messageText,
          createdAt: new Date().toISOString(),
          fileType: fileType,
        },
      }));
    }

    setMessage("");
  };

  // --- SPACE ACTIONS ---

  // 1. Fetch all spaces for current user
  const fetchUserSpaces = async (selectSpaceId = null) => {
    if (!currentUser?._id) return;
    try {
      const res = await API.get(`/spaces/user/${currentUser._id}`);
      setSpaces(res.data);
      if (selectSpaceId && res.data.length > 0) {
        const found = res.data.find((s) => s.spaceId === selectSpaceId);
        if (found) setActiveSpace(found);
      }
    } catch (err) {
      console.error("Error loading spaces:", err);
    }
  };

  // 2. Fetch members of the active space
  const fetchSpaceMembers = async (spaceId) => {
    if (!spaceId || !currentUser) return;
    try {
      const res = await API.get(`/spaces/${spaceId}/members`);
      if (res.data && res.data.members) {
        setUsers(res.data.members.filter((u) => u._id !== currentUser._id));
      }
    } catch (err) {
      console.error("Error loading space members:", err);
    }
  };

  // 3. Create Space Handler
  const handleCreateSpace = async (e) => {
    if (e) e.preventDefault();
    if (!createName.trim() || !createCode.trim()) {
      return toast.error("Please enter a Space Name and Room Code.");
    }

    setIsSubmittingSpace(true);
    try {
      const res = await API.post("/spaces/create", {
        name: createName.trim(),
        spaceId: createCode.trim().toUpperCase(),
        userId: currentUser._id,
      });

      toast.success(res.data.message || "Space created successfully!");
      setIsSpaceModalOpen(false);
      setCreateName("");
      setCreateCode("");
      await fetchUserSpaces(res.data.space.spaceId);
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to create space.";
      toast.error(errMsg);
    } finally {
      setIsSubmittingSpace(false);
    }
  };

  // 4. Join Space Handler
  const handleJoinSpace = async (e) => {
    if (e) e.preventDefault();
    if (!joinCode.trim()) {
      return toast.error("Please enter a Room Code to join.");
    }

    setIsSubmittingSpace(true);
    try {
      const res = await API.post("/spaces/join", {
        spaceId: joinCode.trim().toUpperCase(),
        userId: currentUser._id,
      });

      toast.success(res.data.message || "Joined space successfully!");
      setIsSpaceModalOpen(false);
      setJoinCode("");
      await fetchUserSpaces(res.data.space.spaceId);
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to join space.";
      toast.error(errMsg);
    } finally {
      setIsSubmittingSpace(false);
    }
  };

  // 5. Copy Room Code to clipboard
  const handleCopyCode = () => {
    if (!activeSpace?.spaceId) return;
    navigator.clipboard.writeText(activeSpace.spaceId);
    setCopied(true);
    toast.info(`Room Code "${activeSpace.spaceId}" copied! Share it with your team.`, {
      icon: "📋",
      autoClose: 2500,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // 6. Generate Random Room Code helper
  const handleGenerateCode = () => {
    const randomCode = "ROOM-" + Math.floor(10000 + Math.random() * 90000);
    setCreateCode(randomCode);
  };

  // --- EFFECTS ---

  // 🛡️ Guard: Check if user exists on mount
  useEffect(() => {
    if (!currentUser || !currentUser._id) {
      navigate("/");
    }
  }, [currentUser, navigate]);

  // Load User Spaces on Mount
  useEffect(() => {
    fetchUserSpaces();
  }, [currentUser]);

  // When activeSpace changes, fetch members & reset selected chat
  useEffect(() => {
    if (activeSpace?.spaceId) {
      fetchSpaceMembers(activeSpace.spaceId);
      setSelectedUser(null);
    }
  }, [activeSpace]);

  // Socket: Join and Listen for Updates
  useEffect(() => {
    if (!socket || !currentUser?._id) return;

    const joinRoom = () => {
      socket.emit("join", currentUser._id);
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.connect();
    }

    const onConnect = () => {
      joinRoom();
    };

    const onMessageUpdated = (updatedMsg) => {
      setMessages((prev) => prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)));
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

    const onMessageScheduled = (data) => {
      toast.success(data?.message || "Message scheduled successfully!", {
        position: "top-right",
        autoClose: 3500,
        icon: "🕒",
      });
    };

    const onReceiveMessage = (msg) => {
      const senderId = (msg.sender?._id || msg.sender)?.toString();
      const receiverId = (msg.receiver?._id || msg.receiver)?.toString();
      const isFromMe = senderId === currentUser._id.toString();
      const partnerId = isFromMe ? receiverId : senderId;

      if (partnerId) {
        setLastMessageMap((prev) => ({
          ...prev,
          [partnerId]: {
            message: msg.fileType !== "text" ? `[${msg.fileType}]` : msg.message,
            createdAt: msg.createdAt || new Date().toISOString(),
            fileType: msg.fileType,
          },
        }));
      }

      if (!isFromMe) {
        const isCurrentlyOpen =
          selectedUserRef.current && selectedUserRef.current._id.toString() === senderId;

        if (!isCurrentlyOpen) {
          setUnreadCounts((prev) => ({
            ...prev,
            [senderId]: (prev[senderId] || 0) + 1,
          }));
        }

        const senderDisplayName = msg.senderName || "Someone";
        const notificationText = msg.fileType !== "text" ? `Sent a ${msg.fileType}` : msg.message;

        toast.info(`New message from ${senderDisplayName}: ${notificationText}`, {
          position: "top-right",
          autoClose: 3000,
          icon: "💬",
        });
      }

      setMessages((prev) => {
        const exists = prev.find((m) => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
    };

    socket.on("connect", onConnect);
    socket.on("messageUpdated", onMessageUpdated);
    socket.on("messageDeleted", onMessageDeleted);
    socket.on("incoming-call", onIncomingCall);
    socket.on("call-ended", onCallEnded);
    socket.on("receiveMessage", onReceiveMessage);
    socket.on("messageScheduled", onMessageScheduled);

    return () => {
      socket.off("connect", onConnect);
      socket.off("messageUpdated", onMessageUpdated);
      socket.off("messageDeleted", onMessageDeleted);
      socket.off("incoming-call", onIncomingCall);
      socket.off("call-ended", onCallEnded);
      socket.off("receiveMessage", onReceiveMessage);
      socket.off("messageScheduled", onMessageScheduled);
    };
  }, [currentUser]);

  // Fetch Message History when user is selected
  useEffect(() => {
    if (!selectedUser?._id || !currentUser?._id) return;

    const handleMessageHistory = (msgs) => {
      setMessages(Array.isArray(msgs) ? msgs : []);
      if (Array.isArray(msgs) && msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        setLastMessageMap((prev) => ({
          ...prev,
          [selectedUser._id.toString()]: {
            message: last.fileType !== "text" ? `[${last.fileType}]` : last.message,
            createdAt: last.createdAt,
            fileType: last.fileType,
          },
        }));
      }
    };

    socket.on("messageHistory", handleMessageHistory);
    socket.emit("getMessages", { senderId: currentUser._id, receiverId: selectedUser._id });

    return () => {
      socket.off("messageHistory", handleMessageHistory);
    };
  }, [selectedUser, currentUser]);

  // Fetch Recent Conversations
  useEffect(() => {
    if (!currentUser?._id) return;
    API.get(`/message/conversations/${currentUser._id}`)
      .then((res) => {
        if (res.data) setLastMessageMap(res.data);
      })
      .catch((err) => console.error("Error loading conversations:", err));
  }, [currentUser]);

  // Auto-scroll and Idle Timer
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      <Box sx={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // 🔴 Calculate unread message count for an entire Space/Group
  const getSpaceUnreadCount = (space) => {
    if (!space || !space.members || !Array.isArray(space.members)) return 0;
    let count = 0;
    space.members.forEach((m) => {
      const memberId = (m.user?._id || m.user || m._id || m)?.toString();
      if (memberId && memberId !== currentUser._id?.toString()) {
        count += unreadCounts[memberId] || 0;
      }
    });
    return count;
  };

  const formatLastMessageTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // 🚀 Sort colleagues so latest active conversation appears at the top
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const timeA = lastMessageMap[a._id?.toString()]?.createdAt
      ? new Date(lastMessageMap[a._id.toString()].createdAt).getTime()
      : 0;
    const timeB = lastMessageMap[b._id?.toString()]?.createdAt
      ? new Date(lastMessageMap[b._id.toString()].createdAt).getTime()
      : 0;
    return timeB - timeA;
  });

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
        bottom: 0,
      }}
    >
      <ToastContainer position="bottom-right" autoClose={3000} />

      {/* ======================================================== */}
      {/* 🚀 1. LEFT SPACE RAIL / SWITCHER (Discord / Slack style) */}
      {/* ======================================================== */}
      <Box
        sx={{
          width: { xs: selectedUser ? 0 : "68px", sm: "72px" },
          display: { xs: selectedUser ? "none" : "flex", sm: "flex" },
          flexDirection: "column",
          alignItems: "center",
          py: 2,
          bgcolor: "#0f172a",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        {/* App Brand Icon */}
        <Tooltip title="Kalapila" placement="right">
          <Avatar
            src="/favicon.svg"
            alt="Kalapila"
            sx={{
              width: 44,
              height: 44,
              bgcolor: "transparent",
              mb: 2,
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
              cursor: "pointer",
              transition: "transform 0.2s ease",
              "&:hover": { transform: "scale(1.08)" },
            }}
          />
        </Tooltip>

        <Divider sx={{ width: "60%", borderColor: "rgba(255, 255, 255, 0.15)", mb: 2 }} />

        {/* Scrollable Spaces List */}
        <Box
          sx={{
            flex: 1,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.8,
            overflowY: "auto",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {spaces.map((sp) => {
            const isActive = activeSpace?.spaceId === sp.spaceId;
            const spaceUnread = getSpaceUnreadCount(sp);
            const initials = sp.name
              ? sp.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : "SP";

            return (
              <Tooltip key={sp._id} title={`${sp.name} (${sp.spaceId})`} placement="right">
                <Box sx={{ position: "relative", display: "flex", alignItems: "center" }}>
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <Box
                      sx={{
                        position: "absolute",
                        left: -12,
                        width: "4px",
                        height: "28px",
                        bgcolor: "#38bdf8",
                        borderRadius: "0 4px 4px 0",
                      }}
                    />
                  )}
                  <Avatar
                    onClick={() => setActiveSpace(sp)}
                    sx={{
                      width: 46,
                      height: 46,
                      bgcolor: isActive ? "#2563eb" : "#334155",
                      color: "#ffffff",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      borderRadius: isActive ? "16px" : "50%",
                      border: isActive ? "2px solid #38bdf8" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        bgcolor: "#2563eb",
                        borderRadius: "16px",
                        transform: "scale(1.08)",
                      },
                    }}
                  >
                    {initials}
                  </Avatar>

                  {/* 🔴 Space / Group Unread Count Notification Badge */}
                  {spaceUnread > 0 && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        bgcolor: "#ef4444",
                        color: "#ffffff",
                        borderRadius: "10px",
                        minWidth: "20px",
                        height: "20px",
                        px: "5px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        boxShadow: "0 2px 8px rgba(239, 68, 68, 0.6)",
                        border: "2px solid #0f172a",
                        zIndex: 5,
                        pointerEvents: "none",
                      }}
                    >
                      {spaceUnread > 99 ? "99+" : spaceUnread}
                    </Box>
                  )}
                </Box>
              </Tooltip>
            );
          })}

          {/* 🌟 ROUND PLUS (+) BUTTON TO JOIN / CREATE SPACE */}
          <Tooltip title="Create or Join a Space / Room" placement="right">
            <IconButton
              onClick={() => {
                setSpaceModalTab(0);
                setIsSpaceModalOpen(true);
              }}
              sx={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                bgcolor: "#22c55e",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(34, 197, 94, 0.35)",
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: "#16a34a",
                  transform: "scale(1.1)",
                },
              }}
            >
              <AddIcon sx={{ fontSize: 26 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider sx={{ width: "60%", borderColor: "rgba(255, 255, 255, 0.15)", my: 1.5 }} />

        {/* User Avatar & Logout */}
        <Tooltip title="My Profile" placement="right">
          <Avatar
            onClick={() => setIsMyProfileOpen(true)}
            src={currentUser?.profilePic || ""}
            sx={{
              width: 40,
              height: 40,
              bgcolor: "#1e293b",
              border: "2px solid rgba(255, 255, 255, 0.2)",
              cursor: "pointer",
              mb: 1.5,
              transition: "transform 0.2s",
              "&:hover": { transform: "scale(1.08)" },
            }}
          >
            {currentUser?.name?.[0]?.toUpperCase()}
          </Avatar>
        </Tooltip>

        <Tooltip title="Logout" placement="right">
          <IconButton
            size="small"
            onClick={handleLogout}
            sx={{
              color: "#94a3b8",
              "&:hover": { color: "#ef4444", bgcolor: "rgba(239, 68, 68, 0.15)" },
            }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ======================================================== */}
      {/* 📱 2. SIDEBAR (COLLEAGUE CHAT LIST IN ACTIVE SPACE) */}
      {/* ======================================================== */}
      <Box
        sx={{
          width: { xs: selectedUser ? "0%" : "100%", md: "340px", lg: "370px" },
          display: { xs: selectedUser ? "none" : "flex", md: "flex" },
          flexDirection: "column",
          bgcolor: "#ffffff",
          borderRight: "1px solid rgba(0, 0, 0, 0.08)",
          height: "100%",
          zIndex: 5,
        }}
      >
        {/* Space Header */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: "#ffffff",
            color: "#0f172a",
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 58, sm: 64 }, px: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              {activeSpace ? (
                <>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: "#0f172a", lineHeight: 1.2 }} noWrap>
                    {activeSpace.name}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 0.3 }}>
                    <Chip
                      size="small"
                      label={`Code: ${activeSpace.spaceId}`}
                      sx={{
                        height: 20,
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        bgcolor: "#e0f2fe",
                        color: "#0284c7",
                        borderRadius: "6px",
                      }}
                    />
                    <Tooltip title="Copy Room Code to invite team">
                      <IconButton size="small" onClick={handleCopyCode} sx={{ p: 0.3, color: copied ? "#16a34a" : "#64748b" }}>
                        {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </>
              ) : (
                <>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: "#1565c0", lineHeight: 1.2, letterSpacing: -0.5 }} noWrap>
                    KALA <span style={{ color: "#42a5f5" }}>PILA</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500, display: "block" }} noWrap>
                    Real-time team workspaces & messaging
                  </Typography>
                </>
              )}
            </Box>

            {/* Quick Add Button in header */}
            <Tooltip title="Join or Create Space">
              <IconButton
                size="small"
                onClick={() => setIsSpaceModalOpen(true)}
                sx={{
                  bgcolor: "#f1f5f9",
                  color: "#2563eb",
                  "&:hover": { bgcolor: "#e0f2fe" },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
              startAdornment: <SearchIcon sx={{ color: "#94a3b8", mr: 1, fontSize: 20 }} />,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "20px",
                bgcolor: "#f1f5f9",
                fontSize: "0.9rem",
                "& fieldset": { borderColor: "transparent" },
                "&:hover fieldset": { borderColor: "#cbd5e1" },
                "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
              },
            }}
          />
          <Profile open={isMyProfileOpen} onClose={() => setIsMyProfileOpen(false)} currentUser={currentUser} />
        </Box>

        {/* Colleague Chat List */}
        <List sx={{ flex: 1, overflowY: "auto", py: 0.5, WebkitOverflowScrolling: "touch" }}>
          {!activeSpace ? (
            <Box sx={{ p: 4, textAlign: "center", color: "#94a3b8" }}>
              <GroupsIcon sx={{ fontSize: 44, color: "#cbd5e1", mb: 1 }} />
              <Typography variant="body2" fontWeight={700} sx={{ color: "#334155" }}>
                Select a Space
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", display: "block", mt: 0.5 }}>
                Choose a space from the left rail to view team members, or click (+) to create or join a room.
              </Typography>
              <Box sx={{ mt: 2.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setIsSpaceModalOpen(true)}
                  sx={{ borderRadius: "12px", textTransform: "none", bgcolor: "#2563eb", fontWeight: 700 }}
                >
                  Join / Create Space
                </Button>
              </Box>
            </Box>
          ) : sortedUsers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center", color: "#94a3b8" }}>
              <Typography variant="body2" fontWeight={600} sx={{ color: "#64748b" }}>
                {searchQuery ? "No colleagues found" : "No other members in this room"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#94a3b8", mt: 0.5, display: "block" }}>
                Share Room Code <strong>{activeSpace.spaceId}</strong> with your team to invite them!
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopyCode}
                sx={{ mt: 2, borderRadius: "12px", textTransform: "none" }}
              >
                Copy Room Code
              </Button>
            </Box>
          ) : (
            sortedUsers.map((user) => {
              const isSelected = selectedUser?._id === user._id;
              const unread = unreadCounts[user._id?.toString()] || 0;
              const lastMsg = lastMessageMap[user._id?.toString()];

              return (
                <React.Fragment key={user._id}>
                  <ListItem disablePadding sx={{ px: 1, py: 0.3 }}>
                    <ListItemButton
                      onClick={() => handleSelectUser(user)}
                      selected={isSelected}
                      sx={{
                        borderRadius: "12px",
                        py: 1,
                        px: 1.2,
                        transition: "all 0.15s ease",
                        "&.Mui-selected": {
                          bgcolor: "#e0f2fe",
                          "&:hover": { bgcolor: "#bae6fd" },
                        },
                        "&:hover": {
                          bgcolor: "#f8fafc",
                        },
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
                            fontSize: "1rem",
                          }}
                        >
                          {user.name?.[0]?.toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        sx={{ my: 0 }}
                        primary={
                          <Typography
                            variant="body2"
                            fontWeight={isSelected ? 700 : unread > 0 ? 700 : 600}
                            sx={{ color: isSelected ? "#0369a1" : "#1e293b", fontSize: "0.92rem" }}
                            noWrap
                          >
                            {user.name}
                          </Typography>
                        }
                        secondary={
                          <Typography
                            variant="caption"
                            sx={{
                              color: unread > 0 ? "#0f172a" : "#64748b",
                              fontWeight: unread > 0 ? 600 : 400,
                              fontSize: "0.78rem",
                              display: "block",
                            }}
                            noWrap
                          >
                            {lastMsg?.message || (user.role === "admin" ? "Room Admin" : "Team Member")}
                          </Typography>
                        }
                      />
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.4, ml: 1 }}>
                        {lastMsg?.createdAt && (
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: "0.68rem",
                              color: unread > 0 ? "#2563eb" : "#94a3b8",
                              fontWeight: unread > 0 ? 700 : 500,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatLastMessageTime(lastMsg.createdAt)}
                          </Typography>
                        )}
                        {unread > 0 && (
                          <Box
                            sx={{
                              bgcolor: "#2563eb",
                              color: "#ffffff",
                              borderRadius: "12px",
                              minWidth: "20px",
                              height: "20px",
                              px: "6px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.4)",
                            }}
                          >
                            {unread > 99 ? "99+" : unread}
                          </Box>
                        )}
                      </Box>
                    </ListItemButton>
                  </ListItem>
                  <Divider sx={{ mx: 2, opacity: 0.3 }} />
                </React.Fragment>
              );
            })
          )}
        </List>
      </Box>

      {/* ======================================================== */}
      {/* 💬 3. MAIN CHAT AREA */}
      {/* ======================================================== */}
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

          <ProfileView open={profileOpen} onClose={() => setProfileOpen(false)} user={selectedUser} />
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
            p: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: "28px",
              bgcolor: "#ffffff",
              boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
              textAlign: "center",
              maxWidth: 420,
              border: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            <Box
              sx={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                bgcolor: "#e0f2fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2.5,
              }}
            >
              <ChatIcon sx={{ fontSize: 38, color: "#2563eb" }} />
            </Box>
            {activeSpace ? (
              <>
                <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a", mb: 1 }}>
                  {activeSpace.name}
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.6, mb: 3 }}>
                  You are currently in <strong>{activeSpace.name}</strong>. Select a team member from the sidebar to chat, share media, or start a voice/video call.
                </Typography>
                <Chip
                  icon={<ContentCopyIcon sx={{ fontSize: "14px !important" }} />}
                  label={`Invite Code: ${activeSpace.spaceId}`}
                  onClick={handleCopyCode}
                  sx={{
                    bgcolor: "#f1f5f9",
                    color: "#0f172a",
                    fontWeight: 700,
                    cursor: "pointer",
                    py: 2,
                    px: 1,
                    borderRadius: "12px",
                    "&:hover": { bgcolor: "#e2e8f0" },
                  }}
                />
              </>
            ) : (
              <>
                <Typography variant="h4" fontWeight={800} sx={{ color: "#1565c0", mb: 1, letterSpacing: -0.5 }}>
                  KALA <span style={{ color: "#42a5f5" }}>PILA</span>
                </Typography>
                <Typography variant="body2" sx={{ color: "#64748b", lineHeight: 1.6, mb: 3 }}>
                  Real-time team workspaces, messaging, and HD calling. Select a Space on the left rail to view your team or click below to get started.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => setIsSpaceModalOpen(true)}
                  sx={{
                    py: 1.4,
                    px: 3,
                    borderRadius: "16px",
                    bgcolor: "#2563eb",
                    fontWeight: 700,
                    textTransform: "none",
                  }}
                >
                  Join or Create Space
                </Button>
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* ======================================================== */}
      {/* 🚀 4. CREATE / JOIN SPACE MODAL */}
      {/* ======================================================== */}
      <Dialog
        open={isSpaceModalOpen}
        onClose={() => !isSubmittingSpace && setIsSpaceModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "24px",
            p: 1,
            bgcolor: "#ffffff",
            boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight={800} color="#0f172a">
            Spaces & Rooms
          </Typography>
          <IconButton size="small" onClick={() => setIsSpaceModalOpen(false)} disabled={isSubmittingSpace}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
          <Tabs
            value={spaceModalTab}
            onChange={(e, val) => setSpaceModalTab(val)}
            variant="fullWidth"
            sx={{
              "& .MuiTab-root": { textTransform: "none", fontWeight: 700, fontSize: "0.92rem" },
            }}
          >
            <Tab icon={<MeetingRoomIcon fontSize="small" />} iconPosition="start" label="Join Room" />
            <Tab icon={<CreateIcon fontSize="small" />} iconPosition="start" label="Create Room" />
          </Tabs>
        </Box>

        <DialogContent sx={{ pt: 3 }}>
          {spaceModalTab === 0 ? (
            /* TAB 0: JOIN ROOM */
            <Box component="form" onSubmit={handleJoinSpace} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body2" color="#64748b">
                Enter the <strong>Room Code</strong> provided by your team admin or colleague to join their space.
              </Typography>
              <TextField
                fullWidth
                label="Room Code"
                placeholder="e.g. ALPHA101 or ROOM-99"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                autoFocus
                required
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: "14px" },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmittingSpace || !joinCode.trim()}
                sx={{
                  mt: 1,
                  py: 1.4,
                  borderRadius: "14px",
                  bgcolor: "#2563eb",
                  fontWeight: 700,
                  textTransform: "none",
                  fontSize: "0.95rem",
                }}
              >
                {isSubmittingSpace ? <CircularProgress size={22} color="inherit" /> : "Join Space"}
              </Button>
            </Box>
          ) : (
            /* TAB 1: CREATE ROOM */
            <Box component="form" onSubmit={handleCreateSpace} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body2" color="#64748b">
                Create a dedicated Space for your team. You will be the administrator of this room.
              </Typography>
              <TextField
                fullWidth
                label="Space / Team Name"
                placeholder="e.g. Engineering Team, Marketing Hub"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
                required
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: "14px" },
                }}
              />
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  fullWidth
                  label="Room Code"
                  placeholder="e.g. ENG101"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  required
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: "14px" },
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={handleGenerateCode}
                  sx={{ borderRadius: "14px", whiteSpace: "nowrap", textTransform: "none", px: 1.5, fontSize: "0.8rem" }}
                >
                  Generate
                </Button>
              </Box>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmittingSpace || !createName.trim() || !createCode.trim()}
                sx={{
                  mt: 1,
                  py: 1.4,
                  borderRadius: "14px",
                  bgcolor: "#22c55e",
                  fontWeight: 700,
                  textTransform: "none",
                  fontSize: "0.95rem",
                  "&:hover": { bgcolor: "#16a34a" },
                }}
              >
                {isSubmittingSpace ? <CircularProgress size={22} color="inherit" /> : "Create Space"}
              </Button>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}