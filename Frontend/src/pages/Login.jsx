import React, { useState } from "react";
import { 
  Box, Paper, TextField, Button, Typography, 
  Link, InputAdornment, IconButton, MenuItem 
} from "@mui/material";
import { 
  Visibility, 
  VisibilityOff,
  Business as BusinessIcon
} from "@mui/icons-material";
import { API } from "../api";
import { useNavigate } from "react-router-dom";

export default function Auth() {
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
    // Prevent default form behavior if this was inside a <form> tag
    if(e) e.preventDefault();

    try {
      if (isLogin) {
        console.log("Attempting Login with:", form.email);
        
        const res = await API.post("/auth/login", { 
          email: form.email, 
          password: form.password 
        });

        console.log("Login Server Response:", res.data);

        if (res.data.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
          // Use a small timeout to ensure localStorage is set before navigation
          setTimeout(() => {
            navigate("/home");
            window.location.reload(); // Force refresh to update Home state
          }, 100);
        }
      } else {
        if (!form.subscriptionId) return alert("Company ID is required");
        
        const res = await API.post("/auth/register", form);
        alert(res.data.message || "Registration Successful!");
        setIsLogin(true); 
      }
    } catch (err) {
      console.error("Auth Error:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <Box sx={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f0f7ff" }}>
      <Paper elevation={6} sx={{ p: 4, width: "100%", maxWidth: 380, textAlign: "center", borderRadius: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: "bold", color: "#1976d2" }}>ChatApp</Typography>
        <Typography variant="body2" sx={{ mb: 3, color: "#64b5f6" }}>
          {isLogin ? "Welcome back!" : "Join your company network"}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {!isLogin && (
            <TextField fullWidth size="small" label="Full Name" name="name" onChange={handleChange} />
          )}

          <TextField 
            fullWidth 
            size="small" 
            label="Email" 
            name="email" 
            type="email"
            value={form.email}
            onChange={handleChange} 
          />

          <TextField
            fullWidth size="small" label="Password" name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={handleChange}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)}>
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
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><BusinessIcon fontSize="small" color="primary" /></InputAdornment>
                  ),
                }}
              />

              <TextField
                select
                fullWidth
                size="small"
                name="role"
                label="Role"
                value={form.role}
                onChange={handleChange}
                sx={{ textAlign: "left" }}
              >
                <MenuItem value="member">Team Member</MenuItem>
                <MenuItem value="admin">Company Admin</MenuItem>
              </TextField>
            </>
          )}

          <Button 
            fullWidth 
            variant="contained" 
            onClick={handleSubmit}
            sx={{ mt: 1, py: 1.2, bgcolor: "#1976d2", fontWeight: "bold", textTransform: "none" }}
          >
            {isLogin ? "Log In" : "Create Account"}
          </Button>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #e3f2fd" }}>
          <Typography variant="body2" color="textSecondary">
            {isLogin ? "Need an account?" : "Already a member?"}{" "}
            <Link 
              component="button" 
              onClick={() => {
                setIsLogin(!isLogin);
                setForm({ name: "", email: "", password: "", subscriptionId: "", role: "member" });
              }} 
              sx={{ fontWeight: "bold" }}
            >
              {isLogin ? "Sign up" : "Log in"}
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}