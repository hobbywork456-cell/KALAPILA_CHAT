import React, { useState } from "react";
import { 
  Box, Paper, TextField, Button, Typography, 
  Link, InputAdornment, IconButton, MenuItem 
} from "@mui/material";
import { toast } from 'sonner';
import { 
  Visibility, 
  VisibilityOff,
  Business as BusinessIcon
} from "@mui/icons-material";
import { API } from "../api";
import { useNavigate } from "react-router-dom";

function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    subscriptionId: "",
    role: "member"
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    if(e) e.preventDefault();
    try {
      if (isLogin) {
        const res = await API.post("/auth/login", { 
          email: form.email, 
          password: form.password 
        });
        if (res.data.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
          setTimeout(() => {
            navigate("/home");
            window.location.reload();
          }, 100);
        }
      } else {
        if (!form.subscriptionId) return alert("Company ID is required");
        const res = await API.post("/auth/register", form);
       toast.success(res.data.message || "Registration Successful!");
        setIsLogin(true); 
      }
    } catch (err) {
     const errorMessage = err.response?.data?.message || "Something went wrong.";
    toast.error(errorMessage);
    }
  };

  return (
    <Box sx={{ 
      height: "100vh", 
      width: "100vw", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      // Light Blue Gradient Background
      background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)",
      overflow: "hidden",
      position: "relative"
    }}>
      {/* Soft Floating Glows */}
      <Box sx={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.6)', filter: 'blur(100px)', top: '-10%', left: '-10%' }} />
      <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(33, 150, 243, 0.2)', filter: 'blur(80px)', bottom: '0%', right: '0%' }} />

      <Paper 
        elevation={0} 
        sx={{ 
          p: 5, 
          width: "90%", 
          maxWidth: 420, 
          textAlign: "center", 
          borderRadius: "32px",
          // --- Frosted Glass Effect ---
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(15px)",
          border: "1px solid rgba(255, 255, 255, 0.8)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.05)",
          zIndex: 2
        }}
      >
        <Typography
          variant="h4"
          sx={{
            mb: 0.5,
            fontWeight: 800,
            color: "#1565c0",
            fontFamily: "'Inter', sans-serif",
            letterSpacing: -1,
          }}
        >
          KALA <span style={{ color: '#42a5f5' }}>PILA</span>
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 4, color: "#546e7a", fontWeight: 500, opacity: 0.8 }}>
          {isLogin ? "Sign in to your workspace" : "Create your team profile"}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {!isLogin && (
            <TextField 
              fullWidth size="small" label="Full Name" name="name" 
              onChange={handleChange} 
              sx={lightGlassInput}
            />
          )}

          <TextField 
            fullWidth size="small" label="Email Address" name="email" 
            type="email" value={form.email} onChange={handleChange} 
            sx={lightGlassInput}
          />

          <TextField
            fullWidth size="small" label="Password" name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={handleChange}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            sx={lightGlassInput}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} size="small">
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {!isLogin && (
            <>
              <TextField
                fullWidth size="small" label="Company Group ID" name="subscriptionId"
                onChange={handleChange}
                sx={lightGlassInput}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><BusinessIcon fontSize="small" color="primary" /></InputAdornment>
                  ),
                }}
              />

              <TextField
                select fullWidth size="small" name="role" label="Role"
                value={form.role} onChange={handleChange}
                sx={{ ...lightGlassInput, textAlign: "left" }}
              >
                <MenuItem value="member">Team Member</MenuItem>
                <MenuItem value="admin">System Admin</MenuItem>
              </TextField>
            </>
          )}

          <Button 
            fullWidth variant="contained" onClick={handleSubmit}
            sx={{ 
              mt: 2, py: 1.6, 
              bgcolor: "#1976d2", 
              borderRadius: "16px",
              fontWeight: "bold",
              textTransform: "none",
              fontSize: "1rem",
              boxShadow: "0 8px 16px rgba(25, 118, 210, 0.2)",
              transition: "all 0.3s ease",
              "&:hover": {
                bgcolor: "#1565c0",
                transform: "translateY(-2px)",
                boxShadow: "0 12px 20px rgba(25, 118, 210, 0.3)",
              }
            }}
          >
            {isLogin ? "Log In" : "Get Started"}
          </Button>
        </Box>

        <Box sx={{ mt: 4, pt: 2, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <Typography variant="body2" color="textSecondary">
            {isLogin ? "New here?" : "Joined already?"}{" "}
            <Link 
              component="button" 
              onClick={() => {
                setIsLogin(!isLogin);
                setForm({ name: "", email: "", password: "", subscriptionId: "", role: "member" });
              }} 
              sx={{ color: "#1976d2", fontWeight: 700, textDecoration: "none" }}
            >
              {isLogin ? "Create an account" : "Sign in instead"}
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

// Styling for the "Crystal" Input look
const lightGlassInput = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    transition: "0.3s",
    "& fieldset": { borderColor: "rgba(0, 0, 0, 0.05)" },
    "&:hover fieldset": { borderColor: "#90caf9" },
    "&.Mui-focused fieldset": { borderColor: "#1976d2", borderWidth: "2px" },
  },
  "& .MuiInputLabel-root": { fontSize: "0.9rem", color: "#78909c" },
};

export default Auth;