import { Trophy, Medal, ArrowRight } from "lucide-react";
import { BR, groups, playoffs, prelimsDone, tn, winnerTeam } from "../lib/engine.js";
import { Badge, Empty, MatchCard, teamColor, Players } from "../components/ui.jsx";

const PATH = { "Qualifier 1": "Winner to the Final · loser to Qualifier 2", "Eliminator": "Winner to Qualifier 2 · loser is out", "Qualifier 2": "Winner to the Final", "Final": "" };

export default function Playoffs({ S, admin, onOpen }) {
  if (!groups(S)) return <div className="page"><Empty icon={Trophy} title="No playoffs yet">Playoffs follow the group stage.</Empty></div>;
  const po = playoffs(S);
  return (
    <div className="page wide">
      <h1 className="page-title">Playoffs</h1>
      <p className="page-sub">IPL format: 1 v 2 in Qualifier 1, 3 v 4 in the Eliminator, then Qualifier 2 and the Final.</p>
      {!prelimsDone(S) && <div className="banner">Teams fill in when every group match is scored.</div>}
      <div className="pair">
        {["Cup", "Plate"].map(br => {
          const ms = po.filter(m => m.br === br), f = ms.find(m => m.label === "Final"), w = winnerTeam(S, f);
          const Icon = br === "Cup" ? Trophy : Medal;
          return (
            <div key={br}>
              <div className="section"><h2>{BR[br]}</h2></div>
              {w != null && (
                <div className="champion" style={{ background: teamColor(w) }}>
                  <Icon size={36} strokeWidth={2.2} />
                  <div><small>{BR[br]} champions</small><b>{tn(S, w)}</b><span><Players S={S} t={w} /></span></div>
                  <div style={{ marginLeft: "auto" }}><Badge S={S} t={w} size="lg" /></div>
                </div>
              )}
              {ms.map(m => (
                <div key={m.id}>
                  <MatchCard S={S} m={m} showStage={false} onOpen={admin ? onOpen : null} />
                  {PATH[m.label] && <div className="path"><ArrowRight size={12} />{PATH[m.label]}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
