import React, { useState } from "react";
import { 
  Box, Paper, TextField, Button, Typography, 
  Link, InputAdornment, IconButton, MenuItem,
  CircularProgress
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
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    try {
      if (isLogin) {
        if (!form.email || !form.password) {
          return toast.error("Please enter your email and password.");
        }
        setLoading(true);
        const res = await API.post("/auth/login", {
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (res.data.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
          toast.success("Welcome back!");
          setTimeout(() => {
            navigate("/home");
            window.location.reload();
          }, 150);
        }
      } else {
        if (!form.name || !form.email || !form.password || !form.confirmPassword) {
          return toast.error("All fields are required.");
        }
        if (form.password.length < 6) {
          return toast.error("Password must be at least 6 characters long.");
        }
        if (form.password !== form.confirmPassword) {
          return toast.error("Passwords do not match. Please re-enter.");
        }

        setLoading(true);
        const res = await API.post("/auth/register", {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });

        toast.success(res.data.message || "Registration Successful! Please log in.");
        setIsLogin(true);
        setForm({ name: "", email: form.email, password: "", confirmPassword: "" });
      }
    } catch (err) {
      console.error("Auth error:", err);
      let errorMessage = "Something went wrong.";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        errorMessage = "Server is taking longer to respond (Render cold start). Please try again in 10 seconds.";
      } else if (err.message === "Network Error") {
        errorMessage = "Cannot reach server. The backend may be waking up, please wait a moment and try again.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
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
        // Light Blue Gradient Background
        background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)",
        overflow: "hidden",
        position: "relative",
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
          p: { xs: 3, sm: 5 },
          width: "90%",
          maxWidth: 420,
          textAlign: "center",
          borderRadius: "32px",
          // --- Frosted Glass Effect ---
          background: "rgba(255, 255, 255, 0.75)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(255, 255, 255, 0.85)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
          zIndex: 2,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <img
            src="/favicon.svg"
            alt="Kalapila Logo"
            style={{ width: 68, height: 68, filter: "drop-shadow(0 8px 20px rgba(37, 99, 235, 0.4))" }}
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

        <Typography variant="body2" sx={{ mb: 3.5, color: "#546e7a", fontWeight: 500, opacity: 0.85 }}>
          {isLogin ? "Sign in to your account" : "Create your account"}
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {!isLogin && (
            <TextField
              fullWidth
              size="small"
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              sx={lightGlassInput}
              required
            />
          )}

          <TextField
            fullWidth
            size="small"
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            sx={lightGlassInput}
            required
          />

          {/* Password with Eye Toggle */}
          <TextField
            fullWidth
            size="small"
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={handleChange}
            sx={lightGlassInput}
            required
            slotProps={{
              input: {
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
              },
            }}
            InputProps={{
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

          {/* Confirm Password (only for Registration) */}
          {!isLogin && (
            <TextField
              fullWidth
              size="small"
              label="Confirm Password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
              sx={lightGlassInput}
              required
              slotProps={{
                input: {
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
                },
              }}
              InputProps={{
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

          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              mt: 1.5,
              py: 1.5,
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
              "Log In"
            ) : (
              "Create Account"
            )}
          </Button>
        </Box>

        <Box sx={{ mt: 3.5, pt: 2, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <Typography variant="body2" color="textSecondary">
            {isLogin ? "New to Kalapila?" : "Already have an account?"}{" "}
            <Link
              component="button"
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setForm({ name: "", email: "", password: "", confirmPassword: "" });
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