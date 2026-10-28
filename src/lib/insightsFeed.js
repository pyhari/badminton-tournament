// The AI story and match recaps for the players' page, read from /api/insights.
// Checked every 30 seconds while the page is open; the words change only when results do.
import { useSyncExternalStore } from "react";
import { VIEW } from "./store.js";

/* global __APP_ENV__ */
// The AI recaps, story and playoff race are on preview and local builds only, for now.
export const AI_INSIGHTS = __APP_ENV__ !== "production";

const POLL_MS = 30000;
let data = null, raw = "", timer = null;
const listeners = new Set();

async function load() {
  if (document.hidden) return;
  try {
    const r = await fetch("/api/insights");
    if (!r.ok) return;
    const text = await r.text();
    if (text === raw) return;
    raw = text;
    const j = JSON.parse(text);
    // Switched off on the server: stop asking.
    if (j.off) { clearInterval(timer); return; }
    data = j;
    listeners.forEach(f => f());
  } catch (e) { /* no server (local test mode) or offline: show nothing */ }
}

export function startInsights() {
  if (!VIEW || !AI_INSIGHTS || timer) return;
  load();
  timer = setInterval(load, POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
}

const subscribe = f => { listeners.add(f); return () => listeners.delete(f); };
export const useInsights = () => useSyncExternalStore(subscribe, () => data);
export const useReasons = () => useSyncExternalStore(subscribe, () => (data && data.reasons) || null);
export const useForecast = () => useSyncExternalStore(subscribe, () => (data && data.forecast) || null);
export const useRecap = id => useSyncExternalStore(subscribe, () => (data && data.recaps && data.recaps[id]) || null);
