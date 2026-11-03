import { StrictMode } from "react";
import { useMediaQuery } from "@mui/material";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App.jsx";
import { AuthProvider } from "./state/AuthContext";
import { AppThemeProvider, useThemeMode } from "./state/ThemeContext";
import "./index.css";

function ThemedToaster() {
  const { mode } = useThemeMode();
  const wide = useMediaQuery("(min-width: 900px)");
  return (
    <Toaster
      theme={mode}
      position={wide ? "bottom-right" : "top-center"}
      richColors
      closeButton
      offset={wide ? 24 : { top: "calc(12px + env(safe-area-inset-top))" }}
      mobileOffset={{ top: "calc(12px + env(safe-area-inset-top))" }}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppThemeProvider>
      <AuthProvider>
        <ThemedToaster />
        <App />
      </AuthProvider>
    </AppThemeProvider>
  </StrictMode>
);

// PWA: register the service worker (web only; the native app ships its files locally)
if ("serviceWorker" in navigator && import.meta.env.PROD && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
