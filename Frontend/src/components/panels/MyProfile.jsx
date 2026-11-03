import { useEffect, useRef, useState } from "react";
import { Box, Typography, TextField, Button, IconButton, CircularProgress, ToggleButtonGroup, ToggleButton, Collapse } from "@mui/material";
import { PhotoCamera as CameraIcon, Logout as LogoutIcon, LightModeOutlined, DarkModeOutlined, SettingsBrightnessOutlined, LockOutlined as LockIcon, NotificationsActiveOutlined as BellIcon } from "@mui/icons-material";
import { toast } from "sonner";
import PanelShell, { Section } from "./PanelShell";
import { UserAvatar } from "../Avatars";
import { useAuth } from "../../state/AuthContext";
import { useThemeMode } from "../../state/ThemeContext";
import { API, errorMessage } from "../../lib/api";
import { resizeImage } from "../../lib/image";
import { canNotify } from "../../lib/notify";

export default function MyProfile({ open, onClose }) {
  const { user, updateUser, logout } = useAuth();
  const { pref, setPref } = useThemeMode();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [pic, setPic] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [notifPerm, setNotifPerm] = useState(canNotify() ? Notification.permission : "unsupported");
  const fileRef = useRef(null);

  useEffect(() => {
    if (open && user) {
      setName(user.name || "");
      setBio(user.bio || "");
      setPic(user.profilePic || "");
      setPw({ current: "", next: "" });
      setPwOpen(false);
    }
  }, [open, user]);

  const dirty = user && (name.trim() !== user.name || bio.trim() !== (user.bio || "") || pic !== (user.profilePic || ""));

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image.");
    try {
      setPic(await resizeImage(f, 320));
    } catch {
      toast.error("Could not read that image.");
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Name cannot be empty.");
    setSaving(true);
    try {
      const r = await API.put("/auth/profile", { name: name.trim(), bio: bio.trim(), profilePic: pic });
      updateUser(r.data);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update profile."));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 6) return toast.error("New password must be at least 6 characters.");
    try {
      await API.put("/auth/password", { currentPassword: pw.current, newPassword: pw.next });
      toast.success("Password changed");
      setPw({ current: "", next: "" });
      setPwOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <PanelShell open={open} onClose={onClose} title="Profile" anchor="left">
      <Box sx={{ bgcolor: "background.paper", py: 4, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ position: "relative" }}>
          <UserAvatar user={{ ...user, profilePic: pic, name }} size={128} />
          <IconButton onClick={() => fileRef.current?.click()} aria-label="Change photo" sx={{ position: "absolute", right: 0, bottom: 0, bgcolor: "primary.main", color: "#fff", border: (t) => `3px solid ${t.palette.background.paper}`, "&:hover": { bgcolor: "primary.dark" } }}>
            <CameraIcon fontSize="small" />
          </IconButton>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        </Box>
        {pic && (
          <Button size="small" color="inherit" onClick={() => setPic("")} sx={{ mt: 1, color: "text.secondary" }}>Remove photo</Button>
        )}
        <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 14 }}>{user?.email}</Typography>
      </Box>

      <Section title="About you">
        <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} slotProps={{ htmlInput: { maxLength: 60 } }} />
        <TextField fullWidth label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 200 } }} helperText={`${bio.length}/200`} />
        <Button fullWidth variant="contained" size="large" sx={{ mt: 2 }} onClick={save} disabled={!dirty || saving}>
          {saving ? <CircularProgress size={22} color="inherit" /> : "Save changes"}
        </Button>
      </Section>

      <Section title="Appearance">
        <ToggleButtonGroup exclusive fullWidth value={pref} onChange={(e, v) => v && setPref(v)} size="small">
          <ToggleButton value="light"><LightModeOutlined fontSize="small" sx={{ mr: 0.75 }} />Light</ToggleButton>
          <ToggleButton value="dark"><DarkModeOutlined fontSize="small" sx={{ mr: 0.75 }} />Dark</ToggleButton>
          <ToggleButton value="system"><SettingsBrightnessOutlined fontSize="small" sx={{ mr: 0.75 }} />Auto</ToggleButton>
        </ToggleButtonGroup>
      </Section>

      {notifPerm !== "unsupported" && notifPerm !== "granted" && (
        <Section title="Notifications">
          <Typography sx={{ fontSize: 14, color: "text.secondary", mb: 1.5 }}>
            {notifPerm === "denied" ? "Notifications are blocked in your browser settings." : "Get notified about new messages and calls while Kalapila is in the background."}
          </Typography>
          {notifPerm === "default" && (
            <Button variant="outlined" startIcon={<BellIcon />} onClick={() => Notification.requestPermission().then(setNotifPerm)}>Enable notifications</Button>
          )}
        </Section>
      )}

      <Section title="Security">
        <Button startIcon={<LockIcon />} onClick={() => setPwOpen((v) => !v)} color="inherit">Change password</Button>
        <Collapse in={pwOpen}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1.5 }}>
            <TextField type="password" label="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
            <TextField type="password" label="New password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" helperText="At least 6 characters" />
            <Button variant="contained" onClick={changePassword} disabled={!pw.current || !pw.next}>Update password</Button>
          </Box>
        </Collapse>
      </Section>

      <Section>
        <Button fullWidth color="error" variant="outlined" size="large" startIcon={<LogoutIcon />} onClick={logout}>Log out</Button>
      </Section>
    </PanelShell>
  );
}
