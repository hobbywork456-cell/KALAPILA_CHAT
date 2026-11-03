import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Chip,
  Paper,
  InputAdornment,
} from "@mui/material";
import {
  Search as SearchIcon,
  Phone as PhoneIcon,
  Videocam as VideocamIcon,
  Close as CloseIcon,
  Email as EmailIcon,
} from "@mui/icons-material";
import { API } from "../api";

export default function EmailCallModal({
  open,
  onClose,
  onStartCall,
  currentUser,
  colleagues = [],
}) {
  const [emailInput, setEmailInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchedUser, setSearchedUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setEmailInput("");
      setSearchedUser(null);
      setSearchResults([]);
      setErrorMsg("");
    }
  }, [open]);

  // Live search when typing email or name
  useEffect(() => {
    if (!emailInput.trim() || emailInput.trim().length < 2) {
      setSearchResults([]);
      setSearchedUser(null);
      setErrorMsg("");
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setErrorMsg("");
      try {
        const query = emailInput.trim();
        const res = await API.get(`/auth/search-users?query=${encodeURIComponent(query)}`);
        const found = (res.data || []).filter(
          (u) => u._id !== currentUser?._id && u.email !== currentUser?.email
        );
        setSearchResults(found);

        // Check if there's an exact email match
        const exactMatch = found.find(
          (u) => u.email?.toLowerCase() === query.toLowerCase()
        );
        if (exactMatch) {
          setSearchedUser(exactMatch);
        } else if (found.length === 1) {
          setSearchedUser(found[0]);
        } else {
          setSearchedUser(null);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [emailInput, currentUser]);

  const handleManualSearch = async () => {
    if (!emailInput.trim()) return;
    setSearching(true);
    setErrorMsg("");
    try {
      const res = await API.get(`/auth/search-by-email?email=${encodeURIComponent(emailInput.trim())}`);
      if (res.data) {
        if (res.data._id === currentUser?._id) {
          setErrorMsg("You cannot call your own email address.");
          setSearchedUser(null);
        } else {
          setSearchedUser(res.data);
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "No user found with this email address.");
      setSearchedUser(null);
    } finally {
      setSearching(false);
    }
  };

  const handleCall = (targetUser, type = "video") => {
    onClose();
    onStartCall(targetUser, type);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "24px",
          background: "linear-gradient(145deg, #ffffff 0%, #f0f7ff 100%)",
          boxShadow: "0 20px 40px rgba(25, 118, 210, 0.15)",
          border: "1px solid #bbdefb",
          overflow: "hidden",
        },
      }}
    >
      {/* Dialog Header */}
      <DialogTitle
        sx={{
          bgcolor: "#1976d2",
          color: "#fff",
          p: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 36, height: 36 }}>
            <PhoneIcon fontSize="small" sx={{ color: "#fff" }} />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="700" sx={{ lineHeight: 1.2 }}>
              Call by Email ID
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Connect with any Kalapila user
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "#fff" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 3 }}>
        {/* Email Input */}
        <Box sx={{ mt: 1, mb: 2.5 }}>
          <Typography variant="caption" fontWeight="600" color="#1565c0" sx={{ mb: 0.8, display: "block" }}>
            ENTER RECIPIENT'S EMAIL ADDRESS
          </Typography>
          <TextField
            fullWidth
            autoFocus
            size="small"
            placeholder="e.g. colleague@kalapila.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon fontSize="small" sx={{ color: "#1976d2" }} />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <InputAdornment position="end">
                  <CircularProgress size={18} color="primary" />
                </InputAdornment>
              ) : null,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "14px",
                bgcolor: "#ffffff",
                fontSize: "0.9rem",
                "& fieldset": { borderColor: "#bbdefb" },
                "&:hover fieldset": { borderColor: "#1976d2" },
                "&.Mui-focused fieldset": { borderColor: "#1976d2", borderWidth: "2px" },
              },
            }}
          />
        </Box>

        {/* Error Feedback */}
        {errorMsg && (
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: "12px",
              bgcolor: "#ffebee",
              border: "1px solid #ffcdd2",
              textAlign: "center",
            }}
          >
            <Typography variant="caption" color="error" fontWeight="600">
              {errorMsg}
            </Typography>
          </Paper>
        )}

        {/* Exact or Selected User Match Card */}
        {searchedUser && (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 2,
              borderRadius: "18px",
              bgcolor: "#ffffff",
              border: "2px solid #90caf9",
              boxShadow: "0 6px 16px rgba(25, 118, 210, 0.08)",
              textAlign: "center",
            }}
          >
            <Box sx={{ position: "relative", display: "inline-block", mb: 1.5 }}>
              <Avatar
                src={searchedUser.profilePic || ""}
                sx={{
                  width: 64,
                  height: 64,
                  mx: "auto",
                  bgcolor: "#1976d2",
                  fontSize: "1.6rem",
                  fontWeight: "bold",
                  border: "2px solid #bbdefb",
                }}
              >
                {searchedUser.name?.[0]?.toUpperCase()}
              </Avatar>
            </Box>

            <Typography variant="subtitle1" fontWeight="700" color="#1a237e">
              {searchedUser.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ fontSize: "0.82rem", mb: 1 }}>
              {searchedUser.email}
            </Typography>

            <Chip
              label={searchedUser.subscriptionId ? `Space: ${searchedUser.subscriptionId}` : "Kalapila User"}
              size="small"
              sx={{ bgcolor: "#e3f2fd", color: "#1565c0", fontWeight: "600", fontSize: "0.72rem", mb: 2 }}
            />

            <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center" }}>
              <Button
                variant="contained"
                startIcon={<PhoneIcon />}
                onClick={() => handleCall(searchedUser, "audio")}
                sx={{
                  flex: 1,
                  py: 1,
                  borderRadius: "12px",
                  bgcolor: "#1976d2",
                  textTransform: "none",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  boxShadow: "0 4px 10px rgba(25, 118, 210, 0.25)",
                  "&:hover": { bgcolor: "#1565c0" },
                }}
              >
                Voice Call
              </Button>
              <Button
                variant="contained"
                startIcon={<VideocamIcon />}
                onClick={() => handleCall(searchedUser, "video")}
                sx={{
                  flex: 1,
                  py: 1,
                  borderRadius: "12px",
                  bgcolor: "#0288d1",
                  textTransform: "none",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  boxShadow: "0 4px 10px rgba(2, 136, 209, 0.25)",
                  "&:hover": { bgcolor: "#0277bd" },
                }}
              >
                Video Call
              </Button>
            </Box>
          </Paper>
        )}

        {/* Live Search Suggestions (if multiple matches) */}
        {!searchedUser && searchResults.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" fontWeight="bold" color="#546e7a" sx={{ px: 0.5, mb: 1, display: "block" }}>
              MATCHING USERS ({searchResults.length})
            </Typography>
            <List disablePadding sx={{ maxHeight: 180, overflowY: "auto" }}>
              {searchResults.map((u) => (
                <ListItem
                  key={u._id}
                  disablePadding
                  sx={{
                    mb: 1,
                    bgcolor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e3f2fd",
                    p: 0.5,
                  }}
                  secondaryAction={
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleCall(u, "audio")}
                        title="Voice Call"
                      >
                        <PhoneIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleCall(u, "video")}
                        title="Video Call"
                      >
                        <VideocamIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      src={u.profilePic || ""}
                      sx={{ width: 34, height: 34, bgcolor: "#90caf9", fontSize: "0.85rem" }}
                    >
                      {u.name?.[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight="600" color="#1a237e">{u.name}</Typography>}
                    secondary={<Typography variant="caption" color="textSecondary">{u.email}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Quick Colleagues Section */}
        {!searchedUser && searchResults.length === 0 && colleagues.length > 0 && (
          <Box>
            <Typography variant="caption" fontWeight="bold" color="#546e7a" sx={{ px: 0.5, mb: 1, display: "block" }}>
              QUICK DIAL COLLEAGUES
            </Typography>
            <List disablePadding sx={{ maxHeight: 200, overflowY: "auto" }}>
              {colleagues.slice(0, 5).map((colleague) => (
                <ListItem
                  key={colleague._id}
                  disablePadding
                  sx={{
                    mb: 1,
                    bgcolor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e3f2fd",
                    p: 0.5,
                    "&:hover": { bgcolor: "#e3f2fd" },
                    transition: "0.2s",
                  }}
                  secondaryAction={
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleCall(colleague, "audio")}
                        title="Voice Call"
                      >
                        <PhoneIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleCall(colleague, "video")}
                        title="Video Call"
                      >
                        <VideocamIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar
                      src={colleague.profilePic || ""}
                      sx={{ width: 34, height: 34, bgcolor: "#64b5f6", fontSize: "0.85rem" }}
                    >
                      {colleague.name?.[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight="600" color="#1a237e">{colleague.name}</Typography>}
                    secondary={<Typography variant="caption" color="textSecondary">{colleague.email || "Colleague"}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
