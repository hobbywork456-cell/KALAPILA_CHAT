import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "./state/AuthContext";
import { ChatProvider } from "./state/ChatContext";
import Login from "./pages/Login";
import Home from "./pages/Home";

function Authed() {
  return (
    <ChatProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:code" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ChatProvider>
  );
}

// Remember an invite code while the user signs in
function PendingJoin() {
  const { code } = useParams();
  if (code) sessionStorage.setItem("kp_join", code.toUpperCase());
  return <Login />;
}

function JoinRedirect() {
  const code = sessionStorage.getItem("kp_join");
  if (code) {
    sessionStorage.removeItem("kp_join");
    return <Navigate to={`/join/${code}`} replace />;
  }
  return null;
}

export default function App() {
  const { token } = useAuth();
  return (
    <BrowserRouter>
      {token ? (
        <>
          <JoinRedirect />
          <Authed />
        </>
      ) : (
        <Routes>
          <Route path="/join/:code" element={<PendingJoin />} />
          <Route path="*" element={<Login />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
