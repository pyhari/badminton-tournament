// The secret pairs, encrypted on this phone with a PIN only the organizer knows
// (AES-GCM, key from the PIN with PBKDF2). Nothing readable is stored, and nothing is
// sent to the server. Once opened with the PIN, the pairs stay in memory until the page
// is closed or reloaded.
import { lsGet, lsSet } from "./store.js";

const KEY = "bt_vault", OLD = ["bt_together", "bt_apart"]; // OLD: plain lists from before the PIN
let open = null; // { key, salt, data: { together, apart } }

const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const readOld = k => { try { return JSON.parse(lsGet(k) || "[]"); } catch (e) { return []; } };

async function keyFrom(pin, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function save() {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, open.key, new TextEncoder().encode(JSON.stringify(open.data)));
  lsSet(KEY, JSON.stringify({ salt: open.salt, iv: b64(iv), data: b64(new Uint8Array(data)) }));
}

export const hasVault = () => !!lsGet(KEY);
export const isOpen = () => !!open;
// Pairs exist but the PIN has not been entered since the page opened.
export const isLocked = () => hasVault() && !open;

// Opens the vault; false for a wrong PIN.
export async function openVault(pin) {
  try {
    const v = JSON.parse(lsGet(KEY));
    const key = await keyFrom(pin, unb64(v.salt));
    const text = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(v.iv) }, key, unb64(v.data));
    open = { key, salt: v.salt, data: JSON.parse(new TextDecoder().decode(text)) };
    return true;
  } catch (e) { return false; }
}
// Makes a new vault with this PIN, keeping any pairs already open (or saved before the PIN existed).
export async function createVault(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const data = open ? open.data : { together: readOld(OLD[0]), apart: readOld(OLD[1]) };
  open = { key: await keyFrom(pin, salt), salt: b64(salt), data };
  await save();
  OLD.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
}
export function eraseVault() {
  open = null;
  [KEY, ...OLD].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
}

export const getPairs = m => (open ? open.data[m] || [] : hasVault() ? [] : readOld(m === "together" ? OLD[0] : OLD[1]));
export async function setPairs(m, list) { open.data = { ...open.data, [m]: list }; await save(); }
