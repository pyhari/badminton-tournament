import { useMemo } from "react";
import { Sparkles, Trophy, Shield } from "lucide-react";
import { BR } from "../lib/engine.js";
import { predict } from "../lib/insights.js";
import { useForecast, useReasons } from "../lib/insightsFeed.js";
import { Badge, TeamName } from "./ui.jsx";

// "Race for the Champions League" on the players' Tables tab: for each unfinished group, the
// 2 teams likely to go to the Champions League and the 2 likely to go to the FPL, worked out
// by the app. The AI adds a one-line summary per group and a reason per team.
export default function Outlook({ S }) {
  const groups = useMemo(() => predict(S), [S]);
  const reasons = useReasons() || {}, forecast = useForecast() || {};
  if (!groups.length) return null;
  const row = (r, cl) => (
    <div key={r.t} className={`ol-row ${cl ? "cl" : "fpl"}`}>
      <Badge S={S} t={r.t} size="sm" />
      <div className="ol-main">
        <div className="ol-top">
          <TeamName S={S} t={r.t} />
          <span className={`ol-chance ${r.word.replace(/ /g, "-").toLowerCase()}`}>{r.word}{r.word !== "Confirmed" && <small className="num">{r.chance}%</small>}</span>
        </div>
        {reasons[r.t] && <p>{reasons[r.t]}</p>}
      </div>
    </div>
  );
  return (
    <section className="outlook" aria-label={`Race for the ${BR.Cup}`}>
      <div className="story-top"><Sparkles size={14} /><span>Race for the {BR.Cup}</span></div>
      <p className="outlook-sub">Our prediction from results so far and player levels. Top 2 in each group go to the {BR.Cup}; 3rd and 4th go to the {BR.Plate} (FFBC Premier League).</p>
      <div className="ol-wrap">
        {groups.map(g => (
          <div key={g.name} className="ol-group">
            <small className="ol-name">{g.name}</small>
            {forecast[g.name] && <p className="ol-sum">{forecast[g.name]}</p>}
            <div className="ol-side cl"><Trophy size={13} strokeWidth={2.6} />Likely {BR.Cup}</div>
            {g.cl.map(r => row(r, true))}
            <div className="ol-side fpl"><Shield size={13} strokeWidth={2.6} />Likely {BR.Plate}</div>
            {g.fpl.map(r => row(r, false))}
            {g.key.length > 0 && (
              <div className="ol-key">
                <small>Could change it</small>
                {g.key.map(m => <span key={m.id}><Badge S={S} t={m.a} size="sm" />v<Badge S={S} t={m.b} size="sm" /></span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
