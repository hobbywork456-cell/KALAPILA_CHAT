import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API, TOKEN_KEY, USER_KEY, setUnauthorizedHandler } from "../lib/api";
import { disconnectSocket } from "../lib/socket";

const AuthContext = createContext(null);

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

// A login against an outdated backend could store the literal string "undefined".
const readToken = () => {
  const t = localStorage.getItem(TOKEN_KEY);
  return t && t !== "undefined" && t !== "null" ? t : null;
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(() => (readToken() ? readUser() : null));

  useEffect(() => {
    // Old builds stored an unauthenticated "user" object – drop it.
    localStorage.removeItem("user");
    if (!readToken()) localStorage.removeItem(TOKEN_KEY);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    disconnectSocket();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const login = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const updateUser = useCallback((u) => {
    setUser((prev) => {
      const next = { ...prev, ...u };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Refresh profile from server on start
  useEffect(() => {
    if (!token) return;
    API.get("/auth/me")
      .then((r) => updateUser(r.data))
      .catch(() => {});
  }, [token, updateUser]);

  const value = useMemo(() => ({ token, user, login, logout, updateUser }), [token, user, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
