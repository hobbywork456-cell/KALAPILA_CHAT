import React, { useState } from "react";
import { 
  Box, Paper, TextField, Button, Typography, 
  InputAdornment, IconButton, Tabs, Tab,
  CircularProgress
} from "@mui/material";
import { toast } from 'sonner';
import { 
  Visibility, 
  VisibilityOff,
  Login as LoginIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon
} from "@mui/icons-material";
import { API } from "../api";
import { useNavigate } from "react-router-dom";

function Auth() {
  const navigate = useNavigate();
  // 0 = Sign In, 1 = Create Account
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const isLogin = tabIndex === 0;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
    setForm({ name: "", email: "", password: "", confirmPassword: "" });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    const trimmedEmail = form.email.trim().toLowerCase();
    const trimmedPassword = form.password;
    const trimmedName = form.name.trim();

    if (isLogin) {
      // Sign In Validation
      if (!trimmedEmail) {
        return toast.error("Please enter your email address.");
      }
      if (!trimmedPassword) {
        return toast.error("Please enter your password.");
      }

      setLoading(true);
      try {
        const res = await API.post("/auth/login", {
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (res.data?.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
          toast.success("Welcome back!");
          setTimeout(() => {
            navigate("/home");
            window.location.reload();
          }, 150);
        }
      } catch (err) {
        console.error("Login error:", err);
        let errorMessage = "Something went wrong.";

        if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
          errorMessage = "Server is starting up (Render free tier). Please try again in 10 seconds.";
        } else if (err.message === "Network Error") {
          errorMessage = "Unable to connect to server. The backend may be waking up, please wait a moment.";
        } else if (err.message) {
          errorMessage = err.message;
        }

        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    } else {
      // Register Validation
      if (!trimmedName) {
        return toast.error("Please enter your Full Name.");
      }
      if (!trimmedEmail) {
        return toast.error("Please enter your Email Address.");
      }
      if (!trimmedPassword) {
        return toast.error("Please enter a password.");
      }
      if (trimmedPassword.length < 6) {
        return toast.error("Password must be at least 6 characters long.");
      }
      if (trimmedPassword !== form.confirmPassword) {
        return toast.error("Passwords do not match. Please re-enter.");
      }

      setLoading(true);
      try {
        const res = await API.post("/auth/register", {
          name: trimmedName,
          email: trimmedEmail,
          password: trimmedPassword,
        });

        toast.success(res.data?.message || "Registration Successful! Please log in.");
        setTabIndex(0); // Switch to login tab
        setForm({ name: "", email: trimmedEmail, password: "", confirmPassword: "" });
      } catch (err) {
        console.error("Register error:", err);
        let errorMessage = "Registration failed.";

        if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
          errorMessage = "Server is starting up. Please try again in a moment.";
        } else if (err.message === "Network Error") {
          errorMessage = "Cannot reach server. Please wait a moment and try again.";
        } else if (err.message) {
          errorMessage = err.message;
        }

        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)",
        overflow: "hidden",
        position: "relative",
        p: 2,
      }}
    >
      {/* Soft Floating Glows */}
      <Box
        sx={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.6)",
          filter: "blur(100px)",
          top: "-10%",
          left: "-10%",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(33, 150, 243, 0.2)",
          filter: "blur(80px)",
          bottom: "0%",
          right: "0%",
        }}
      />

      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4.5 },
          width: "100%",
          maxWidth: 440,
          textAlign: "center",
          borderRadius: "32px",
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(255, 255, 255, 0.9)",
          boxShadow: "0 20px 45px rgba(21, 101, 192, 0.12)",
          zIndex: 2,
        }}
      >
        {/* Brand Logo & Title */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
          <img
            src="/favicon.svg"
            alt="Kalapila Logo"
            style={{ width: 64, height: 64, filter: "drop-shadow(0 8px 18px rgba(37, 99, 235, 0.35))" }}
          />
        </Box>

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
          KALA <span style={{ color: "#42a5f5" }}>PILA</span>
        </Typography>

        <Typography variant="body2" sx={{ mb: 2.5, color: "#64748b", fontWeight: 500 }}>
          Real-time workspaces & secure communication
        </Typography>

        {/* Prominent Mode Tabs: Sign In / Create Account */}
        <Paper
          elevation={0}
          sx={{
            bgcolor: "#e2e8f0",
            borderRadius: "14px",
            p: "4px",
            mb: 3,
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              minHeight: 40,
              "& .MuiTabs-indicator": { display: "none" },
              "& .MuiTab-root": {
                minHeight: 38,
                borderRadius: "11px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.92rem",
                color: "#64748b",
                transition: "all 0.2s ease",
                "&.Mui-selected": {
                  bgcolor: "#ffffff",
                  color: "#1565c0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                },
              },
            }}
          >
            <Tab icon={<LoginIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Sign In" />
            <Tab icon={<PersonAddIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Create Account" />
          </Tabs>
        </Paper>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Full Name (Registration only) */}
          {!isLogin && (
            <TextField
              fullWidth
              size="small"
              label="Full Name"
              name="name"
              placeholder="e.g. John Doe"
              value={form.name}
              onChange={handleChange}
              sx={lightGlassInput}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: "#1976d2", fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* Email Address */}
          <TextField
            fullWidth
            size="small"
            label="Email Address"
            name="email"
            type="email"
            placeholder="name@example.com"
            value={form.email}
            onChange={handleChange}
            sx={lightGlassInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon sx={{ color: "#1976d2", fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />

          {/* Password with Eye Toggle */}
          <TextField
            fullWidth
            size="small"
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={form.password}
            onChange={handleChange}
            sx={lightGlassInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: "#1976d2", fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((prev) => !prev)}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                    size="small"
                    sx={{ color: "#1976d2", mr: 0.2 }}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Confirm Password (Registration only) */}
          {!isLogin && (
            <TextField
              fullWidth
              size="small"
              label="Confirm Password"
              name="confirmPassword"
              placeholder="Re-enter password"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
              sx={lightGlassInput}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: "#1976d2", fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      type="button"
                      aria-label="toggle confirm password visibility"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      size="small"
                      sx={{ color: "#1976d2", mr: 0.2 }}
                    >
                      {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* Submit Action Button */}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              mt: 1,
              py: 1.4,
              bgcolor: "#1976d2",
              borderRadius: "14px",
              fontWeight: 800,
              textTransform: "none",
              fontSize: "1rem",
              boxShadow: "0 8px 20px rgba(25, 118, 210, 0.25)",
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor: "#1565c0",
                transform: "translateY(-1px)",
                boxShadow: "0 12px 24px rgba(25, 118, 210, 0.35)",
              },
              "&.Mui-disabled": {
                bgcolor: "#90caf9",
                color: "#ffffff",
              },
            }}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: "#ffffff" }} />
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

// Styling for the "Crystal" Input look
const lightGlassInput = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    transition: "0.2s ease",
    "& fieldset": { borderColor: "rgba(0, 0, 0, 0.08)" },
    "&:hover fieldset": { borderColor: "#90caf9" },
    "&.Mui-focused fieldset": { borderColor: "#1976d2", borderWidth: "2px" },
  },
  "& .MuiInputLabel-root": { fontSize: "0.9rem", color: "#64748b" },
};

export default Auth;