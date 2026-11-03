// Lightweight browser notifications for when the app is in the background.
export const canNotify = () => typeof window !== "undefined" && "Notification" in window;

export const askNotificationPermission = () => {
  try {
    if (canNotify() && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  } catch {
    /* ignore */
  }
};

export const notify = (title, body, onClick) => {
  try {
    if (!canNotify() || Notification.permission !== "granted" || document.visibilityState === "visible") return;
    const n = new Notification(title, { body, icon: "/icons/icon-192.png", tag: title });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* ignore */
  }
};

let ctx = null;
export const playPing = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.06, t + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.2);
    });
  } catch {
    /* ignore */
  }
};
