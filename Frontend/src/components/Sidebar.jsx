import { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, IconButton, Tooltip, InputBase, Tabs, Tab, Badge, List, ListItemButton,
  Fab, Menu, MenuItem, ListItemIcon, Divider, Skeleton, Chip, Button,
} from "@mui/material";
import {
  Search as SearchIcon, Close as CloseIcon, EditOutlined as NewChatIcon, MoreVert as MoreIcon,
  Add as AddIcon, DarkModeOutlined as DarkIcon, LightModeOutlined as LightIcon, Logout as LogoutIcon,
  PhoneOutlined as PhoneIcon, PersonOutlineOutlined as PersonIcon, DoneAll as DoneAllIcon, Done as DoneIcon,
  GroupsOutlined as GroupsIcon, ChatBubbleOutlineOutlined as ChatIcon, CloudOff as OfflineIcon,
} from "@mui/icons-material";
import { useChat } from "../state/ChatContext";
import { useAuth } from "../state/AuthContext";
import { useThemeMode } from "../state/ThemeContext";
import { UserAvatar, SpaceAvatar } from "./Avatars";
import { listTime, idOf } from "../lib/format";
import { API } from "../lib/api";
import Logo from "./Logo";

export default function Sidebar({ tab, setTab, onNewChat, onSpaceDialog, onMyProfile, onCallByEmail }) {
  const { user, logout } = useAuth();
  const { mode, setPref } = useThemeMode();
  const chat = useChat();
  const { conversations, spaces, active, online, typing, unreadChats, unreadSpaces, connected, listsLoaded } = chat;
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [menuEl, setMenuEl] = useState(null);

  const q = query.trim().toLowerCase();

  // Find new people to chat with while searching in the Chats tab
  useEffect(() => {
    if (tab !== 0 || q.length < 2) return setPeople([]);
    const t = setTimeout(() => {
      API.get("/auth/search-users", { params: { query: q } })
        .then((r) => setPeople(r.data || []))
        .catch(() => setPeople([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, tab]);

  const convs = useMemo(
    () => conversations.filter((c) => !q || c.user?.name?.toLowerCase().includes(q) || c.user?.email?.toLowerCase().includes(q)),
    [conversations, q]
  );
  const spaceList = useMemo(
    () => spaces.filter((s) => !q || s.name.toLowerCase().includes(q) || s.spaceId.toLowerCase().includes(q)),
    [spaces, q]
  );
  const newPeople = people.filter((p) => !conversations.some((c) => idOf(c.user) === idOf(p)));

  const typingText = (key) => {
    const t = typing[key];
    if (!t) return null;
    const names = Object.values(t);
    if (!names.length) return null;
    return key.startsWith("g:") ? `${names[0].split(" ")[0]} is typing…` : "typing…";
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper", position: "relative" }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: "calc(12px + env(safe-area-inset-top))", pb: 1, display: "flex", alignItems: "center", gap: 1.25 }}>
        <Tooltip title="My profile">
          <IconButton onClick={onMyProfile} sx={{ p: 0.25, borderRadius: "50%" }}>
            <UserAvatar user={user} size={38} />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Logo size={22} />
        </Box>
        {!connected && (
          <Tooltip title="Connecting to server…">
            <Chip size="small" icon={<OfflineIcon sx={{ fontSize: 16 }} />} label="Offline" color="warning" variant="outlined" />
          </Tooltip>
        )}
        <Tooltip title="Call by email">
          <IconButton onClick={onCallByEmail} aria-label="Call by email">
            <PhoneIcon />
          </IconButton>
        </Tooltip>
        <IconButton onClick={(e) => setMenuEl(e.currentTarget)} aria-label="More options">
          <MoreIcon />
        </IconButton>
        <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
          <MenuItem onClick={() => { setMenuEl(null); onMyProfile(); }}>
            <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>My profile
          </MenuItem>
          <MenuItem onClick={() => { setMenuEl(null); onSpaceDialog(); }}>
            <ListItemIcon><GroupsIcon fontSize="small" /></ListItemIcon>Create or join a space
          </MenuItem>
          <MenuItem onClick={() => { setPref(mode === "dark" ? "light" : "dark"); setMenuEl(null); }}>
            <ListItemIcon>{mode === "dark" ? <LightIcon fontSize="small" /> : <DarkIcon fontSize="small" />}</ListItemIcon>
            {mode === "dark" ? "Light mode" : "Dark mode"}
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setMenuEl(null); logout(); }} sx={{ color: "error.main" }}>
            <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>Log out
          </MenuItem>
        </Menu>
      </Box>

      {/* Search */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 42, borderRadius: 3, bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(148,163,184,0.1)" : "#eef2f7") }}>
          <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
          <InputBase
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 0 ? "Search chats or people" : "Search spaces"}
            sx={{ flex: 1, fontSize: 15 }}
            inputProps={{ "aria-label": "search" }}
          />
          {query && (
            <IconButton size="small" onClick={() => setQuery("")} aria-label="Clear search">
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 44, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 44, fontWeight: 700 } }}
      >
        <Tab label={<TabLabel text="Chats" count={unreadChats} />} />
        <Tab label={<TabLabel text="Spaces" count={unreadSpaces} />} />
      </Tabs>

      {/* List */}
      <List sx={{ flex: 1, overflowY: "auto", px: 1, py: 1, pb: 10 }}>
        {!listsLoaded && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}

        {listsLoaded && tab === 0 && (
          <>
            {convs.map((c) => {
              const id = idOf(c.user);
              const key = `p:${id}`;
              const isMine = c.lastMessage?.sender === user?._id;
              const typingNow = typingText(key);
              return (
                <ChatRow
                  key={id}
                  selected={active?.type === "personal" && active.id === id}
                  onClick={() => chat.openChat("personal", c.user)}
                  avatar={<UserAvatar user={c.user} online={!!online[id]} />}
                  title={c.user?.name || "Unknown"}
                  time={listTime(c.lastMessage?.createdAt)}
                  unread={c.unread}
                  subtitle={
                    typingNow ? (
                      <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>{typingNow}</Box>
                    ) : (
                      <>
                        {isMine && (c.lastMessage?.seen ? <DoneAllIcon sx={{ fontSize: 16, color: "primary.main", mr: 0.4, verticalAlign: "-3px" }} /> : <DoneIcon sx={{ fontSize: 16, mr: 0.4, verticalAlign: "-3px" }} />)}
                        {c.lastMessage?.text}
                      </>
                    )
                  }
                />
              );
            })}

            {q.length >= 2 && newPeople.length > 0 && (
              <>
                <SectionLabel>People</SectionLabel>
                {newPeople.map((p) => (
                  <ChatRow
                    key={p._id}
                    onClick={() => { chat.openChat("personal", p); setQuery(""); }}
                    avatar={<UserAvatar user={p} online={!!online[idOf(p)]} />}
                    title={p.name}
                    subtitle={p.email}
                  />
                ))}
              </>
            )}

            {convs.length === 0 && newPeople.length === 0 && (
              <EmptyState
                icon={<ChatIcon />}
                title={q ? "No matches" : "No conversations yet"}
                text={q ? "Try another name or email." : "Start a chat with anyone using their name or email."}
                action={!q && <Button variant="contained" startIcon={<NewChatIcon />} onClick={onNewChat}>New chat</Button>}
              />
            )}
          </>
        )}

        {listsLoaded && tab === 1 && (
          <>
            {spaceList.map((s) => {
              const key = `g:${s.spaceId}`;
              const typingNow = typingText(key);
              return (
                <ChatRow
                  key={s.spaceId}
                  selected={active?.type === "group" && active.id === s.spaceId}
                  onClick={() => chat.openChat("group", s)}
                  avatar={<SpaceAvatar space={s} />}
                  title={s.name}
                  time={listTime(s.lastMessage?.createdAt || s.createdAt)}
                  unread={s.unread}
                  subtitle={
                    typingNow ? (
                      <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>{typingNow}</Box>
                    ) : (
                      s.lastMessage?.text || `${s.memberCount} member${s.memberCount === 1 ? "" : "s"} · Code ${s.spaceId}`
                    )
                  }
                />
              );
            })}
            {spaceList.length === 0 && (
              <EmptyState
                icon={<GroupsIcon />}
                title={q ? "No matches" : "No spaces yet"}
                text={q ? "Try another name or code." : "Spaces are group rooms for your team. Create one or join with a room code."}
                action={!q && <Button variant="contained" startIcon={<AddIcon />} onClick={onSpaceDialog}>Create or join</Button>}
              />
            )}
          </>
        )}
      </List>

      <Fab
        color="primary"
        onClick={tab === 0 ? onNewChat : onSpaceDialog}
        aria-label={tab === 0 ? "New chat" : "Create or join space"}
        sx={{ position: "absolute", right: 20, bottom: "calc(20px + env(safe-area-inset-bottom))", borderRadius: "18px", boxShadow: "0 10px 24px rgba(37,99,235,0.35)" }}
      >
        {tab === 0 ? <NewChatIcon /> : <AddIcon />}
      </Fab>
    </Box>
  );
}

function TabLabel({ text, count }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {text}
      {count > 0 && (
        <Box sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 10, bgcolor: "primary.main", color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center" }}>
          {count > 99 ? "99+" : count}
        </Box>
      )}
    </Box>
  );
}

export function ChatRow({ avatar, title, subtitle, time, unread, selected, onClick, trailing }) {
  return (
    <ListItemButton
      selected={!!selected}
      onClick={onClick}
      sx={{
        gap: 1.5,
        py: 1.1,
        px: 1.25,
        mb: 0.25,
        "&.Mui-selected": { bgcolor: "chat.selected" },
        "&.Mui-selected:hover": { bgcolor: "chat.selected" },
      }}
    >
      {avatar}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography noWrap sx={{ flex: 1, fontWeight: unread ? 800 : 650, fontSize: 15 }}>
            {title}
          </Typography>
          {time && (
            <Typography sx={{ fontSize: 12, color: unread ? "primary.main" : "text.secondary", fontWeight: unread ? 700 : 500, flexShrink: 0 }}>
              {time}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
          <Typography noWrap component="div" sx={{ flex: 1, fontSize: 13.5, color: unread ? "text.primary" : "text.secondary", fontWeight: unread ? 600 : 400 }}>
            {subtitle}
          </Typography>
          {unread > 0 && (
            <Badge badgeContent={unread > 99 ? "99+" : unread} color="primary" sx={{ "& .MuiBadge-badge": { position: "static", transform: "none", fontWeight: 800 } }} />
          )}
          {trailing}
        </Box>
      </Box>
    </ListItemButton>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography sx={{ px: 1.5, pt: 2, pb: 0.5, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "text.secondary" }}>
      {children}
    </Typography>
  );
}

function RowSkeleton() {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", px: 1.5, py: 1.2 }}>
      <Skeleton variant="circular" width={44} height={44} />
      <Box sx={{ flex: 1 }}>
        <Skeleton width="50%" />
        <Skeleton width="80%" />
      </Box>
    </Box>
  );
}

export function EmptyState({ icon, title, text, action }) {
  return (
    <Box sx={{ textAlign: "center", px: 3, py: 6, color: "text.secondary" }}>
      <Box sx={{ width: 64, height: 64, mx: "auto", mb: 2, borderRadius: "20px", display: "grid", placeItems: "center", bgcolor: "chat.selected", color: "primary.main", "& svg": { fontSize: 30 } }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 800, color: "text.primary", mb: 0.5 }}>{title}</Typography>
      <Typography sx={{ fontSize: 14, mb: action ? 2.5 : 0 }}>{text}</Typography>
      {action}
    </Box>
  );
}
