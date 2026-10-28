import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Check, Search, Lock, LockOpen, Plus, Shuffle, Trash2, AlertTriangle, Dices, FastForward, RotateCcw, Copy, Download, Upload, LogOut, CloudDownload, Wifi, X } from "lucide-react";
import * as E from "../lib/engine.js";
import { update, replaceAll, getState, getPin, sync, pullNow, logout, isDirty, lsGet, lsSet } from "../lib/store.js";
import { Badge, TeamName, toast } from "../components/ui.jsx";
import TeamDraw from "./TeamDraw.jsx";
import Together from "../components/Together.jsx";
import TestTools, { showTests, showAI } from "./TestTools.jsx";
const AIPlanner = lazy(() => import("./AIPlanner.jsx"));

const firstStep = S => !S.locked ? (S.teams.some(x => x.m1) ? "teams" : "players") : S.drawn.length < E.NT ? "groups" : "more";

export default function Setup({ S, live }) {
  const [seg, setSeg] = useState(() => firstStep(S));
  const done = { players: !E.poolIssues(S).length, teams: S.locked, groups: S.drawn.length >= E.NT };
  const segs = [["players", "Players"], ["teams", "Teams"], ["groups", "Groups"], ["more", "More"]].concat(showTests ? [["test", "Test"]] : []).concat(showAI ? [["ai", "AI"]] : []);
  return (
    <div className="page">
      <h1 className="page-title">Setup</h1>
      <div className="seg" role="tablist">
        {segs.map(([k, n]) => (
          <button key={k} role="tab" aria-selected={seg === k} className={seg === k ? "on" : ""} onClick={() => setSeg(k)}>
            {done[k] && <span className="ck"><Check size={11} strokeWidth={3.5} /></span>}{n}
          </button>
        ))}
      </div>
      {seg === "players" && <Players S={S} next={() => setSeg("teams")} />}
      {seg === "teams" && <Teams S={S} next={() => setSeg("groups")} />}
      {seg === "groups" && <Groups S={S} back={() => setSeg("teams")} />}
      {seg === "more" && <More S={S} live={live} />}
      {seg === "test" && <TestTools S={S} />}
      {seg === "ai" && <Suspense fallback={null}><AIPlanner S={S} /></Suspense>}
    </div>
  );
}

/* ---------- players ---------- */
function Players({ S, next }) {
  const issues = E.poolIssues(S);
  const [secret, setSecret] = useState(false); // "Always together" panel open
  const taps = useRef([]);
  // Five quick taps or clicks on the "Men" header row open the hidden "Always together" panel.
  const tapTitle = () => {
    const now = Date.now();
    taps.current = taps.current.filter(t => now - t < 4000).concat(now);
    if (taps.current.length >= 5) { taps.current = []; setSecret(true); }
  };
  const [q, setQ] = useState("");
  const [sort, setSortState] = useState(() => lsGet("bt_psort") || "az");
  const setSort = v => { setSortState(v); lsSet("bt_psort", v); };
  const by = { az: (a, b) => a[0].name.localeCompare(b[0].name), level: (a, b) => b[0].lvl - a[0].lvl || a[0].name.localeCompare(b[0].name), added: (a, b) => a[1] - b[1] }[sort] || (() => 0);
  const count = g => { const ps = S.players.filter(p => p.g === g); return { on: ps.filter(p => p.on).length, off: ps.filter(p => !p.on).length, need: g === "M" ? 2 * E.NT : E.NT }; };
  const men = count("M"), women = count("F");
  const find = q.trim().toLowerCase();
  const list = g => {
    const { on, need } = g === "M" ? men : women;
    const rows = S.players.map((p, i) => [p, i]).filter(([p]) => p.g === g).sort(by);
    // Playing players are numbered 1, 2, 3... in the order shown; the search keeps their numbers.
    const playing = rows.filter(([p]) => p.on).map((r, k) => [...r, k + 1]), out = rows.filter(([p]) => !p.on);
    const hit = ([p]) => !find || p.name.toLowerCase().includes(find);
    const shownOn = playing.filter(hit), shownOff = out.filter(hit);
    if (find && !shownOn.length && !shownOff.length) return null;
    return (
      <>
        <div className="section" onClick={g === "M" ? tapTitle : undefined} style={{ userSelect: "none" }}><h2>{g === "M" ? "Men" : "Women"}</h2><span className={`count ${on === need ? "ok" : "bad"}`}>{on}/{need}</span></div>
        <div className="card flat">
          {shownOn.map(([p, i, n]) => <PlayerRow key={i} S={S} p={p} i={i} n={n} />)}
          {shownOff.length > 0 && <div className="prow-sub">Not playing · {shownOff.length}</div>}
          {shownOff.map(([p, i]) => <PlayerRow key={i} S={S} p={p} i={i} />)}
          {!S.locked && !find && <AddPlayer S={S} g={g} />}
        </div>
      </>
    );
  };
  const ready = !issues.length;
  // "2 men too many · 1 woman short"
  const gap = (c, one, many) => { const d = c.on - c.need, k = Math.abs(d); return d ? `${k} ${k === 1 ? one : many} ${d > 0 ? "too many" : "short"}` : ""; };
  const off = [gap(men, "man", "men"), gap(women, "woman", "women")].filter(Boolean).join(" · ");
  return (
    <>
      <div className="psum">
        {[["Men", men], ["Women", women]].map(([label, c]) => (
          <div key={label} className={c.on === c.need ? "ok" : "bad"}><b className="num">{c.on}<small>/{c.need}</small></b><span>{label}</span>{c.off > 0 && <em>+{c.off} not playing</em>}</div>
        ))}
        <div><b className="num">{men.on + women.on}</b><span>Playing</span>{men.off + women.off > 0 && <em>{S.players.length} in the list</em>}</div>
        <p className={ready ? "ok" : "bad"}>{ready ? <><Check size={14} strokeWidth={3} />Ready for {E.NT} teams</> : <><AlertTriangle size={14} />{off || "Check the players below"}</>}</p>
      </div>
      {S.locked
        ? <div className="banner"><Lock size={18} />Teams are locked, so who plays and their levels are fixed. Names can still be corrected.</div>
        : <p className="hint" style={{ marginTop: 0 }}>Switch on who is playing and set each level: 5 dots is the strongest. The team draw uses levels to make even teams.</p>}
      <div className="ptools">
        <div className="search"><Search size={18} /><input className="field" placeholder="Search player" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="field" value={sort} aria-label="Sort players" onChange={e => setSort(e.target.value)}>
          <option value="az">A–Z</option>
          <option value="level">By level</option>
          <option value="added">As added</option>
        </select>
      </div>
      {list("M")}
      {list("F")}
      {find && !S.players.some(p => p.name.toLowerCase().includes(find)) && <p className="hint">No player called “{q.trim()}”.</p>}
      {issues.length > 0 && !S.locked && <div className="banner warn" style={{ marginTop: 12 }}><AlertTriangle size={18} /><div>{issues.map(x => <div key={x}>{x}</div>)}</div></div>}
      {!issues.length && !S.locked && <button className="btn primary block" style={{ marginTop: 12 }} onClick={next}>Next: make teams</button>}
      {secret && <Together S={S} onClose={() => setSecret(false)} />}
    </>
  );
}

function PlayerRow({ S, p, i, n }) {
  const t = E.teamOf(S, p), fixed = S.locked || t >= 0;
  const [name, setName] = useState(p.name);
  useEffect(() => setName(p.name), [p.name]);
  const commit = () => {
    if (name === p.name) return;
    let err = "";
    update(n => { err = E.renamePlayer(n, i, name); });
    if (err) { toast(err); setName(p.name); }
  };
  return (
    <div className={`prow ${p.on ? "" : "off"}`}>
      <span className="pno num">{n || ""}</span>
      <button className={`switch ${p.on ? "on" : ""}`} role="switch" aria-checked={p.on} aria-label={`${p.name} is playing`} disabled={fixed}
        onClick={() => update(n => { n.players[i].on = !n.players[i].on; })} />
      <div>
        <input className="nmi" value={name} aria-label="Player name" onChange={e => setName(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && e.target.blur()} />
        {t >= 0 && <small>{E.tn(S, t)}</small>}
      </div>
      <div className="levels" role="radiogroup" aria-label={`Level of ${p.name}`}>
        {[1, 2, 3, 4, 5].map(v => (
          <button key={v} className={v <= p.lvl ? "on" : ""} role="radio" aria-checked={v === p.lvl} aria-label={`Level ${v}`} disabled={S.locked}
            onClick={() => update(n => { n.players[i].lvl = v; })} />
        ))}
      </div>
      <button className="del" aria-label={`Remove ${p.name}`} disabled={fixed} onClick={() => update(n => { n.players.splice(i, 1); })}><Trash2 size={16} /></button>
    </div>
  );
}

function AddPlayer({ S, g }) {
  const [v, setV] = useState("");
  const add = () => {
    const name = v.trim();
    if (!name) return;
    if (S.players.some(p => p.g === g && p.name.toLowerCase() === name.toLowerCase())) { toast(name + " is already in the list."); return; }
    update(n => { n.players.push(E.player(name, g)); });
    setV("");
  };
  return (
    <div className="addrow">
      <input className="field" placeholder={`Add a ${g === "M" ? "man" : "woman"}`} value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
      <button className="btn" onClick={add} aria-label="Add player"><Plus size={18} /></button>
    </div>
  );
}

/* ---------- teams ---------- */
function Teams({ S, next }) {
  const [sel, setSel] = useState(null); // slot picked for a swap: { t, f }
  const [show, setShow] = useState(false); // draw ceremony open
  const filled = S.teams.some(x => x.m1 || x.m2 || x.w), issues = E.teamIssues(S);
  const pw = S.teams.map((_, t) => E.power(S, t));
  const selG = sel && E.slotG(sel.f);

  const draw = () => {
    const pi = E.poolIssues(S);
    if (pi.length) { toast(pi.join("\n")); return; }
    if (filled && !confirm("Replace the current teams with a new draw?")) return;
    setSel(null); setShow(true);
  };
  const tap = (t, f) => {
    if (!sel || E.slotG(sel.f) !== E.slotG(f)) return setSel({ t, f });
    if (sel.t === t && sel.f === f) return setSel(null);
    update(n => E.swapSlots(n, sel, { t, f })); setSel(null);
  };
  const sub = i => {
    const p = S.players[i];
    if (!sel || selG !== p.g) { toast(`Tap a ${p.g === "M" ? "man" : "woman"} in a team first, then ${p.name} to swap them in.`); return; }
    update(n => E.subIn(n, sel, i)); setSel(null);
  };
  const lock = () => {
    if (issues.length) { toast("Fix these first:\n" + issues.slice(0, 4).join("\n")); return; }
    update(n => { n.locked = true; }); setSel(null); next();
  };
  const spare = S.players.map((p, i) => [p, i]).filter(([p]) => E.teamOf(S, p) < 0);

  return (
    <>
      {S.locked ? (
        <div className="banner ok"><Lock size={18} /><div style={{ flex: 1 }}>Teams are locked. Team names can still change.
          {!S.picks.length ? <div className="btns"><button className="btn sm" onClick={() => update(n => { n.locked = false; })}><LockOpen size={14} />Unlock teams</button></div> : <div className="hint" style={{ margin: "4px 0 0" }}>To change players, redo the group draw first.</div>}</div></div>
      ) : (
        <div className="card">
          <b style={{ fontSize: 16 }}>Balanced draw</b>
          <p className="hint" style={{ margin: "4px 0 0" }}>Each team gets one man from Pot 1 (the stronger half), one from Pot 2 and one woman, with team strengths kept as even as possible. Then tap two players to swap, or a player and a reserve to sub in.</p>
          <div className="btns">
            <button className="btn primary" onClick={draw}><Shuffle size={16} />{filled ? "Draw again" : "Draw balanced teams"}</button>
            <button className="btn" onClick={lock} disabled={!filled}><Lock size={16} />Lock teams</button>
          </div>
        </div>
      )}
      {filled && <div className="section"><h2>Teams</h2><span>Strength {Math.min(...pw)}–{Math.max(...pw)} (sum of levels)</span></div>}
      {filled && issues.length > 0 && !S.locked && <div className="banner warn"><AlertTriangle size={18} /><div>{issues.slice(0, 5).map(x => <div key={x}>{x}</div>)}</div></div>}
      <div className="teams-grid">
        {S.teams.map((x, t) => (
          <div className="tcard" key={t}>
            <div className="tcard-head">
              <Badge S={S} t={t} />
              <input value={x.name} aria-label={`Team ${t + 1} name`} placeholder={`Team ${t + 1}`} onChange={e => { const v = e.target.value; update(n => { n.teams[t].name = v; }); }} />
              {filled && <span className="strength">{pw[t]}</span>}
            </div>
            <div className="slots">
              {E.SLOTS.map(f => {
                const isSel = sel && sel.t === t && sel.f === f, target = sel && !isSel && selG === E.slotG(f);
                return (
                  <button key={f} className={`slot ${x[f] ? "" : "empty"} ${isSel ? "sel" : ""} ${target ? "target" : ""}`} disabled={S.locked} onClick={() => tap(t, f)}>
                    <span className="role">{E.SLOT[f]}</span><b>{x[f] || "Empty"}</b>{x[f] && <span className="lv">L{E.lvl(S, x[f], E.slotG(f))}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!S.locked && filled && spare.length > 0 && (
        <>
          <div className="section"><h2>Reserves</h2><span>Not in a team</span></div>
          <div className="reserves">
            {spare.map(([p, i]) => <button key={i} className={sel && selG === p.g ? "target" : ""} onClick={() => sub(i)}>{p.name}<small>{p.g === "M" ? "M" : "W"} · L{p.lvl}</small></button>)}
          </div>
        </>
      )}
      {show && <TeamDraw S={S} onClose={saved => { setShow(false); if (saved) toast("Teams saved. Swap players if needed, then lock."); }} />}
      {sel && (
        <div className="float-hint">
          <span>{S.teams[sel.t][sel.f] || E.SLOT[sel.f]} selected. Tap another {selG === "M" ? "man" : "woman"} to swap.</span>
          <button onClick={() => setSel(null)}><X size={12} /></button>
        </div>
      )}
    </>
  );
}

/* ---------- group draw ---------- */
function Groups({ S, back }) {
  const [spin, setSpin] = useState(null); // team shown while the draw animates
  const [last, setLast] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);
  const done = S.drawn.length >= E.NT, g = E.groups(S);

  if (!S.locked) return (
    <div className="banner"><Lock size={18} /><div style={{ flex: 1 }}>Lock the teams before the group draw.<div className="btns"><button className="btn sm" onClick={back}>Go to Teams</button></div></div></div>
  );

  const next = () => {
    if (spin != null || done) return;
    if (!S.pots.length) update(n => { n.pots = E.makePots(n); });
    let k = 0;
    timer.current = setInterval(() => {
      const rem = E.potLeft(getState());
      setSpin(rem[E.cryptoRnd(rem.length)]);
      if (++k >= 14) {
        clearInterval(timer.current);
        let t = null;
        update(n => { if (n.picks.length < E.NT) t = E.pickNext(n); });
        setSpin(null); setLast(t);
      }
    }, 80);
  };
  const all = () => { if (spin == null) { update(n => { while (n.picks.length < E.NT) E.pickNext(n); }); setLast(null); } };
  const redo = () => {
    if (!confirm("Redo the group draw? This clears the groups and all scores.")) return;
    update(n => E.clearDraw(n)); setLast(null);
  };
  const lastSeat = last != null && S.picks.includes(last) ? E.seatOf(S.picks.indexOf(last)) : null;
  const shown = spin != null ? spin : last;
  const col = k => g ? g["AB"[k]] : S.picks.filter((_, i) => i % E.NG === k);

  return (
    <>
      <div className="machine">
        <div className="k">{done ? "Draw complete" : `Pick ${S.picks.length + 1} of ${E.NT}`}</div>
        <div className={`slotname ${spin != null ? "spin" : ""}`}>
          {shown != null ? <><Badge S={S} t={shown} size="lg" />{E.tn(S, shown)}</> : done ? <Check size={44} strokeWidth={2} /> : <Dices size={44} strokeWidth={1.6} />}
        </div>
        <div className="where">{spin == null && lastSeat ? `Group ${lastSeat.g} · seat ${lastSeat.seat + 1}` : done && last == null ? "Fixtures are ready in Matches" : ""}</div>
        <div className="btns">
          {!done && <button className="btn primary" onClick={next} disabled={spin != null}><Dices size={16} />Draw next team</button>}
          {!done && <button className="btn" onClick={all} disabled={spin != null}><FastForward size={16} />Draw all</button>}
          {(S.picks.length > 0 || done) && <button className="btn danger" onClick={redo} disabled={spin != null}><RotateCcw size={16} />Redo draw</button>}
        </div>
      </div>
      {S.pots.length > 0 && (
        <>
          <div className="section"><h2>Pots by strength</h2></div>
          <div className="pots">
            {S.pots.map((p, i) => (
              <div className="pot" key={i}><small>Pot {i + 1}</small><div className="badges">{p.map(t => <span key={t} className={S.picks.includes(t) ? "gone" : ""}><Badge S={S} t={t} size="sm" /></span>)}</div></div>
            ))}
          </div>
        </>
      )}
      <div className="section"><h2>Groups</h2></div>
      <div className="groups2">
        {[0, 1].map(k => (
          <div className="glist" key={k}>
            <h4>Group {"AB"[k]}</h4>
            {[0, 1, 2, 3].map(s => {
              const t = col(k)[s];
              return t != null
                ? <div className="gitem" key={s}><span className="seat">{s + 1}</span><Badge S={S} t={t} size="sm" /><TeamName S={S} t={t} /></div>
                : <div className="gitem ph" key={s}><span className="seat">{s + 1}</span>Pot {s + 1}</div>;
            })}
          </div>
        ))}
      </div>
      <p className="hint">Teams are ranked by strength into {E.NT / E.NG} pots of {E.NG}. Each pot sends one team to each group, so the strongest teams start in different groups.</p>
    </>
  );
}

/* ---------- more ---------- */
function More({ S, live }) {
  const link = location.origin + "/watch";
  const copy = (text, msg) => navigator.clipboard ? navigator.clipboard.writeText(text).then(() => toast(msg), () => prompt("Copy this:", text)) : prompt("Copy this:", text);
  const restore = () => {
    const t = prompt("Paste your backup here:");
    if (!t) return;
    try { replaceAll(E.fix(JSON.parse(t))); toast("Backup restored"); } catch (e) { toast("This backup is not valid."); }
  };
  const reset = () => { if (confirm("Delete players, teams, draw and scores?")) { replaceAll(E.defaults()); toast("Everything was reset"); } };
  return (
    <>
      <div className="section"><h2>Live link for players</h2></div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>Players open this link, pick their name and follow their matches live.</p>
        <div className="field" style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{link}</div>
        <div className="btns">
          <button className="btn primary" onClick={() => copy(link, "Link copied")}><Copy size={16} />Copy link</button>
          {getPin() && <button className="btn" onClick={sync}><Wifi size={16} />Sync now</button>}
          {getPin() && <button className="btn" onClick={pullNow}><CloudDownload size={16} />Load from server</button>}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>{live || (isDirty() ? "Changes not sent yet" : "")}</p>
      </div>

      <div className="section"><h2>Courts</h2></div>
      <div className="card">
        <label className="lbl" style={{ marginTop: 0 }}>Courts available</label>
        <div className="courts" style={{ marginTop: 0 }}>
          {[1, 2, 3, 4, 5, 6].map(c => <button key={c} className={`cpick ${E.courtCount(S) === c ? "on" : ""}`} onClick={() => update(n => { n.settings = { ...n.settings, courts: c }; })}>{c}</button>)}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Matches are played in any order on any free court. When you open a match, pick the court it goes to.</p>
      </div>

      <div className="section"><h2>Backup</h2></div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>Everything saves on this phone{getPin() ? " and on the server" : ""}. Use one phone for score entry.</p>
        <div className="btns">
          <button className="btn" onClick={() => copy(JSON.stringify(S), "Backup copied. Paste it in a note.")}><Download size={16} />Copy backup</button>
          <button className="btn" onClick={restore}><Upload size={16} />Restore</button>
        </div>
        <div className="btns"><button className="btn danger" onClick={reset}><Trash2 size={16} />Reset everything</button></div>
      </div>

      <div className="btns" style={{ marginTop: 18 }}><button className="btn block" onClick={logout}><LogOut size={16} />Log out</button></div>
    </>
  );
}
