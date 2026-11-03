import { useState } from "react";
import { Box, Paper, TextField, Button, Typography, InputAdornment, IconButton, CircularProgress, Tabs, Tab, useMediaQuery } from "@mui/material";
import { Visibility, VisibilityOff, MailOutlineOutlined, LockOutlined, PersonOutlineOutlined, ChatBubbleOutlineOutlined, VideocamOutlined, GroupsOutlined } from "@mui/icons-material";
import { toast } from "sonner";
import { API, errorMessage } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import Logo from "../components/Logo";

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const wide = useMediaQuery((t) => t.breakpoints.up("md"));
  const isLogin = tab === 0;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const email = form.email.trim().toLowerCase();
    if (!isLogin && !form.name.trim()) return toast.error("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Please enter a valid email address.");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (!isLogin && form.password !== form.confirm) return toast.error("Passwords don't match.");

    setLoading(true);
    const slow = setTimeout(() => toast.info("Waking up the server… this can take up to a minute on the first request."), 6000);
    try {
      const r = isLogin
        ? await API.post("/auth/login", { email, password: form.password })
        : await API.post("/auth/register", { name: form.name.trim(), email, password: form.password });
      // An outdated backend answers without a token – don't greet the user and leave them stuck here.
      if (!r.data?.token || !r.data?.user) {
        toast.error("The server is out of date and couldn't sign you in. Please try again later.");
        return;
      }
      login(r.data);
      toast.success(isLogin ? `Welcome back, ${r.data.user.name.split(" ")[0]}!` : "Your account is ready!");
    } catch (err) {
      toast.error(errorMessage(err, isLogin ? "Could not sign in." : "Could not create account."));
    } finally {
      clearTimeout(slow);
      setLoading(false);
    }
  };

  const field = { "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "background.paper" } };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", bgcolor: "background.default" }}>
      {wide && (
        <Box sx={{ flex: 1, position: "relative", overflow: "hidden", color: "#fff", p: 6, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(150deg, #1d4ed8 0%, #2563eb 45%, #0ea5e9 100%)" }}>
          <Box sx={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", right: -160, top: -140, bgcolor: "rgba(255,255,255,0.08)" }} />
          <Box sx={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", left: -120, bottom: -120, bgcolor: "rgba(255,255,255,0.07)" }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, position: "relative" }}>
            <Box component="img" src="/favicon.svg" alt="" sx={{ width: 40, height: 40, filter: "brightness(0) invert(1)" }} />
            <Typography sx={{ fontWeight: 800, fontSize: 26, letterSpacing: -0.8 }}>kalapila</Typography>
          </Box>
          <Box sx={{ position: "relative", maxWidth: 480 }}>
            <Typography sx={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, mb: 2 }}>Talk to your team, wherever they are.</Typography>
            <Typography sx={{ fontSize: 18, opacity: 0.9, mb: 4 }}>Real-time chat, group spaces, voice notes and HD calls — on the web and on your phone.</Typography>
            {[
              [<ChatBubbleOutlineOutlined key="a" />, "Instant messages with read receipts"],
              [<GroupsOutlined key="b" />, "Spaces for every team, joined with a code"],
              [<VideocamOutlined key="c" />, "Voice & video calls with screen sharing"],
            ].map(([icon, text]) => (
              <Box key={text} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.16)", display: "grid", placeItems: "center" }}>{icon}</Box>
                <Typography sx={{ fontWeight: 600 }}>{text}</Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ position: "relative", opacity: 0.7, fontSize: 13 }}>© {new Date().getFullYear()} Kalapila</Typography>
        </Box>
      )}

      <Box sx={{ flex: { xs: 1, md: "0 0 520px" }, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 2.5, sm: 4 }, pt: "calc(24px + env(safe-area-inset-top))" }}>
        <Box sx={{ width: "100%", maxWidth: 400 }}>
          {!wide && (
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Box component="img" src="/favicon.svg" alt="" sx={{ width: 64, height: 64, mb: 1.5 }} />
              <Box sx={{ display: "flex", justifyContent: "center" }}><Logo size={30} /></Box>
              <Typography sx={{ color: "text.secondary", mt: 1 }}>Chat, spaces & calls for your team</Typography>
            </Box>
          )}
          <Typography sx={{ fontWeight: 800, fontSize: 28, letterSpacing: -0.6, mb: 0.5 }}>{isLogin ? "Welcome back" : "Create your account"}</Typography>
          <Typography sx={{ color: "text.secondary", mb: 3 }}>{isLogin ? "Sign in to continue to Kalapila." : "It only takes a few seconds."}</Typography>

          <Paper elevation={0} sx={{ p: 0.5, mb: 3, borderRadius: 3, bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(148,163,184,0.1)" : "#e8edf5") }}>
            <Tabs value={tab} onChange={(e, v) => { setTab(v); setShow(false); }} variant="fullWidth" sx={{ minHeight: 0, "& .MuiTabs-indicator": { display: "none" }, "& .MuiTab-root": { minHeight: 40, borderRadius: 2.5, fontWeight: 700 }, "& .Mui-selected": { bgcolor: "background.paper", boxShadow: "0 1px 4px rgba(15,23,42,0.1)" } }}>
              <Tab label="Sign in" />
              <Tab label="Sign up" />
            </Tabs>
          </Paper>

          <Box component="form" onSubmit={submit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {!isLogin && (
              <TextField label="Full name" value={form.name} onChange={set("name")} autoComplete="name" sx={field}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonOutlineOutlined color="action" /></InputAdornment> } }} />
            )}
            <TextField label="Email" type="email" value={form.email} onChange={set("email")} autoComplete="email" sx={field}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><MailOutlineOutlined color="action" /></InputAdornment> }, htmlInput: { inputMode: "email", autoCapitalize: "none" } }} />
            <TextField label="Password" type={show ? "text" : "password"} value={form.password} onChange={set("password")} autoComplete={isLogin ? "current-password" : "new-password"} sx={field}
              helperText={!isLogin ? "At least 6 characters" : undefined}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShow((s) => !s)} edge="end" aria-label={show ? "Hide password" : "Show password"}>
                        {show ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }} />
            {!isLogin && (
              <TextField label="Confirm password" type={show ? "text" : "password"} value={form.confirm} onChange={set("confirm")} autoComplete="new-password" sx={field}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockOutlined color="action" /></InputAdornment> } }} />
            )}
            <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 1, py: 1.5, borderRadius: 3, fontSize: 16, boxShadow: "0 10px 24px rgba(37,99,235,0.3)" }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : isLogin ? "Sign in" : "Create account"}
            </Button>
          </Box>

          <Typography sx={{ textAlign: "center", color: "text.secondary", mt: 3, fontSize: 14 }}>
            {isLogin ? "New to Kalapila? " : "Already have an account? "}
            <Box component="button" type="button" onClick={() => setTab(isLogin ? 1 : 0)} sx={{ border: 0, background: "none", color: "primary.main", fontWeight: 700, cursor: "pointer", font: "inherit", p: 0 }}>
              {isLogin ? "Create an account" : "Sign in"}
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
