import React, { useState, useEffect } from "react";
import {
  Drawer, Box, Typography, IconButton, Avatar,
  TextField, Button, Divider, Paper
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  PhotoCamera as PhotoCameraIcon,
  Logout as LogoutIcon,
  Check as SaveIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { API } from "../api";

export default function Profile({ open, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [profileData, setProfileData] = useState({
    name: "",
    bio: "",
    profilePic: ""
  });

  // ✅ FIX 1: Move storedUser inside useEffect (avoid stale data)
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));

    if (storedUser) {
      setProfileData({
        name: storedUser.name || "",
        bio: storedUser.bio || "Hey there! I am using ChatApp.",
        profilePic: storedUser.profilePic || ""
      });
    }
  }, [open]);

  // ✅ Image handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (file && file.size > 5 * 1024 * 1024) {
      alert("File must be under 5MB");
      return;
    }

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData((prev) => ({
          ...prev,
          profilePic: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
    window.location.reload();
  };

  const handleUpdate = async () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));

    if (!storedUser?._id) return;

    setLoading(true);
    try {
      const res = await API.put(`/auth/update/${storedUser._id}`, profileData);

      localStorage.setItem("user", JSON.stringify(res.data));

      alert("Profile updated successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={() => {
        document.activeElement?.blur(); // ✅ FIX 2: prevent aria-hidden warning
        onClose();
      }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: "400px" },
          bgcolor: "#f0f2f5"
        }
      }}
      ModalProps={{
        keepMounted: true // ✅ FIX 3: prevents focus/aria issues
      }}
    >
      {/* Header */}
      <Box sx={{ bgcolor: "#1976d2", color: "#fff", p: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton onClick={onClose} sx={{ color: "#fff" }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">Profile</Typography>
      </Box>

      {/* Profile Picture */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, bgcolor: "#fff" }}>
        <Box sx={{ position: "relative" }}>
          <Avatar
            src={profileData.profilePic}
            sx={{ width: 150, height: 150, bgcolor: "#1976d2", fontSize: "3rem" }}
          >
            {profileData.name?.[0]?.toUpperCase()}
          </Avatar>

          <IconButton
            sx={{
              position: "absolute",
              bottom: 10,
              right: 10,
              bgcolor: "#1976d2",
              color: "#fff",
              "&:hover": { bgcolor: "#1565c0" }
            }}
            component="label"
          >
            <PhotoCameraIcon />
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
          </IconButton>
        </Box>
      </Box>

      {/* Details */}
      <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="primary" fontWeight="bold">
            Your Name
          </Typography>
          <TextField
            fullWidth
            variant="standard"
            value={profileData.name}
            onChange={(e) =>
              setProfileData({ ...profileData, name: e.target.value })
            }
          />
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="primary" fontWeight="bold">
            About
          </Typography>
          <TextField
            fullWidth
            multiline
            variant="standard"
            value={profileData.bio}
            onChange={(e) =>
              setProfileData({ ...profileData, bio: e.target.value })
            }
          />
        </Paper>

        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleUpdate}
          disabled={loading}
          sx={{ py: 1.2, borderRadius: 2 }}
        >
          {loading ? "Saving..." : "Save Changes"}
        </Button>

        <Divider />

        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ py: 1.2, borderRadius: 2 }}
        >
          Logout
        </Button>
      </Box>
    </Drawer>
  );
}