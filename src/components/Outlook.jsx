import { useMemo } from "react";
import { Sparkles, Check } from "lucide-react";
import { BR } from "../lib/engine.js";
import { top2Odds } from "../lib/insights.js";
import { useReasons } from "../lib/insightsFeed.js";
import { Badge, TeamName } from "./ui.jsx";

// "Race for the Champions League" on the players' Tables tab: each team's chance of a
// top-2 place, worked out by the app, with a one-line reason from the AI.
export default function Outlook({ S }) {
  const odds = useMemo(() => top2Odds(S), [S]);
  const reasons = useReasons() || {};
  const open = odds.filter(g => !g.settled);
  if (!open.length) return null;
  return (
    <section className="outlook" aria-label={`Race for the ${BR.Cup}`}>
      <div className="story-top"><Sparkles size={14} /><span>Race for the {BR.Cup}</span></div>
      <p className="outlook-sub">Chance of a top-2 place, from 2,000 simulated finishes using player levels. Reasons by AI.</p>
      <div className="ol-wrap">
      {open.map(g => (
        <div key={g.name} className="ol-group">
          <small className="ol-name">{g.name}</small>
          {[...g.rows].sort((x, y) => y.pct - x.pct || x.pos - y.pos).map(r => (
            <div key={r.t} className={`ol-row ${r.status.replace(" ", "-")}`}>
              <Badge S={S} t={r.t} size="sm" />
              <div className="ol-main">
                <div className="ol-top">
                  <TeamName S={S} t={r.t} />
                  <span className="ol-pct num">{r.status === "through" ? <><Check size={13} strokeWidth={3.5} />In</> : r.status === "out" ? BR.Plate : r.pct === 1 ? "<1%" : r.pct === 99 ? ">99%" : r.pct + "%"}</span>
                </div>
                <div className="ol-bar" aria-hidden="true"><span style={{ width: r.pct + "%" }} /></div>
                {reasons[r.t] && <p>{reasons[r.t]}</p>}
                {r.opponents.length > 0 && <div className="ol-left"><small>Still to play</small>{r.opponents.map(o => <Badge key={o} S={S} t={o} size="sm" />)}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
      </div>
    </section>
  );
}
