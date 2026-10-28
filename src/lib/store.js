// Tournament state for the whole app: saved on this device, and sent to the
// server when the organizer is logged in. Players' pages poll the server.
import { useSyncExternalStore } from "react";
import { defaults, fix } from "./engine.js";

const KEY = "bt_tournament_v1";
const WATCH_KEY = "bt_watch_v1"; // players: the last scores seen, shown at once on the next visit
export const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
// Data from a removed draw feature, cleared from phones that still have it.
try { ["bt_vault", "bt_together", "bt_apart"].forEach(k => localStorage.removeItem(k)); } catch (e) {}

export const VIEW = /\/watch\/?$/.test(location.pathname) || /[?&]view=1/.test(location.search);
export const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
// The organizer page needs a PIN the server accepted ("local" is test mode on this computer).
const ADMIN = (lsGet("bt_admin") === "1" && !!lsGet("bt_pin")) || (LOCAL && lsGet("bt_admin") === "local");
export const LOGIN = !VIEW && !ADMIN;
export const getPin = () => lsGet("bt_pin") || "";

function load() {
  if (VIEW) { try { const r = localStorage.getItem(WATCH_KEY); if (r) return fix(JSON.parse(r)); } catch (e) {} return defaults(); }
  try { const r = localStorage.getItem(KEY); if (r) return fix(JSON.parse(r)); } catch (e) {}
  return defaults();
}

let S = load();
// live: status line for the organizer. updated: status line for players.
let snap = { S, live: "", updated: "", loaded: !VIEW || !!lsGet(WATCH_KEY) };
const listeners = new Set();
function emit(patch) {
  // Nothing new (a poll with the same scores): skip the redraw.
  if (S === snap.S && Object.keys(patch).every(k => snap[k] === patch[k])) return;
  snap = { ...snap, S, ...patch }; listeners.forEach(f => f());
}
const subscribe = f => { listeners.add(f); return () => listeners.delete(f); };
export const useStore = () => useSyncExternalStore(subscribe, () => snap);
export const getState = () => S;

// serverRev: the server revision this device last matched (null = never synced).
// dirty: this device has edits the server has not received.
let serverRev = lsGet("bt_rev") === null ? null : +lsGet("bt_rev");
let dirty = lsGet("bt_dirty") === "1", edits = 0;
function setSync(rev, d) {
  if (rev !== undefined) { serverRev = rev; lsSet("bt_rev", String(rev)); }
  dirty = d; lsSet("bt_dirty", d ? "1" : "");
}
const persist = () => lsSet(KEY, JSON.stringify(S));
const hhmm = () => new Date().toTimeString().slice(0, 5);
const setLive = live => emit({ live });

// All organizer edits go through here: fn changes a copy of the state.
export function update(fn) {
  if (VIEW || LOGIN) return;
  const n = structuredClone(S);
  fn(n);
  S = n; persist(); edits++; setSync(undefined, true);
  emit({ live: getPin() ? "Changes not sent yet" : snap.live });
  schedulePush();
}
export function replaceAll(state) {
  update(n => { for (const k of Object.keys(n)) delete n[k]; Object.assign(n, state); });
}
export const isDirty = () => dirty;

/* ---------- organizer login ---------- */
export async function login(pin) {
  if (!pin) return "Enter the PIN.";
  try {
    const r = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json", "x-pin": pin }, body: JSON.stringify({ check: true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.error || "The server could not check the PIN (error " + r.status + ").";
  } catch (e) { return "Could not reach the server. Check the internet connection."; }
  lsSet("bt_pin", pin); lsSet("bt_admin", "1"); location.reload();
  return "";
}
export function localMode() { if (LOCAL) { lsSet("bt_admin", "local"); location.reload(); } }
export function logout() {
  if (dirty && getPin() && !confirm("Some changes have not reached the server yet. They stay on this device. Log out anyway?")) return;
  lsSet("bt_pin", ""); lsSet("bt_admin", ""); location.reload();
}

/* ---------- sync ---------- */
let pushTimer = null, pushing = false, pushAgain = false, retryTimer = null, retryDelay = 5000;
function schedulePush() {
  if (VIEW || !getPin()) return;
  clearTimeout(pushTimer);
  // Short enough to feel instant on players' phones, long enough to send a burst of taps together.
  pushTimer = setTimeout(pushNow, 400);
}
function retryLater(fn) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(fn, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60000);
}
async function getServer() {
  const r = await fetch("/api/state?fresh=1", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "error " + r.status);
  return j;
}
function adopt(j, msg) {
  S = fix(j.state); persist(); setSync(j.rev, false);
  emit({ live: msg + " " + hhmm() });
}
// Another device saved since this one last synced and this device has its own edits.
function conflict(j) {
  if (j.state && confirm("Another device saved newer data on the server.\n\nOK: load the server copy. Changes on this device that were not sent are lost.\nCancel: replace the server copy with this device's data.")) {
    adopt(j, "Loaded from server at");
  } else { setSync(j.rev, true); pushNow(); }
}

// Checks the server before sending, so a device with old or empty data
// never overwrites newer scores without asking.
export async function sync() {
  if (VIEW || !getPin()) return;
  clearTimeout(retryTimer);
  let j;
  try { j = await getServer(); }
  catch (e) { setLive("Offline: " + e.message + ". Retrying"); retryLater(sync); return; }
  retryDelay = 5000;
  if (!j.state) { setSync(j.rev, true); return pushNow(); }
  if (j.rev === serverRev) return dirty ? pushNow() : setLive("Live · up to date " + hhmm());
  const same = JSON.stringify(fix(j.state)) === JSON.stringify(S);
  const blank = JSON.stringify(S) === JSON.stringify(defaults());
  if (same || blank || (serverRev !== null && !dirty)) adopt(j, "Live · loaded");
  else conflict(j);
}
export async function pushNow(leaving) {
  clearTimeout(pushTimer); clearTimeout(retryTimer);
  if (VIEW || !getPin()) return;
  if (serverRev === null) return sync();
  if (pushing) { pushAgain = true; return; }
  pushing = true;
  const sent = edits;
  setLive("Saving…");
  try {
    const r = await fetch("/api/state", { method: "POST", keepalive: leaving === true, headers: { "Content-Type": "application/json", "x-pin": getPin() }, body: JSON.stringify({ state: S, baseRev: serverRev }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      retryDelay = 5000;
      setSync(j.rev, edits !== sent);
      setLive(dirty ? "Saving…" : "Live · saved " + hhmm());
      if (dirty) schedulePush();
    } else if (r.status === 409) {
      if (leaving !== true) conflict(j);
    } else if (r.status === 401 || r.status === 429) {
      setLive("Not saved: " + (j.error || r.status));
    } else {
      setLive("Not saved: " + (j.error || r.status) + ". Retrying");
      retryLater(pushNow);
    }
  } catch (e) { setLive("Offline · retrying"); retryLater(pushNow); }
  pushing = false;
  if (pushAgain) { pushAgain = false; pushNow(); }
}
export async function pullNow() {
  try {
    const j = await getServer();
    if (!j.state) return setLive("Nothing is saved on the server yet");
    if (dirty && !confirm("Load the server copy? Changes on this device that were not sent are lost.")) return;
    adopt(j, "Loaded from server at");
  } catch (e) { setLive("Could not load (" + e.message + ")"); }
}

// The server answers from Vercel's edge cache, so frequent checks are cheap.
const POLL_MS = 3000;
let lastSig = "";
async function poll() {
  if (document.hidden) return;
  try {
    const r = await fetch("/api/state");
    const j = await r.json();
    if (j && j.state) {
      const sig = JSON.stringify(j.state);
      if (sig !== lastSig) { lastSig = sig; S = fix(j.state); lsSet(WATCH_KEY, sig); }
      emit({ updated: "Updated " + hhmm(), loaded: true });
    } else emit({ updated: "Waiting for the organizer", loaded: true });
  } catch (e) {
    // Local testing has no server: show the tournament saved on this computer.
    if (LOCAL) { try { const raw = localStorage.getItem(KEY); if (raw !== lastSig) { lastSig = raw; S = fix(JSON.parse(raw)); } emit({ updated: "Local test mode", loaded: true }); return; } catch (err) {} }
    emit({ updated: "No connection · retrying", loaded: true });
  }
}

export function start() {
  if (VIEW) {
    poll(); setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
    return;
  }
  if (LOGIN) return;
  if (getPin()) sync(); else setLive("Local test mode · saved on this computer only");
  // Send unsent scores before the page is closed or hidden, and when the connection returns.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && dirty && getPin() && serverRev !== null) pushNow(true);
  });
  window.addEventListener("online", () => { if (dirty && getPin()) pushNow(); });
}
