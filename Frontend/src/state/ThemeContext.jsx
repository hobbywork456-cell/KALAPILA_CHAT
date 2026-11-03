import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline, useMediaQuery } from "@mui/material";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { makeTheme } from "../theme";

const ModeContext = createContext({ mode: "light", setMode: () => {} });

export function AppThemeProvider({ children }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [pref, setPref] = useState(() => {
    try {
      return localStorage.getItem("kp_theme") || "system";
    } catch {
      return "system";
    }
  });
  const mode = pref === "system" ? (prefersDark ? "dark" : "light") : pref;
  const theme = useMemo(() => makeTheme(mode), [mode]);

  useEffect(() => {
    try {
      localStorage.setItem("kp_theme", pref);
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#0b1220" : "#2563eb");
    // Native app: match status/navigation bar icons to the theme
    if (Capacitor.isNativePlatform()) {
      SystemBars.setStyle({ style: mode === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    }
  }, [pref, mode]);

  return (
    <ModeContext.Provider value={{ mode, pref, setPref }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ModeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ModeContext);
