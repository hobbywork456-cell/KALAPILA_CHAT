import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, CircularProgress, Fab, Badge, Zoom } from "@mui/material";
import { KeyboardArrowDown as DownIcon, WavingHand as WaveIcon } from "@mui/icons-material";
import MessageBubble from "./MessageBubble";
import { dayLabel, idOf } from "../../lib/format";

const GAP_MS = 5 * 60 * 1000;

export default function MessageList({ chatKey, state, me, isGroup, typingNames, onLoadOlder, onReply, onEdit, onDelete, onOpenMedia, onRetry, onDiscard, emptyHint }) {
  const ref = useRef(null);
  const atBottom = useRef(true);
  const prevInfo = useRef({ key: null, firstId: null, lastId: null, height: 0, count: 0 });
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [highlight, setHighlight] = useState(null);

  const messages = useMemo(() => state?.messages || [], [state?.messages]);

  // Decide day separators and bubble grouping once per message list
  const rows = useMemo(() => {
    const out = [];
    let lastDay = null;
    const t = (m) => new Date(m.createdAt || 0).getTime();
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const d = new Date(m.createdAt || 0).toDateString();
      const newDay = d !== lastDay;
      lastDay = d;
      const sameSender = !!prev && !prev.system && !m.system && !newDay && idOf(prev.sender) === idOf(m.sender) && t(m) - t(prev) < GAP_MS;
      const nextSame = !!next && !next.system && !m.system && idOf(next.sender) === idOf(m.sender) && new Date(next.createdAt || 0).toDateString() === d && t(next) - t(m) < GAP_MS;
      out.push({ m, newDay, sameSender, nextSame });
    });
    return out;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewCount(0);
  }, []);

  // Keep scroll position sensible when messages change
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = prevInfo.current;
    const firstId = messages[0]?._id;
    const last = messages[messages.length - 1];
    const lastId = last?._id;

    if (prev.key !== chatKey) {
      el.scrollTop = el.scrollHeight; // opened a chat
      atBottom.current = true;
      setNewCount(0);
    } else if (prev.firstId && firstId !== prev.firstId && lastId === prev.lastId) {
      el.scrollTop += el.scrollHeight - prev.height; // older messages prepended
    } else if (lastId !== prev.lastId && messages.length >= prev.count) {
      const mineNow = last && idOf(last.sender) === me;
      if (atBottom.current || mineNow) el.scrollTop = el.scrollHeight;
      else if (last && !last.system) setNewCount((n) => n + 1);
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevInfo.current = { key: chatKey, firstId, lastId, height: el.scrollHeight, count: messages.length };
  }, [messages, chatKey, me]);

  // Images load after render and change height – stay pinned to bottom
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLoad = () => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    };
    el.addEventListener("load", onLoad, true);
    return () => el.removeEventListener("load", onLoad, true);
  }, []);

  useEffect(() => {
    if (atBottom.current && typingNames?.length) ref.current && (ref.current.scrollTop = ref.current.scrollHeight);
  }, [typingNames?.length]);

  const onScroll = () => {
    const el = ref.current;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottom.current = dist < 120;
    setShowJump(dist > 400);
    if (atBottom.current) setNewCount(0);
    if (el.scrollTop < 150 && state?.hasMore && !state?.loading) onLoadOlder?.();
  };

  const jumpTo = useCallback((id) => {
    const node = document.getElementById(`msg-${id}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(id);
      setTimeout(() => setHighlight(null), 1600);
    }
  }, []);

  return (
    <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
      <Box
        ref={ref}
        onScroll={onScroll}
        sx={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          overflowX: "hidden",
          py: 1.5,
          bgcolor: "chat.wall",
          backgroundImage: (t) => `radial-gradient(${t.palette.chat.dot} 1.2px, transparent 1.2px)`,
          backgroundSize: "22px 22px",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {state?.loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {state?.loaded && !state?.hasMore && messages.length > 0 && (
          <Typography sx={{ textAlign: "center", fontSize: 12, color: "text.secondary", py: 1.5 }}>
            This is the beginning of your conversation
          </Typography>
        )}
        {state?.loaded && messages.length === 0 && (
          <Box sx={{ height: "80%", display: "grid", placeItems: "center", textAlign: "center", px: 3 }}>
            <Box>
              <Box sx={{ width: 72, height: 72, mx: "auto", mb: 2, borderRadius: "24px", display: "grid", placeItems: "center", bgcolor: "background.paper", color: "primary.main", boxShadow: "0 6px 18px rgba(15,23,42,0.08)" }}>
                <WaveIcon sx={{ fontSize: 34 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>No messages yet</Typography>
              <Typography sx={{ color: "text.secondary", fontSize: 14 }}>{emptyHint}</Typography>
            </Box>
          </Box>
        )}

        {rows.map(({ m, newDay, sameSender, nextSame }) => {
          const mine = idOf(m.sender) === me;
          return (
            <Fragment key={m.clientId || m._id}>
              {newDay && (
                <Box sx={{ display: "flex", justifyContent: "center", my: 1.5, position: "sticky", top: 4, zIndex: 2 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, px: 1.5, py: 0.5, borderRadius: 10, bgcolor: "background.paper", color: "text.secondary", boxShadow: "0 1px 3px rgba(15,23,42,0.1)" }}>
                    {dayLabel(m.createdAt || 0)}
                  </Typography>
                </Box>
              )}
              <MessageBubble
                msg={m}
                mine={mine}
                isGroup={isGroup}
                showName={!sameSender}
                showAvatar={!nextSame}
                highlighted={highlight === m._id}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onOpenMedia={onOpenMedia}
                onJumpTo={jumpTo}
                onRetry={onRetry}
                onDiscard={onDiscard}
              />
            </Fragment>
          );
        })}

        {typingNames?.length > 0 && (
          <Box sx={{ px: { xs: 1, sm: 2 }, mt: 1, display: "flex" }}>
            <Box sx={{ bgcolor: "chat.theirs", borderRadius: "18px 18px 18px 6px", px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1, boxShadow: "0 1px 1.5px rgba(15,23,42,0.08)" }}>
              <TypingDots />
              {isGroup && <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{typingNames.map((n) => n.split(" ")[0]).join(", ")}</Typography>}
            </Box>
          </Box>
        )}
        <Box sx={{ height: 8 }} />
      </Box>

      <Zoom in={showJump || newCount > 0}>
        <Fab size="small" onClick={() => scrollToBottom(true)} aria-label="Jump to latest" sx={{ position: "absolute", right: 16, bottom: 16, bgcolor: "background.paper", color: "text.primary", "&:hover": { bgcolor: "background.paper" } }}>
          <Badge badgeContent={newCount} color="primary">
            <DownIcon />
          </Badge>
        </Fab>
      </Zoom>
    </Box>
  );
}

function TypingDots() {
  return (
    <Box sx={{ display: "flex", gap: 0.5, "& span": { width: 7, height: 7, borderRadius: "50%", bgcolor: "text.secondary", animation: "kpDot 1.2s infinite ease-in-out" }, "& span:nth-of-type(2)": { animationDelay: ".15s" }, "& span:nth-of-type(3)": { animationDelay: ".3s" }, "@keyframes kpDot": { "0%, 60%, 100%": { opacity: 0.3, transform: "translateY(0)" }, "30%": { opacity: 1, transform: "translateY(-3px)" } } }}>
      <span /><span /><span />
    </Box>
  );
}
