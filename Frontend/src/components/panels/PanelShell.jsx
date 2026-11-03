import { Drawer, Box, IconButton, Typography } from "@mui/material";
import { Close as CloseIcon, ArrowBack as BackIcon } from "@mui/icons-material";

export default function PanelShell({ open, onClose, title, anchor = "right", children }) {
  return (
    <Drawer anchor={anchor} open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 400 }, bgcolor: "background.default" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, pt: "calc(10px + env(safe-area-inset-top))", pb: 1.25, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", position: "sticky", top: 0, zIndex: 2 }}>
        <IconButton onClick={onClose} aria-label="Close">{anchor === "left" ? <BackIcon /> : <CloseIcon />}</IconButton>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{title}</Typography>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", pb: "calc(24px + env(safe-area-inset-bottom))" }}>{children}</Box>
    </Drawer>
  );
}

export function Section({ title, children, sx }) {
  return (
    <Box sx={{ bgcolor: "background.paper", mt: 1.25, px: 2.5, py: 2, ...sx }}>
      {title && <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: "primary.main", letterSpacing: 0.5, mb: 1, textTransform: "uppercase" }}>{title}</Typography>}
      {children}
    </Box>
  );
}
