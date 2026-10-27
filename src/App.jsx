import { useCallback, useState } from "react";
import { CalendarDays, ListOrdered, Trophy, UserRound, Settings2, Sun, Moon } from "lucide-react";
import { useStore, VIEW, LOGIN, lsGet, lsSet } from "./lib/store.js";
import { NT } from "./lib/engine.js";
import { Toaster } from "./components/ui.jsx";
import ScoreSheet from "./components/ScoreSheet.jsx";
import Login from "./screens/Login.jsx";
import Me from "./screens/Me.jsx";
import Matches from "./screens/Matches.jsx";
import Tables from "./screens/Tables.jsx";
import Playoffs from "./screens/Playoffs.jsx";
import Setup from "./screens/Setup.jsx";

const TABS = VIEW
  ? [["me", "Me", UserRound], ["sched", "Matches", CalendarDays], ["tables", "Tables", ListOrdered], ["po", "Playoffs", Trophy]]
  : [["setup", "Setup", Settings2], ["sched", "Matches", CalendarDays], ["tables", "Tables", ListOrdered], ["po", "Playoffs", Trophy]];

function Shuttle(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="18" r="3" /><path d="M9.5 16.5 5 4h14l-4.5 12.5" /><path d="M9 4l1.5 12M15 4l-1.5 12M12 4v12" />
    </svg>
  );
}

// Short status pill; the full message is under Setup > More.
const STATUS = [
  [/local test/i, "Local", ""], [/offline|no connection/i, "Offline", "warn"], [/not saved|could not/i, "Not saved", "warn"],
  [/saving/i, "Saving", ""], [/not sent/i, "Unsaved", ""], [/waiting/i, "Waiting", ""], [/connecting/i, "Connecting", ""],
  [/^updated (.*)/i, "Live $1", "live"], [/^live|loaded|saved/i, "Live", "ok"]
];
function Status({ live, updated }) {
  const text = VIEW ? updated || "Connecting…" : live || "Not connected";
  const hit = STATUS.find(([re]) => re.test(text)) || [null, "Offline", ""];
  const label = hit[1].includes("$") ? text.replace(hit[0], hit[1]) : hit[1];
  return <span className={`status ${hit[2] ? "live" : ""}`} title={text}><span className={`dot ${hit[2]}`} />{label}</span>;
}

// Light is the default; the choice is remembered per device.
export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === "dark" ? "#0a0c10" : "#eef0f4";
}

export default function App() {
  const { S, live, updated } = useStore();
  const [tab, setTab] = useState(VIEW ? "me" : S.drawn.length >= NT ? "sched" : "setup");
  const [open, setOpen] = useState(null);
  const [theme, setTheme] = useState(lsGet("bt_theme") || "light");
  const close = useCallback(() => setOpen(null), []);
  const flip = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); lsSet("bt_theme", t); applyTheme(t); };
  const go = k => { setTab(k); window.scrollTo(0, 0); };
  if (LOGIN) return <><Login /><Toaster /></>;
  const onOpen = m => setOpen(m.id);
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Shuttle /></span><div>Badminton Day<small>{VIEW ? "Live scores" : "Organizer"}</small></div></div>
        <Status live={live} updated={updated} />
        <button className="icon-btn" onClick={flip} aria-label="Switch light or dark">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
      </header>
      <main key={tab}>
        {tab === "me" && <Me S={S} />}
        {tab === "setup" && <Setup S={S} live={live} />}
        {tab === "sched" && <Matches S={S} admin={!VIEW} onOpen={onOpen} />}
        {tab === "tables" && <Tables S={S} />}
        {tab === "po" && <Playoffs S={S} admin={!VIEW} onOpen={onOpen} />}
      </main>
      <nav className="tabbar">
        <div className="tabbar-in">
          {TABS.map(([k, n, Icon]) => (
            <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => go(k)} aria-current={tab === k ? "page" : undefined}>
              <span className="pill"><Icon size={20} strokeWidth={tab === k ? 2.4 : 2} /></span>{n}
            </button>
          ))}
        </div>
      </nav>
      {open && <ScoreSheet S={S} id={open} onClose={close} />}
      <Toaster />
    </div>
  );
}
