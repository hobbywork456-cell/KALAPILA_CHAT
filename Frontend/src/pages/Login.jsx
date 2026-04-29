import React, { useState } from "react";
import { 
  Box, Paper, TextField, Button, Typography, 
  Avatar, Link, InputAdornment, IconButton 
} from "@mui/material";
import { 
  LockOutlined as LockIcon,
  Visibility, 
  VisibilityOff 
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
    role: "employee"
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    try {
      if (isLogin) {
        // LOGIN LOGIC
        const res = await API.post("/auth/login", { 
          email: form.email, 
          password: form.password 
        });
        localStorage.setItem("user", JSON.stringify(res.data.user));
        navigate("/");
      } else {
        // REGISTER LOGIC
        await API.post("/auth/register", form);
        alert("Registration successful! Please login.");
        setIsLogin(true); // Switch to login after success
      }
    } catch (err) {
      console.error(err.response?.data);
      alert(err.response?.data?.message || "Authentication failed");
    }
  };

  return (
    <Box sx={{ 
      height: "100vh", 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center", 
      justifyContent: "center", 
      bgcolor: "#e3d9d9" // Matching your Home page background
    }}>
      <Paper elevation={3} sx={{ 
        p: 4, 
        width: "100%", 
        maxWidth: 350, 
        textAlign: "center",
        borderRadius: 2,
        bgcolor: "#fff"
      }}>
        {/* Instagram-style Logo/Header */}
        <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold", fontFamily: "cursive", color: "#c43636" }}>
         KALA pila
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {!isLogin && (
            <TextField
              fullWidth
              size="small"
              label="Full Name"
              name="name"
              onChange={handleChange}
              sx={{ bgcolor: "#fafafa" }}
            />
          )}

          <TextField
            fullWidth
            size="small"
            label="Email"
            name="email"
            onChange={handleChange}
            sx={{ bgcolor: "#fafafa" }}
          />

          <TextField
            fullWidth
            size="small"
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            onChange={handleChange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ bgcolor: "#fafafa" }}
          />

          {!isLogin && (
            <TextField
              select
              fullWidth
              size="small"
              name="role"
              label="Role"
              value={form.role}
              onChange={handleChange}
              SelectProps={{ native: true }}
              sx={{ bgcolor: "#fafafa" }}
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </TextField>
          )}

          <Button 
            fullWidth 
            variant="contained" 
            onClick={handleSubmit}
            sx={{ 
              mt: 1, 
              bgcolor: "#00a884", // Using the green from your send button
              "&:hover": { bgcolor: "#008f72" },
              fontWeight: "bold",
              textTransform: "none"
            }}
          >
            {isLogin ? "Log In" : "Sign Up"}
          </Button>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #dbdbdb" }}>
          <Typography variant="body2">
            {isLogin ? "Don't have an account?" : "Have an account?"}{" "}
            <Link 
              component="button" 
              onClick={() => setIsLogin(!isLogin)}
              sx={{ fontWeight: "bold", color: "#c43636", textDecoration: "none" }}
            >
              {isLogin ? "Sign up" : "Log in"}
            </Link>
          </Typography>
        </Box>
      </Paper>


    </Box>
  );
}