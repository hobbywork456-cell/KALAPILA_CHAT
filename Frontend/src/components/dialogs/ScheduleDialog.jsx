import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Chip, Box, Typography, IconButton, List, ListItem, ListItemText, CircularProgress, Divider } from "@mui/material";
import { Close as CloseIcon, DeleteOutlineOutlined as DeleteIcon, ScheduleSend as ScheduleIcon } from "@mui/icons-material";
import { toast } from "sonner";
import { API, errorMessage } from "../../lib/api";
import { useChat } from "../../state/ChatContext";

// Format a Date for <input type="datetime-local"> in the user's local timezone
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const presets = () => {
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", date: inHour },
    ...(tonight > new Date(now.getTime() + 10 * 60000) ? [{ label: "Tonight, 8 PM", date: tonight }] : []),
    { label: "Tomorrow, 9 AM", date: tomorrow },
  ];
};

export default function ScheduleDialog({ open, text, listOnly, chat, onClose, onScheduled }) {
  const { scheduleMessage } = useChat();
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState(null);

  useEffect(() => {
    if (!open) return;
    setWhen(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    setList(null);
    API.get("/messages/scheduled", { params: { chatType: chat.type, id: chat.id } })
      .then((r) => setList(r.data || []))
      .catch(() => setList([]));
  }, [open, chat?.type, chat?.id]);

  const submit = async () => {
    const date = new Date(when); // parsed as local time
    if (isNaN(date) || date.getTime() < Date.now() + 30 * 1000) return toast.error("Please choose a time in the future.");
    setSaving(true);
    const ok = await scheduleMessage(text, date, chat);
    setSaving(false);
    if (ok) onScheduled?.();
  };

  const cancel = async (id) => {
    try {
      await API.delete(`/messages/scheduled/${id}`);
      setList((l) => l.filter((m) => m._id !== id));
      toast.success("Scheduled message cancelled.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 800 }}>
        <ScheduleIcon color="primary" />
        <Box sx={{ flex: 1 }}>{listOnly ? "Scheduled messages" : "Schedule message"}</Box>
        <IconButton onClick={onClose} size="small" aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        {!listOnly && (
          <>
            <Box sx={{ p: 1.5, mb: 2, borderRadius: 3, bgcolor: "chat.selected", fontSize: 14.5, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflow: "auto" }}>{text}</Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
              {presets().map((p) => (
                <Chip key={p.label} label={p.label} onClick={() => setWhen(toLocalInput(p.date))} variant={when === toLocalInput(p.date) ? "filled" : "outlined"} color="primary" />
              ))}
            </Box>
            <TextField
              type="datetime-local"
              label="Send at"
              fullWidth
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: toLocalInput(new Date()) } }}
            />
            <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 1 }}>
              Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </Typography>
          </>
        )}

        {(listOnly || (list && list.length > 0)) && (
          <Box sx={{ mt: listOnly ? 0 : 2.5 }}>
            {!listOnly && <Divider sx={{ mb: 1.5 }} />}
            {!listOnly && <Typography sx={{ fontSize: 13, fontWeight: 800, color: "text.secondary", mb: 0.5 }}>ALREADY SCHEDULED</Typography>}
            {list === null ? (
              <Box sx={{ display: "grid", placeItems: "center", py: 3 }}><CircularProgress size={24} /></Box>
            ) : list.length === 0 ? (
              <Typography sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>
                Nothing scheduled in this chat. Type a message and tap the clock icon to schedule it.
              </Typography>
            ) : (
              <List dense disablePadding>
                {list.map((m) => (
                  <ListItem key={m._id} disableGutters secondaryAction={<IconButton edge="end" onClick={() => cancel(m._id)} aria-label="Cancel scheduled message"><DeleteIcon /></IconButton>}>
                    <ListItemText
                      primary={m.message}
                      secondary={new Date(m.scheduledTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      slotProps={{ primary: { noWrap: true, sx: { fontWeight: 600 } } }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
      {!listOnly && (
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={saving || !when}>
            {saving ? <CircularProgress size={20} color="inherit" /> : "Schedule"}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
