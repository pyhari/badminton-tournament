import { useState } from "react";
import { Link2, Unlink2, X } from "lucide-react";
import * as E from "../lib/engine.js";
import { lsGet, lsSet } from "../lib/store.js";
import { Names, Sheet, toast } from "./ui.jsx";

// Players the organizer wants in the same team, or in different teams, kept secret: saved on
// this phone only, never sent to the server, so players cannot see it. The team draw uses it.
const read = k => { try { return JSON.parse(lsGet(k) || "[]"); } catch (e) { return []; } };
export const getTogether = () => read("bt_together");
export const getApart = () => read("bt_apart");

const label = (S, k) => { const p = E.findP(S, k.slice(2), k[0]); return p ? { name: p.name, g: p.g } : null; };
const MODES = {
  together: { key: "bt_together", title: "Keep together", Icon: Link2, empty: "No pairs kept together." },
  apart: { key: "bt_apart", title: "Keep apart", Icon: Unlink2, empty: "No pairs kept apart." }
};

// The hidden pairs panel, opened by tapping or clicking the "Men" header row in Setup → Players five times.
export default function Together({ S, onClose }) {
  const [lists, setLists] = useState(() => ({ together: getTogether(), apart: getApart() }));
  const [mode, setMode] = useState("together");
  const [x, setX] = useState(""), [y, setY] = useState("");
  const save = (m, v) => { setLists(l => ({ ...l, [m]: v })); lsSet(MODES[m].key, JSON.stringify(v)); };
  // A player can be in one "together" pair only; "apart" pairs can share players.
  const used = new Set(mode === "together" ? lists.together.flat() : []);
  const options = S.players.filter(p => p.on && !used.has(p.g + ":" + p.name)).sort((a, b) => a.g.localeCompare(b.g) || a.name.localeCompare(b.name));
  const add = () => {
    if (!x || !y) return toast("Pick two players.");
    const why = mode === "together" ? E.pairIssue(lists.together, x, y, lists.apart) : E.apartIssue(lists.together, lists.apart, x, y);
    if (why) return toast(why);
    save(mode, [...lists[mode], [x, y].sort((a, b) => a[0].localeCompare(b[0]))]); // woman first, like everywhere else
    setX(""); setY("");
  };
  const pick = (v, set) => (
    <select className="field" value={v} onChange={e => set(e.target.value)}>
      <option value="">Player</option>
      {options.map(p => <option key={p.g + p.name} value={p.g + ":" + p.name}>{p.name} ({p.g === "M" ? "M" : "W"})</option>)}
    </select>
  );
  const list = m => {
    const { title, Icon, empty } = MODES[m];
    return (
      <>
        <label className="lbl">{title}</label>
        {!lists[m].length && <p className="hint" style={{ margin: 0 }}>{empty}</p>}
        <div className="tg-list">
          {lists[m].map((pair, i) => {
            const ps = pair.map(k => label(S, k));
            const off = ps.some(p => !p) || pair.some(k => !E.findP(S, k.slice(2), k[0]).on);
            return (
              <div key={pair.join()} className={`tg-row ${m} ${off ? "off" : ""}`}>
                <Icon size={15} />
                <Names list={ps.map((p, j) => p || { name: pair[j].slice(2), g: pair[j][0] })} />
                {off && <small>not used: a player is not playing</small>}
                <button className="icon-btn" aria-label="Remove pair" onClick={() => save(m, lists[m].filter((_, j) => j !== i))}><X size={16} /></button>
              </div>
            );
          })}
        </div>
      </>
    );
  };
  const M = MODES[mode];
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head"><h3>Pairs for the draw</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <p className="hint" style={{ marginTop: 0 }}>The balanced draw always puts "together" pairs in the same team and "apart" pairs in different teams. Saved on this phone only and never shown to players. Draw the teams on this phone.</p>
      {list("together")}
      {list("apart")}
      <label className="lbl">Add a pair</label>
      <div className="seg tg-mode" role="radiogroup">
        {Object.entries(MODES).map(([m, { title }]) => <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setX(""); setY(""); }}>{title}</button>)}
      </div>
      <div className="tg-add">{pick(x, setX)}{pick(y, setY)}</div>
      <div className="btns"><button className="btn primary" onClick={add}><M.Icon size={16} />{M.title}</button></div>
      <p className="hint" style={{ marginBottom: 0 }}>{mode === "together"
        ? "A man and a woman, or two men (one becomes Man 1, the other Man 2). A player can be in one such pair."
        : "Any two players, except two women (each team has one woman, so they are apart anyway). A player can be kept apart from several others."} Pairs can make teams a little less even. Teams already drawn do not change until you draw again.</p>
    </Sheet>
  );
}
