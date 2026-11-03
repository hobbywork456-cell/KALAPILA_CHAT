const sameDay = (a, b) => a.toDateString() === b.toDateString();

export const timeOf = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const listTime = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  if (sameDay(date, now)) return timeOf(date);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(date, y)) return "Yesterday";
  if (now - date < 6 * 86400000) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "numeric", month: "short" });
};

export const dayLabel = (d) => {
  const date = new Date(d);
  const now = new Date();
  if (sameDay(date, now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(date, y)) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
};

export const lastSeenText = (d) => {
  if (!d) return "offline";
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return "last seen just now";
  if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)} min ago`;
  if (sameDay(date, new Date())) return `last seen today at ${timeOf(date)}`;
  return `last seen ${listTime(date)}${diff < 6 * 86400000 ? ` at ${timeOf(date)}` : ""}`;
};

export const fileSize = (n) => {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const duration = (secs) => {
  secs = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
};

const PALETTE = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4f46e5", "#c026d3", "#0d9488", "#dc2626"];
export const colorFor = (seed = "") => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "?";

export const previewOf = (m) => {
  if (!m) return "";
  if (m.deleted) return "🚫 Message deleted";
  switch (m.fileType) {
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "audio": return "🎤 Voice message";
    case "file": return `📎 ${m.fileName || "File"}`;
    default: return m.message || "";
  }
};

export const idOf = (v) => (v?._id || v)?.toString();
