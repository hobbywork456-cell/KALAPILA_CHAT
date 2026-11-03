import { createTheme, alpha } from "@mui/material/styles";

export const BRAND = "#2563eb";

export const makeTheme = (mode = "light") => {
  const dark = mode === "dark";
  const bg = dark ? "#0b1220" : "#f3f6fb";
  const paper = dark ? "#111a2e" : "#ffffff";
  const theme = createTheme({
    palette: {
      mode,
      primary: { main: BRAND, light: "#60a5fa", dark: "#1d4ed8", contrastText: "#fff" },
      secondary: { main: "#0ea5e9" },
      success: { main: "#16a34a" },
      error: { main: "#ef4444" },
      warning: { main: "#f59e0b" },
      background: { default: bg, paper },
      text: dark
        ? { primary: "#e6ebf5", secondary: "#94a3b8" }
        : { primary: "#0f172a", secondary: "#64748b" },
      divider: dark ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.08)",
      chat: {
        mine: dark ? "#1e3a8a" : "#dbeafe",
        mineText: dark ? "#eef2ff" : "#0f172a",
        theirs: dark ? "#1a2540" : "#ffffff",
        wall: dark ? "#0a1120" : "#eaf0f8",
        dot: dark ? "rgba(148,163,184,0.07)" : "rgba(37,99,235,0.07)",
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      button: { textTransform: "none", fontWeight: 600 },
      h5: { fontWeight: 800, letterSpacing: -0.4 },
      h6: { fontWeight: 700, letterSpacing: -0.2 },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          "html, body, #root": { height: "100%" },
          body: { overscrollBehavior: "none", WebkitTapHighlightColor: "transparent" },
          "*::-webkit-scrollbar": { width: 8, height: 8 },
          "*::-webkit-scrollbar-thumb": {
            background: dark ? "rgba(148,163,184,0.25)" : "rgba(15,23,42,0.18)",
            borderRadius: 8,
          },
          "*::-webkit-scrollbar-track": { background: "transparent" },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 12, paddingInline: 16 }, sizeLarge: { paddingBlock: 11 } },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 20, backgroundImage: "none" } },
      },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none" } } },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 14, boxShadow: "0 12px 32px rgba(15,23,42,0.18)", backgroundImage: "none" },
        },
      },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiTooltip: { defaultProps: { arrow: true }, styleOverrides: { tooltip: { fontSize: 12, borderRadius: 8 } } },
      MuiListItemButton: { styleOverrides: { root: { borderRadius: 14 } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  });
  theme.palette.chat.selected = alpha(BRAND, dark ? 0.22 : 0.1);
  return theme;
};
