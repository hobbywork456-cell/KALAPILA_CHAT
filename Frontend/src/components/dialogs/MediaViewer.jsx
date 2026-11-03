import { useEffect } from "react";
import { Dialog, Box, IconButton, Typography } from "@mui/material";
import { Close as CloseIcon, Download as DownloadIcon, ChevronLeft, ChevronRight } from "@mui/icons-material";
import { fileUrl } from "../../lib/config";
import { timeOf, dayLabel } from "../../lib/format";

export default function MediaViewer({ item, items = [], onClose, onChange }) {
  const idx = item ? items.findIndex((m) => m._id === item._id) : -1;
  const prev = idx > 0 ? items[idx - 1] : null;
  const next = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;

  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft" && prev) onChange(prev);
      if (e.key === "ArrowRight" && next) onChange(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, prev, next, onChange]);

  if (!item) return null;
  const url = fileUrl(item.fileUrl);

  return (
    <Dialog open fullScreen onClose={onClose} slotProps={{ paper: { sx: { bgcolor: "rgba(5,8,15,0.96)", borderRadius: 0 } } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, pt: "calc(12px + env(safe-area-inset-top))", color: "#fff" }}>
        <IconButton onClick={onClose} sx={{ color: "#fff" }} aria-label="Close"><CloseIcon /></IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 700 }}>{item.sender?.name}</Typography>
          <Typography sx={{ fontSize: 12.5, opacity: 0.7 }}>{dayLabel(item.createdAt)}, {timeOf(item.createdAt)}</Typography>
        </Box>
        <IconButton component="a" href={url.startsWith("data:") ? url : `${url}?download=1`} download={item.fileName || true} target="_blank" rel="noreferrer" sx={{ color: "#fff" }} aria-label="Download">
          <DownloadIcon />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, position: "relative", display: "grid", placeItems: "center", px: { xs: 0, sm: 8 }, pb: 2, minHeight: 0 }} onClick={onClose}>
        {item.fileType === "image" ? (
          <Box component="img" src={url} alt="" onClick={(e) => e.stopPropagation()} sx={{ maxWidth: "100%", maxHeight: "calc(100vh - 120px)", objectFit: "contain", borderRadius: { sm: 2 } }} />
        ) : (
          <Box component="video" src={url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} sx={{ maxWidth: "100%", maxHeight: "calc(100vh - 120px)", borderRadius: { sm: 2 } }} />
        )}
        {prev && (
          <IconButton onClick={(e) => { e.stopPropagation(); onChange(prev); }} sx={navBtn("left")} aria-label="Previous"><ChevronLeft fontSize="large" /></IconButton>
        )}
        {next && (
          <IconButton onClick={(e) => { e.stopPropagation(); onChange(next); }} sx={navBtn("right")} aria-label="Next"><ChevronRight fontSize="large" /></IconButton>
        )}
        {item.message && (
          <Typography sx={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#fff", px: 3 }}>{item.message}</Typography>
        )}
      </Box>
    </Dialog>
  );
}

const navBtn = (side) => ({
  position: "absolute",
  [side]: { xs: 4, sm: 16 },
  top: "50%",
  transform: "translateY(-50%)",
  color: "#fff",
  bgcolor: "rgba(255,255,255,0.1)",
  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
});
