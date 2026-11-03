import { Box, Typography } from "@mui/material";

export default function Logo({ size = 24, showMark = false }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {showMark && <Box component="img" src="/favicon.svg" alt="" sx={{ width: size * 1.5, height: size * 1.5 }} />}
      <Typography sx={{ fontSize: size, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1, color: "text.primary" }}>
        kala<Box component="span" sx={{ color: "primary.main" }}>pila</Box>
      </Typography>
    </Box>
  );
}
