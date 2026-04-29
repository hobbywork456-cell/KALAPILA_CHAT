import React from "react";
import { 
  Drawer, Box, Avatar, Typography, 
  IconButton, Divider 
} from "@mui/material";
import { 
  Close as CloseIcon, 
  InfoOutlined as InfoIcon, 
  EmailOutlined as EmailIcon,
  BusinessOutlined as BusinessIcon,
  BadgeOutlined as BadgeIcon
} from "@mui/icons-material";

export default function ProfileView({ open, onClose, user }) {
  if (!user) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ 
        sx: { 
          width: { xs: "100%", sm: "380px" }, 
          borderLeft: "1px solid #bbdefb",
          boxShadow: "-4px 0 15px rgba(0,0,0,0.05)"
        } 
      }}
    >
      <Box sx={{ height: "100%", bgcolor: "#f0f7ff" }}>
        {/* --- HEADER --- */}
        <Box sx={{ 
          bgcolor: "#ffffff", 
          p: 2, 
          display: "flex", 
          alignItems: "center", 
          gap: 2,
          borderBottom: "1px solid #e3f2fd" 
        }}>
          <IconButton onClick={onClose} sx={{ color: "#1976d2" }}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" fontWeight="600" color="#1a237e">Profile Info</Typography>
        </Box>

        {/* --- MAIN PROFILE CARD --- */}
        <Box sx={{ 
          bgcolor: "#fff", 
          p: 4, 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          mb: 1.5,
          borderBottom: "1px solid #e3f2fd"
        }}>
          <Avatar sx={{ 
            width: 140, 
            height: 140, 
            mb: 2, 
            bgcolor: "#1976d2", 
            fontSize: "3.5rem",
            boxShadow: "0 8px 16px rgba(25, 118, 210, 0.2)"
          }}>
            {user.name[0].toUpperCase()}
          </Avatar>
          <Typography variant="h5" fontWeight="bold" color="#1a237e">{user.name}</Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
            <BadgeIcon sx={{ fontSize: 16, color: "#64b5f6" }} />
            <Typography variant="body2" color="textSecondary" sx={{ textTransform: 'capitalize' }}>
              {user.role || "Member"}
            </Typography>
          </Box>
        </Box>

        {/* --- DETAILS SECTIONS --- */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1 }}>
          
          {/* Subscription / Company ID Section */}
          <Box sx={{ bgcolor: "#fff", p: 2.5, borderRadius: 2, mx: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: "bold", color: "#1976d2", letterSpacing: 1 }}>
              COMPANY NETWORK
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", mt: 1.5, gap: 2 }}>
              <BusinessIcon sx={{ color: "#90caf9" }} />
              <Typography variant="body1" sx={{ color: "#1a237e", fontWeight: 500 }}>
                {user.subscriptionId || "Private Group"}
              </Typography>
            </Box>
          </Box>

          {/* About Section */}
          <Box sx={{ bgcolor: "#fff", p: 2.5, borderRadius: 2, mx: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: "bold", color: "#1976d2", letterSpacing: 1 }}>
              BIO
            </Typography>
            <Box sx={{ display: "flex", alignItems: "flex-start", mt: 1.5, gap: 2 }}>
              <InfoIcon sx={{ color: "#90caf9", mt: 0.3 }} />
              <Typography variant="body1" sx={{ color: "#37474f", lineHeight: 1.5 }}>
                {user.bio || "Hey there! I am using ChatApp."}
              </Typography>
            </Box>
          </Box>

          {/* Email Section */}
          <Box sx={{ bgcolor: "#fff", p: 2.5, borderRadius: 2, mx: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: "bold", color: "#1976d2", letterSpacing: 1 }}>
              EMAIL ADDRESS
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", mt: 1.5, gap: 2 }}>
              <EmailIcon sx={{ color: "#90caf9" }} />
              <Typography variant="body1" sx={{ color: "#37474f" }}>
                {user.email}
              </Typography>
            </Box>
          </Box>

        </Box>
      </Box>
    </Drawer>
  );
}