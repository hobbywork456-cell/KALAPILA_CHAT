import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, Box, IconButton, Tabs, Tab, TextField, Button, Typography, CircularProgress, InputAdornment, Tooltip } from "@mui/material";
import { Close as CloseIcon, Casino as DiceIcon } from "@mui/icons-material";
import { toast } from "sonner";
import { API, errorMessage } from "../../lib/api";
import { useChat } from "../../state/ChatContext";

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export default function SpaceDialog({ open, onClose, initialCode = "", onDone }) {
  const { openChat, refreshSpaces, setSpaces } = useChat();
  const [tab, setTab] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(0);
      setCode(initialCode || "");
      setName("");
      setNewCode("");
      setDesc("");
    }
  }, [open, initialCode]);

  const finish = (space, message) => {
    toast.success(message);
    setSpaces((prev) => [space, ...prev.filter((s) => s.spaceId !== space.spaceId)]);
    refreshSpaces();
    openChat("group", space);
    onDone?.();
    onClose();
  };

  const join = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await API.post("/spaces/join", { spaceId: code.trim() });
      finish(r.data.space, r.data.message);
    } catch (err) {
      toast.error(errorMessage(err, "Could not join space."));
    } finally {
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await API.post("/spaces/create", { name: name.trim(), spaceId: newCode.trim(), description: desc.trim() });
      finish(r.data.space, r.data.message);
    } catch (err) {
      toast.error(errorMessage(err, "Could not create space."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", pb: 1 }}>
        <Typography component="span" sx={{ flex: 1, fontWeight: 800, fontSize: 19 }}>Spaces</Typography>
        <IconButton onClick={onClose} disabled={busy} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <Box sx={{ px: 3 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth" sx={{ bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(148,163,184,0.1)" : "#eef2f7"), borderRadius: 3, p: 0.5, minHeight: 0, "& .MuiTabs-indicator": { display: "none" }, "& .MuiTab-root": { minHeight: 38, borderRadius: 2.5, fontWeight: 700 }, "& .Mui-selected": { bgcolor: "background.paper", boxShadow: "0 1px 4px rgba(15,23,42,0.1)" } }}>
          <Tab label="Join with code" />
          <Tab label="Create new" />
        </Tabs>
      </Box>
      <DialogContent sx={{ pt: 2.5 }}>
        {tab === 0 ? (
          <Box component="form" onSubmit={join} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ color: "text.secondary", fontSize: 14 }}>Ask a member of the space for its room code or invite link.</Typography>
            <TextField
              label="Room code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
              autoFocus
              placeholder="e.g. ENG101"
              slotProps={{ htmlInput: { maxLength: 20, style: { letterSpacing: 2, fontWeight: 700 }, autoCapitalize: "characters" } }}
            />
            <Button type="submit" variant="contained" size="large" disabled={busy || !code.trim()}>
              {busy ? <CircularProgress size={22} color="inherit" /> : "Join space"}
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={create} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="Space name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Engineering Team" slotProps={{ htmlInput: { maxLength: 60 } }} />
            <TextField
              label="Room code (optional)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              helperText="Leave empty to generate one. People join using this code."
              slotProps={{
                htmlInput: { maxLength: 20, style: { letterSpacing: 2, fontWeight: 700 } },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Generate code">
                        <IconButton onClick={() => setNewCode(genCode())} edge="end" aria-label="Generate code"><DiceIcon /></IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 300 } }} />
            <Button type="submit" variant="contained" size="large" disabled={busy || !name.trim()}>
              {busy ? <CircularProgress size={22} color="inherit" /> : "Create space"}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
