import { useState } from "react";
import { Link2, X } from "lucide-react";
import * as E from "../lib/engine.js";
import { lsGet, lsSet } from "../lib/store.js";
import { Names, Sheet, toast } from "./ui.jsx";

// Players the organizer wants in the same team, kept secret: saved on this phone only,
// never sent to the server, so players cannot see it. The team draw uses it.
const KEY = "bt_together";
export const getTogether = () => { try { return JSON.parse(lsGet(KEY) || "[]"); } catch (e) { return []; } };
const setTogether = v => lsSet(KEY, JSON.stringify(v));

const label = (S, k) => { const p = E.findP(S, k.slice(2), k[0]); return p ? { name: p.name, g: p.g } : null; };

// The hidden "Always together" panel, opened by tapping the "Men" heading in Setup → Players five times.
export default function Together({ S, onClose }) {
  const [list, setList] = useState(getTogether);
  const [x, setX] = useState(""), [y, setY] = useState("");
  const save = v => { setList(v); setTogether(v); };
  const used = new Set(list.flat());
  const options = S.players.filter(p => p.on && !used.has(p.g + ":" + p.name)).sort((a, b) => a.g.localeCompare(b.g) || a.name.localeCompare(b.name));
  const add = () => {
    if (!x || !y) return toast("Pick two players.");
    const why = E.pairIssue(list, x, y);
    if (why) return toast(why);
    save([...list, [x, y].sort((a, b) => a[0].localeCompare(b[0]))]); // woman first, like everywhere else
    setX(""); setY("");
  };
  const pick = (v, set) => (
    <select className="field" value={v} onChange={e => set(e.target.value)}>
      <option value="">Player</option>
      {options.map(p => <option key={p.g + p.name} value={p.g + ":" + p.name}>{p.name} ({p.g === "M" ? "M" : "W"})</option>)}
    </select>
  );
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head"><h3>Always together</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <p className="hint" style={{ marginTop: 0 }}>The balanced draw always puts each pair in the same team. Saved on this phone only and never shown to players. Draw the teams on this phone.</p>
      {list.length > 0 && (
        <div className="tg-list">
          {list.map((pair, i) => {
            const ps = pair.map(k => label(S, k));
            const off = ps.some(p => !p) || pair.some(k => !E.findP(S, k.slice(2), k[0]).on);
            return (
              <div key={pair.join()} className={`tg-row ${off ? "off" : ""}`}>
                <Link2 size={15} />
                <Names list={ps.map((p, j) => p || { name: pair[j].slice(2), g: pair[j][0] })} />
                {off && <small>not used: a player is not playing</small>}
                <button className="icon-btn" aria-label="Remove pair" onClick={() => save(list.filter((_, j) => j !== i))}><X size={16} /></button>
              </div>
            );
          })}
        </div>
      )}
      <label className="lbl">Add a pair</label>
      <div className="tg-add">{pick(x, setX)}{pick(y, setY)}</div>
      <div className="btns"><button className="btn primary" onClick={add}><Link2 size={16} />Keep together</button></div>
      <p className="hint" style={{ marginBottom: 0 }}>A man and a woman, or two men (one becomes Man 1, the other Man 2). Pairs can make teams a little less even. Teams already drawn do not change until you draw again.</p>
    </Sheet>
  );
}
