import { useEffect, useRef, useState } from "react";
import { Box, IconButton, InputBase, Tooltip, Typography, Menu, MenuItem, ListItemIcon } from "@mui/material";
import {
  Send as SendIcon, AttachFile as AttachIcon, Mic as MicIcon, Close as CloseIcon, Check as CheckIcon,
  ScheduleSend as ScheduleIcon, DeleteOutlineOutlined as TrashIcon, Reply as ReplyIcon, Edit as EditIcon,
  PhotoLibraryOutlined as PhotoIcon, InsertDriveFileOutlined as DocIcon, CameraAltOutlined as CameraIcon,
} from "@mui/icons-material";
import { toast } from "sonner";
import { previewOf, duration } from "../../lib/format";

const MAX_MB = 25;
// Unsent text per chat survives switching between chats
const DRAFTS = {};
const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
};

export default function Composer({ chatKey, onSendText, onSendFiles, onSaveEdit, onSchedule, onTyping, replyTo, onCancelReply, editing, onCancelEdit }) {
  const [text, setText] = useState("");
  const [attachEl, setAttachEl] = useState(null);
  const [rec, setRec] = useState(null); // { start } while recording
  const recRef = useRef(null); // { recorder, stream, chunks }
  const [recSecs, setRecSecs] = useState(0);
  const inputRef = useRef(null);
  const mediaInput = useRef(null);
  const docInput = useRef(null);
  const cameraInput = useRef(null);

  // Per-chat drafts
  useEffect(() => {
    setText(DRAFTS[chatKey] || "");
    if (!isTouch()) setTimeout(() => inputRef.current?.focus(), 50);
  }, [chatKey]);
  useEffect(() => {
    if (!editing) DRAFTS[chatKey] = text;
  }, [text, chatKey, editing]);

  useEffect(() => {
    if (editing) {
      setText(editing.message || "");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [editing]);
  useEffect(() => {
    if (replyTo) setTimeout(() => inputRef.current?.focus(), 30);
  }, [replyTo]);

  // recording timer
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRecSecs(Math.floor((Date.now() - rec.start) / 1000)), 250);
    return () => clearInterval(t);
  }, [rec]);
  useEffect(() => () => recRef.current?.stream?.getTracks().forEach((t) => t.stop()), []);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    if (editing) {
      if (value !== editing.message) onSaveEdit(editing, value);
      else onCancelEdit();
      DRAFTS[chatKey] = "";
      setText("");
      return;
    }
    onSendText(value);
    setText("");
    DRAFTS[chatKey] = "";
    if (!isTouch()) inputRef.current?.focus();
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const ok = files.filter((f) => {
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`"${f.name}" is larger than ${MAX_MB} MB.`);
        return false;
      }
      return true;
    });
    if (ok.length) onSendFiles(ok);
  };

  const startRecording = async () => {
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice messages aren't supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start(250);
      recRef.current = { recorder, stream, chunks };
      setRecSecs(0);
      setRec({ start: Date.now() });
    } catch {
      toast.error("Microphone permission is needed to record voice messages.");
    }
  };

  const stopRecording = (send) => {
    if (!rec || !recRef.current) return;
    const { recorder, stream, chunks } = recRef.current;
    const { start } = rec;
    recRef.current = null;
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!send) return;
      if (Date.now() - start < 800) return toast.info("Hold on a little longer to record a message.");
      const type = recorder.mimeType || "audio/webm";
      const ext = type.includes("mp4") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const file = new File(chunks, `voice-${Date.now()}.${ext}`, { type: type.split(";")[0] });
      onSendFiles([file]);
    };
    try {
      recorder.stop();
    } catch {
      stream.getTracks().forEach((t) => t.stop());
    }
    setRec(null);
  };

  const hasText = text.trim().length > 0;

  return (
    <Box sx={{ bgcolor: "background.paper", borderTop: 1, borderColor: "divider", px: { xs: 1, sm: 2 }, pt: 1, pb: "calc(8px + env(safe-area-inset-bottom))" }}>
      {(replyTo || editing) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, pb: 1 }}>
          {editing ? <EditIcon color="primary" fontSize="small" /> : <ReplyIcon color="primary" fontSize="small" />}
          <Box sx={{ flex: 1, minWidth: 0, borderLeft: "3px solid", borderColor: "primary.main", pl: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: "primary.main" }}>
              {editing ? "Edit message" : `Replying to ${replyTo.sender?.name || "message"}`}
            </Typography>
            <Typography noWrap sx={{ fontSize: 13, color: "text.secondary" }}>
              {previewOf(editing || replyTo)}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => { if (editing) { onCancelEdit(); setText(DRAFTS[chatKey] || ""); } else onCancelReply(); }} aria-label="Cancel">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {rec ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 48 }}>
          <Tooltip title="Discard">
            <IconButton onClick={() => stopRecording(false)} color="error" aria-label="Discard recording">
              <TrashIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5, px: 2, height: 46, borderRadius: 6, bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(239,68,68,0.12)" : "#fef2f2") }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "error.main", animation: "kpBlink 1s infinite", "@keyframes kpBlink": { "50%": { opacity: 0.2 } } }} />
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{duration(recSecs)}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: 14 }}>Recording…</Typography>
          </Box>
          <IconButton onClick={() => stopRecording(true)} aria-label="Send voice message" sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } }}>
            <SendIcon sx={{ fontSize: 22, ml: "2px" }} />
          </IconButton>
        </Box>
      ) : (
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
          <Box sx={{ flex: 1, display: "flex", alignItems: "flex-end", minHeight: 48, borderRadius: "24px", bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(148,163,184,0.1)" : "#eef2f7"), px: 0.5 }}>
            {!editing && (
              <Tooltip title="Attach">
                <IconButton onClick={(e) => setAttachEl(e.currentTarget)} aria-label="Attach file" sx={{ m: 0.25, color: "text.secondary" }}>
                  <AttachIcon sx={{ transform: "rotate(45deg)" }} />
                </IconButton>
              </Tooltip>
            )}
            <InputBase
              inputRef={inputRef}
              value={text}
              onChange={(e) => { setText(e.target.value); onTyping?.(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isTouch()) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") { if (editing) onCancelEdit(); else if (replyTo) onCancelReply(); }
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData?.files || []);
                if (files.length) {
                  e.preventDefault();
                  handleFiles(files);
                }
              }}
              placeholder={editing ? "Edit message" : "Message"}
              multiline
              maxRows={6}
              sx={{ flex: 1, px: editing ? 2 : 0.5, py: 1.4, fontSize: 15.5, lineHeight: 1.4 }}
              inputProps={{ "aria-label": "Message" }}
            />
            {hasText && !editing && (
              <Tooltip title="Schedule message">
                <IconButton onClick={() => onSchedule(text.trim(), () => { setText(""); DRAFTS[chatKey] = ""; })} aria-label="Schedule message" sx={{ m: 0.25, color: "text.secondary" }}>
                  <ScheduleIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {hasText || editing ? (
            <IconButton onClick={submit} disabled={!hasText} aria-label={editing ? "Save edit" : "Send"} sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: editing ? "success.main" : "primary.main", color: "#fff", flexShrink: 0, "&:hover": { bgcolor: editing ? "success.dark" : "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground", color: "#fff" } }}>
              {editing ? <CheckIcon /> : <SendIcon sx={{ fontSize: 22, ml: "2px" }} />}
            </IconButton>
          ) : (
            <Tooltip title="Record voice message">
              <IconButton onClick={startRecording} aria-label="Record voice message" sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "primary.main", color: "#fff", flexShrink: 0, "&:hover": { bgcolor: "primary.dark" } }}>
                <MicIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={docInput} type="file" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

      <Menu anchorEl={attachEl} open={!!attachEl} onClose={() => setAttachEl(null)} anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}>
        <MenuItem onClick={() => { setAttachEl(null); mediaInput.current?.click(); }}>
          <ListItemIcon><PhotoIcon fontSize="small" sx={{ color: "#7c3aed" }} /></ListItemIcon>Photos & videos
        </MenuItem>
        {isTouch() && (
          <MenuItem onClick={() => { setAttachEl(null); cameraInput.current?.click(); }}>
            <ListItemIcon><CameraIcon fontSize="small" sx={{ color: "#db2777" }} /></ListItemIcon>Camera
          </MenuItem>
        )}
        <MenuItem onClick={() => { setAttachEl(null); docInput.current?.click(); }}>
          <ListItemIcon><DocIcon fontSize="small" sx={{ color: "#2563eb" }} /></ListItemIcon>Document
        </MenuItem>
      </Menu>
    </Box>
  );
}
