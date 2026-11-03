import { useEffect, useState } from "react";
import { Box, Typography, Button, useMediaQuery } from "@mui/material";
import { Add as AddIcon, EditOutlined as NewChatIcon, LockOutlined as LockIcon } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { useChat, chatKey } from "../state/ChatContext";
import { CallProvider } from "../components/call/CallContext";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/chat/ChatWindow";
import PeopleDialog from "../components/dialogs/PeopleDialog";
import SpaceDialog from "../components/dialogs/SpaceDialog";
import MyProfile from "../components/panels/MyProfile";
import UserInfo from "../components/panels/UserInfo";
import SpaceInfo from "../components/panels/SpaceInfo";
import Logo from "../components/Logo";
import { askNotificationPermission } from "../lib/notify";

export default function Home() {
  return (
    <CallProvider>
      <HomeInner />
    </CallProvider>
  );
}

function HomeInner() {
  const chat = useChat();
  const { active } = chat;
  const isDesktop = useMediaQuery((t) => t.breakpoints.up("md"));
  const { code: joinCode } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState(0);
  const [people, setPeople] = useState(null); // 'chat' | 'call'
  const [spaceDialog, setSpaceDialog] = useState(false);
  const [myProfile, setMyProfile] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [spaceInfo, setSpaceInfo] = useState(false);

  // Invite links: /join/CODE
  useEffect(() => {
    if (joinCode) {
      setTab(1);
      setSpaceDialog(true);
    }
  }, [joinCode]);

  useEffect(() => {
    const t = setTimeout(askNotificationPermission, 4000);
    return () => clearTimeout(t);
  }, []);

  // Keep the list tab in sync with the open chat
  useEffect(() => {
    if (active) setTab(active.type === "group" ? 1 : 0);
  }, [active?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android hardware back button / browser back closes the open chat on mobile
  useEffect(() => {
    if (isDesktop || !active) return;
    window.history.pushState({ kpChat: true }, "");
    const onPop = () => chat.closeChat();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!active, isDesktop]);

  const back = () => {
    if (!isDesktop && window.history.state?.kpChat) window.history.back();
    else chat.closeChat();
  };

  const openInfo = () => {
    if (!active) return;
    if (active.type === "group") setSpaceInfo(true);
    else setUserInfo(active.user);
  };

  const showList = isDesktop || !active;
  const showChat = isDesktop || !!active;

  return (
    <Box sx={{ position: "fixed", inset: 0, display: "flex", bgcolor: "background.default", overflow: "hidden" }}>
      {showList && (
        <Box sx={{ width: { xs: "100%", md: 360, lg: 400 }, flexShrink: 0, borderRight: { md: 1 }, borderColor: { md: "divider" }, height: "100%" }}>
          <Sidebar
            tab={tab}
            setTab={setTab}
            onNewChat={() => setPeople("chat")}
            onCallByEmail={() => setPeople("call")}
            onSpaceDialog={() => setSpaceDialog(true)}
            onMyProfile={() => setMyProfile(true)}
          />
        </Box>
      )}
      {showChat && (
        <Box sx={{ flex: 1, minWidth: 0, height: "100%" }}>
          {active ? (
            <ChatWindow key={chatKey(active.type, active.id)} onBack={back} onInfo={openInfo} />
          ) : (
            <Welcome onNewChat={() => setPeople("chat")} onSpace={() => setSpaceDialog(true)} />
          )}
        </Box>
      )}

      <PeopleDialog open={!!people} mode={people || "chat"} onClose={() => setPeople(null)} onOpened={() => setTab(0)} />
      <SpaceDialog
        open={spaceDialog}
        initialCode={joinCode || ""}
        onClose={() => {
          setSpaceDialog(false);
          if (joinCode) navigate("/", { replace: true });
        }}
        onDone={() => setTab(1)}
      />
      <MyProfile open={myProfile} onClose={() => setMyProfile(false)} />
      <UserInfo user={userInfo} open={!!userInfo} onClose={() => setUserInfo(null)} />
      {active?.type === "group" && (
        <SpaceInfo space={active.space} open={spaceInfo} onClose={() => setSpaceInfo(false)} onOpenUser={(u) => setUserInfo(u)} />
      )}
    </Box>
  );
}

function Welcome({ onNewChat, onSpace }) {
  return (
    <Box sx={{ height: "100%", display: "grid", placeItems: "center", bgcolor: "chat.wall", backgroundImage: (t) => `radial-gradient(${t.palette.chat.dot} 1.2px, transparent 1.2px)`, backgroundSize: "22px 22px", p: 4 }}>
      <Box sx={{ textAlign: "center", maxWidth: 440 }}>
        <Box component="img" src="/favicon.svg" alt="" sx={{ width: 84, height: 84, mb: 2, filter: "drop-shadow(0 12px 24px rgba(37,99,235,0.3))" }} />
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}><Logo size={34} /></Box>
        <Typography sx={{ color: "text.secondary", mb: 3.5, fontSize: 16 }}>
          Pick a conversation from the list, start a new chat, or bring your team together in a space.
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="contained" size="large" startIcon={<NewChatIcon />} onClick={onNewChat}>New chat</Button>
          <Button variant="outlined" size="large" startIcon={<AddIcon />} onClick={onSpace}>Create or join a space</Button>
        </Box>
        <Typography sx={{ mt: 5, fontSize: 13, color: "text.secondary", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
          <LockIcon sx={{ fontSize: 15 }} /> Calls are peer-to-peer encrypted
        </Typography>
      </Box>
    </Box>
  );
}
