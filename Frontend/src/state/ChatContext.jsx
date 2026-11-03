import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { API, errorMessage, uploadFile } from "../lib/api";
import { connectSocket, emitAck } from "../lib/socket";
import { idOf, previewOf } from "../lib/format";
import { notify, playPing } from "../lib/notify";
import { useAuth } from "./AuthContext";

const ChatContext = createContext(null);

export const chatKey = (type, id) => `${type === "group" ? "g" : "p"}:${String(id)}`;
const PAGE = 40;

const keyForMessage = (m, me) => {
  if (m.chatType === "group") return chatKey("group", m.spaceId);
  const partner = idOf(m.sender) === me ? idOf(m.receiver) : idOf(m.sender);
  return chatKey("personal", partner);
};

const upsertMessage = (list, msg) => {
  const i = list.findIndex(
    (x) => x._id === msg._id || (msg.clientId && x.clientId === msg.clientId && x.pending)
  );
  if (i === -1) {
    const next = [...list, msg];
    // keep chronological order (scheduled releases / late arrivals)
    if (list.length && new Date(msg.createdAt) < new Date(list[list.length - 1].createdAt || Date.now())) {
      next.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }
    return next;
  }
  const next = [...list];
  next[i] = { ...msg, clientId: list[i].clientId || msg.clientId };
  return next;
};

let clientSeq = 0;
const newClientId = () => `c${Date.now().toString(36)}${(clientSeq++).toString(36)}`;

export function ChatProvider({ children }) {
  const { token, user, logout } = useAuth();
  const me = user?._id;

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [listsLoaded, setListsLoaded] = useState(false);
  const [active, setActive] = useState(null); // { type, id, user?, space? }
  const [chats, setChats] = useState({}); // key -> { messages, hasMore, loading, loaded }
  const [online, setOnline] = useState({}); // userId -> true
  const [lastSeen, setLastSeen] = useState({}); // userId -> date
  const [typing, setTyping] = useState({}); // key -> { userId: name }
  const [membersVersion, setMembersVersion] = useState(0);

  const activeRef = useRef(active);
  const meRef = useRef(me);
  const chatsRef = useRef(chats);
  const typingTimers = useRef({});
  const sendFileRef = useRef(null);
  const readTimer = useRef(null);
  useEffect(() => void (activeRef.current = active), [active]);
  useEffect(() => void (meRef.current = me), [me]);
  useEffect(() => void (chatsRef.current = chats), [chats]);
  const spacesRef = useRef(spaces);
  const conversationsRef = useRef(conversations);
  useEffect(() => void (spacesRef.current = spaces), [spaces]);
  useEffect(() => void (conversationsRef.current = conversations), [conversations]);

  const patchChat = useCallback((key, fn) => {
    setChats((prev) => {
      const cur = prev[key] || { messages: [], hasMore: false, loading: false, loaded: false };
      return { ...prev, [key]: { ...cur, ...fn(cur) } };
    });
  }, []);

  // ------------------------------------------------------------------ lists
  const refreshConversations = useCallback(async () => {
    try {
      const r = await API.get("/messages/conversations");
      setConversations(r.data || []);
    } catch (e) {
      console.warn("conversations", e);
    }
  }, []);

  const refreshSpaces = useCallback(async () => {
    try {
      const r = await API.get("/spaces/mine");
      setSpaces(r.data || []);
      setActive((a) => {
        if (a?.type !== "group") return a;
        const s = (r.data || []).find((x) => x.spaceId === a.id);
        return s ? { ...a, space: s } : a;
      });
    } catch (e) {
      console.warn("spaces", e);
    }
  }, []);

  // ------------------------------------------------------------------ read receipts
  const markRead = useCallback(
    (chat = activeRef.current) => {
      if (!chat) return;
      if (chat.type === "group") {
        setSpaces((prev) => prev.map((s) => (s.spaceId === chat.id ? { ...s, unread: 0 } : s)));
      } else {
        setConversations((prev) => prev.map((c) => (idOf(c.user) === chat.id ? { ...c, unread: 0 } : c)));
      }
      clearTimeout(readTimer.current);
      readTimer.current = setTimeout(() => {
        API.post("/messages/read", { chatType: chat.type, id: chat.id }).catch(() => {});
      }, 250);
    },
    []
  );

  // ------------------------------------------------------------------ history
  const loadHistory = useCallback(
    async (chat, { older = false } = {}) => {
      const key = chatKey(chat.type, chat.id);
      const cur = chatsRef.current[key];
      if (cur?.loading) return;
      if (older && (!cur?.hasMore || !cur.messages.length)) return;
      patchChat(key, () => ({ loading: true }));
      try {
        const before = older ? cur.messages.find((m) => !m.pending)?.createdAt : undefined;
        const path = chat.type === "group" ? `/messages/space/${chat.id}` : `/messages/dm/${chat.id}`;
        const r = await API.get(path, { params: { limit: PAGE, before } });
        patchChat(key, (c) => {
          const fetched = r.data.messages || [];
          let messages;
          if (older) {
            const ids = new Set(c.messages.map((m) => m._id));
            messages = [...fetched.filter((m) => !ids.has(m._id)), ...c.messages];
          } else {
            const pending = c.messages.filter((m) => m.pending);
            messages = [...fetched, ...pending];
          }
          return { messages, hasMore: r.data.hasMore, loading: false, loaded: true };
        });
      } catch (e) {
        patchChat(key, () => ({ loading: false }));
        toast.error(errorMessage(e, "Could not load messages."));
      }
    },
    [patchChat]
  );

  const openChat = useCallback(
    (type, target) => {
      if (!target) return setActive(null);
      const id = type === "group" ? target.spaceId : idOf(target);
      const chat = { type, id, ...(type === "group" ? { space: target } : { user: target }) };
      setActive(chat);
      const key = chatKey(type, id);
      if (!chatsRef.current[key]?.loaded) loadHistory(chat);
      markRead(chat);
    },
    [loadHistory, markRead]
  );

  const closeChat = useCallback(() => setActive(null), []);

  // ------------------------------------------------------------------ conversation preview helpers
  const bumpConversation = useCallback((msg, partnerUser, { incUnread = false } = {}) => {
    const partnerId = idOf(partnerUser);
    setConversations((prev) => {
      const existing = prev.find((c) => idOf(c.user) === partnerId);
      const entry = {
        user: existing?.user || partnerUser,
        lastMessage: {
          _id: msg._id,
          text: previewOf(msg),
          createdAt: msg.createdAt || new Date().toISOString(),
          sender: idOf(msg.sender),
          seen: !!msg.seen,
        },
        unread: (existing?.unread || 0) + (incUnread ? 1 : 0),
      };
      return [entry, ...prev.filter((c) => idOf(c.user) !== partnerId)];
    });
  }, []);

  const bumpSpace = useCallback((msg, { incUnread = false } = {}) => {
    setSpaces((prev) => {
      const s = prev.find((x) => x.spaceId === msg.spaceId);
      if (!s) return prev;
      const who = msg.system ? "" : `${idOf(msg.sender) === meRef.current ? "You" : msg.sender?.name?.split(" ")[0] || "Someone"}: `;
      const updated = {
        ...s,
        lastMessage: { text: msg.system ? msg.message : who + previewOf(msg), createdAt: msg.createdAt },
        unread: (s.unread || 0) + (incUnread ? 1 : 0),
      };
      return [updated, ...prev.filter((x) => x.spaceId !== msg.spaceId)];
    });
  }, []);

  // ------------------------------------------------------------------ socket lifecycle
  useEffect(() => {
    if (!token) return;
    const s = connectSocket(token);
    setSocket(s);

    const onConnect = () => {
      setConnected(true);
      refreshConversations();
      refreshSpaces();
      setListsLoaded(true);
      // Re-sync the open chat in case we missed messages while offline
      const a = activeRef.current;
      if (a && chatsRef.current[chatKey(a.type, a.id)]?.loaded) loadHistory(a);
    };
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err) => {
      setConnected(false);
      if (err?.message === "unauthorized") {
        toast.error("Your session has expired. Please sign in again.");
        logout();
      }
    };

    const onReady = ({ online: list }) => {
      const map = {};
      (list || []).forEach((id) => (map[id] = true));
      setOnline(map);
    };

    const onPresence = ({ userId, online: isOn, lastSeen: ls }) => {
      setOnline((p) => {
        const n = { ...p };
        if (isOn) n[userId] = true;
        else delete n[userId];
        return n;
      });
      if (ls) setLastSeen((p) => ({ ...p, [userId]: ls }));
    };

    const onNew = (msg) => {
      const myId = meRef.current;
      const key = keyForMessage(msg, myId);
      const fromMe = idOf(msg.sender) === myId;
      const a = activeRef.current;
      const isActive = a && chatKey(a.type, a.id) === key;
      const visible = document.visibilityState === "visible";

      if (chatsRef.current[key]?.loaded) {
        patchChat(key, (c) => ({ messages: upsertMessage(c.messages, msg) }));
      }

      const countUnread = !fromMe && !msg.system && !(isActive && visible);
      if (msg.chatType === "group") bumpSpace(msg, { incUnread: countUnread });
      else {
        const rid = idOf(msg.receiver);
        const partner = fromMe
          ? conversationsRef.current.find((c) => idOf(c.user) === rid)?.user ||
            (a?.type === "personal" && a.id === rid ? a.user : null)
          : msg.sender;
        if (partner) bumpConversation(msg, partner, { incUnread: countUnread });
        else refreshConversations();
      }

      if (!fromMe && !msg.system) {
        // clear typing indicator for this sender
        setTyping((t) => {
          if (!t[key]?.[idOf(msg.sender)]) return t;
          const n = { ...t, [key]: { ...t[key] } };
          delete n[key][idOf(msg.sender)];
          return n;
        });
        if (isActive && visible) {
          markRead(a);
        } else {
          playPing();
          const title = msg.chatType === "group" ? `${msg.sender?.name} · ${spacesRef.current.find((x) => x.spaceId === msg.spaceId)?.name || "Space"}` : msg.sender?.name || "New message";
          notify(title, previewOf(msg));
          if (!isActive && visible) {
            toast(title, { description: previewOf(msg).slice(0, 80), duration: 3000 });
          }
        }
      }
      if (!fromMe && msg.chatType !== "group" && !conversationsRef.current.some((c) => idOf(c.user) === idOf(msg.sender))) {
        // new person messaged us – fetch full list for accurate user info
        refreshConversations();
      }
    };

    const onUpdated = (msg) => {
      const key = keyForMessage(msg, meRef.current);
      if (chatsRef.current[key]?.loaded) {
        patchChat(key, (c) => ({ messages: c.messages.map((m) => (m._id === msg._id ? { ...m, ...msg } : m)) }));
      }
      if (msg.chatType !== "group") {
        setConversations((prev) =>
          prev.map((c) => (c.lastMessage?._id === msg._id ? { ...c, lastMessage: { ...c.lastMessage, text: previewOf(msg) } } : c))
        );
      }
    };

    const onRead = ({ by }) => {
      const key = chatKey("personal", by);
      patchChat(key, (c) => ({
        messages: c.messages.map((m) => (idOf(m.sender) === meRef.current ? { ...m, seen: true } : m)),
      }));
      setConversations((prev) =>
        prev.map((c) => (idOf(c.user) === by && c.lastMessage?.sender === meRef.current ? { ...c, lastMessage: { ...c.lastMessage, seen: true } } : c))
      );
    };

    const onTyping = ({ chatType, from, name, isTyping, spaceId }) => {
      const key = chatType === "group" ? chatKey("group", spaceId) : chatKey("personal", from);
      const tk = `${key}|${from}`;
      clearTimeout(typingTimers.current[tk]);
      setTyping((t) => {
        const n = { ...t, [key]: { ...(t[key] || {}) } };
        if (isTyping) n[key][from] = name || "Someone";
        else delete n[key][from];
        return n;
      });
      if (isTyping) {
        typingTimers.current[tk] = setTimeout(() => onTyping({ chatType, from, name, isTyping: false, spaceId }), 5000);
      }
    };

    const onMembersChanged = () => {
      setMembersVersion((v) => v + 1);
      refreshSpaces();
    };
    const onSpaceRemoved = ({ spaceId, deleted }) => {
      setSpaces((prev) => prev.filter((s) => s.spaceId !== spaceId));
      if (activeRef.current?.type === "group" && activeRef.current.id === spaceId) {
        setActive(null);
        toast.info(deleted ? "This space was deleted by an admin." : "You are no longer a member of this space.");
      }
    };
    const onSpaceUpdated = ({ spaceId, name, description }) => {
      setSpaces((prev) => prev.map((s) => (s.spaceId === spaceId ? { ...s, name, description } : s)));
      setActive((a) => (a?.type === "group" && a.id === spaceId ? { ...a, space: { ...a.space, name, description } } : a));
    };
    const onUserUpdated = (u) => {
      setConversations((prev) => prev.map((c) => (idOf(c.user) === idOf(u) ? { ...c, user: { ...c.user, ...u } } : c)));
      setActive((a) => (a?.type === "personal" && a.id === idOf(u) ? { ...a, user: { ...a.user, ...u } } : a));
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    s.on("ready", onReady);
    s.on("presence", onPresence);
    s.on("message:new", onNew);
    s.on("message:updated", onUpdated);
    s.on("messages:read", onRead);
    s.on("typing", onTyping);
    s.on("space:members-changed", onMembersChanged);
    s.on("space:removed", onSpaceRemoved);
    s.on("space:updated", onSpaceUpdated);
    s.on("user:updated", onUserUpdated);
    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      s.off("ready", onReady);
      s.off("presence", onPresence);
      s.off("message:new", onNew);
      s.off("message:updated", onUpdated);
      s.off("messages:read", onRead);
      s.off("typing", onTyping);
      s.off("space:members-changed", onMembersChanged);
      s.off("space:removed", onSpaceRemoved);
      s.off("space:updated", onSpaceUpdated);
      s.off("user:updated", onUserUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);


  // Mark active chat read when the app comes back to the foreground
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && activeRef.current) markRead(activeRef.current);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markRead]);

  // ------------------------------------------------------------------ sending
  const pendingBase = (chat, extra) => ({
    _id: extra.clientId,
    clientId: extra.clientId,
    pending: true,
    chatType: chat.type,
    spaceId: chat.type === "group" ? chat.id : "",
    receiver: chat.type === "personal" ? chat.id : null,
    sender: { _id: me, name: user?.name, profilePic: user?.profilePic },
    createdAt: new Date().toISOString(),
    fileType: "text",
    message: "",
    ...extra,
  });

  const finishSend = useCallback(
    (key, clientId, res) => {
      if (res.ok && res.message) {
        patchChat(key, (c) => ({ messages: upsertMessage(c.messages, { ...res.message, clientId }) }));
      } else {
        patchChat(key, (c) => ({
          messages: c.messages.map((m) => (m.clientId === clientId ? { ...m, failed: true, error: res.error } : m)),
        }));
        toast.error(res.error || "Message not sent.");
      }
    },
    [patchChat]
  );

  const sendText = useCallback(
    async (text, replyTo = null, chat = activeRef.current) => {
      if (!chat || !text.trim()) return;
      const key = chatKey(chat.type, chat.id);
      const clientId = newClientId();
      const pending = pendingBase(chat, { clientId, message: text.trim(), replyTo });
      patchChat(key, (c) => ({ messages: [...c.messages, pending] }));
      const res = await emitAck("sendMessage", {
        chatType: chat.type,
        to: chat.id,
        message: text.trim(),
        replyTo: replyTo?._id,
        clientId,
      });
      finishSend(key, clientId, res);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchChat, finishSend, me, user]
  );

  const sendFile = useCallback(
    async (file, { replyTo = null, caption = "" } = {}, chat = activeRef.current) => {
      if (!chat || !file) return;
      const key = chatKey(chat.type, chat.id);
      const clientId = newClientId();
      const mime = file.type || "";
      const kind = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "file";
      const localUrl = URL.createObjectURL(file);
      const pending = pendingBase(chat, {
        clientId,
        fileType: kind,
        fileUrl: localUrl,
        localFile: true,
        fileName: file.name,
        fileSize: file.size,
        mimeType: mime,
        message: caption,
        progress: 0,
        replyTo,
        retry: () => sendFileRef.current(file, { replyTo, caption }, chat),
      });
      patchChat(key, (c) => ({ messages: [...c.messages, pending] }));
      try {
        const up = await uploadFile(file, (p) =>
          patchChat(key, (c) => ({ messages: c.messages.map((m) => (m.clientId === clientId ? { ...m, progress: p } : m)) }))
        );
        const res = await emitAck("sendMessage", {
          chatType: chat.type,
          to: chat.id,
          message: caption,
          fileUrl: up.url,
          fileType: up.fileType,
          fileName: up.fileName,
          fileSize: up.fileSize,
          mimeType: up.mimeType,
          replyTo: replyTo?._id,
          clientId,
        });
        finishSend(key, clientId, res);
      } catch (e) {
        finishSend(key, clientId, { ok: false, error: errorMessage(e, "Upload failed.") });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patchChat, finishSend, me, user]
  );
  useEffect(() => {
    sendFileRef.current = sendFile;
  }, [sendFile]);

  const retryMessage = useCallback(
    (msg) => {
      const chat = activeRef.current;
      if (!chat) return;
      const key = chatKey(chat.type, chat.id);
      patchChat(key, (c) => ({ messages: c.messages.filter((m) => m.clientId !== msg.clientId) }));
      if (msg.retry) msg.retry();
      else sendText(msg.message, msg.replyTo, chat);
    },
    [patchChat, sendText]
  );

  const discardMessage = useCallback(
    (msg) => {
      const chat = activeRef.current;
      if (!chat) return;
      patchChat(chatKey(chat.type, chat.id), (c) => ({ messages: c.messages.filter((m) => m.clientId !== msg.clientId) }));
    },
    [patchChat]
  );

  const editMessage = useCallback(async (messageId, text) => {
    const res = await emitAck("editMessage", { messageId, message: text });
    if (!res.ok) toast.error(res.error || "Could not edit message.");
    return res.ok;
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    const res = await emitAck("deleteMessage", { messageId });
    if (!res.ok) toast.error(res.error || "Could not delete message.");
    return res.ok;
  }, []);

  const scheduleMessage = useCallback(async (text, when, chat = activeRef.current) => {
    if (!chat) return false;
    const res = await emitAck("sendMessage", {
      chatType: chat.type,
      to: chat.id,
      message: text,
      scheduledTime: new Date(when).toISOString(), // converted in the user's own timezone
    });
    if (res.ok) {
      toast.success(`Scheduled for ${new Date(when).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`);
    } else toast.error(res.error || "Could not schedule message.");
    return res.ok;
  }, []);

  const typingState = useRef({ key: null, at: 0, timer: null });
  const sendTyping = useCallback(() => {
    const chat = activeRef.current;
    const s = typingState.current;
    if (!chat || !socket?.connected) return;
    const key = chatKey(chat.type, chat.id);
    const now = Date.now();
    if (s.key !== key || now - s.at > 2500) {
      socket.emit("typing", { chatType: chat.type, to: chat.id, isTyping: true });
      s.key = key;
      s.at = now;
    }
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      socket.emit("typing", { chatType: chat.type, to: chat.id, isTyping: false });
      s.key = null;
    }, 3000);
  }, [socket]);

  // Unread totals for tab badges / page title
  const unreadChats = conversations.reduce((n, c) => n + (c.unread || 0), 0);
  const unreadSpaces = spaces.reduce((n, s) => n + (s.unread || 0), 0);
  useEffect(() => {
    const total = unreadChats + unreadSpaces;
    document.title = total ? `(${total}) Kalapila` : "Kalapila";
  }, [unreadChats, unreadSpaces]);

  const value = useMemo(
    () => ({
      me,
      socket,
      connected,
      conversations,
      spaces,
      listsLoaded,
      active,
      chats,
      online,
      lastSeen,
      typing,
      membersVersion,
      unreadChats,
      unreadSpaces,
      openChat,
      closeChat,
      loadHistory,
      sendText,
      sendFile,
      retryMessage,
      discardMessage,
      editMessage,
      deleteMessage,
      scheduleMessage,
      sendTyping,
      markRead,
      refreshConversations,
      refreshSpaces,
      setSpaces,
    }),
    [me, socket, connected, conversations, spaces, listsLoaded, active, chats, online, lastSeen, typing, membersVersion, unreadChats, unreadSpaces, openChat, closeChat, loadHistory, sendText, sendFile, retryMessage, discardMessage, editMessage, deleteMessage, scheduleMessage, sendTyping, markRead, refreshConversations, refreshSpaces]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => useContext(ChatContext);
