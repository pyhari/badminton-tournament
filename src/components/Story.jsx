import { Sparkles, Trophy, Zap, Flame, TrendingUp, Check, X } from "lucide-react";
import { BR, tn } from "../lib/engine.js";
import { highlights, groupRace, champions } from "../lib/insights.js";
import { useInsights } from "../lib/insightsFeed.js";
import { Badge, teamColor } from "./ui.jsx";

const hhmm = t => new Date(t).toTimeString().slice(0, 5);
const KIND = { upset: ["Upset", Zap], thriller: ["Thriller", Flame], comeback: ["Comeback", TrendingUp], sweep: ["Clean sweep", Sparkles] };

// The fact under each highlight's score, worked out from the results (not written by the AI).
function fact(h) {
  const m = h.match;
  if (h.kind === "upset") return `Weaker on paper by ${m.strengthGap} levels`;
  if (h.kind === "thriller") return `${h.game.winningPair} won ${h.game.game} ${h.game.score}`;
  if (h.kind === "comeback") return `Lost ${m.games[0].game}, won the next two`;
  return `Won by ${m.pointDiff} points over the three games`;
}

// "Story so far" on the players' page. The app draws the highlights, group race and
// champions from the scores; the AI adds the headline, one line and the captions.
export default function Story({ S }) {
  const d = useInsights();
  if (!d || !d.story) return null;
  const { headline, lede, captions = {} } = d.story;
  const cards = highlights(S), champs = champions(S), race = groupRace(S);
  return (
    <section className="story" aria-label="Story so far">
      <div className="story-top"><Sparkles size={14} /><span>Story so far</span><small>AI · {d.current === false ? "updating" : "updated " + hhmm(d.at)}</small></div>
      <h3>{headline}</h3>
      {lede && <p className="story-lede">{lede}</p>}

      {champs.map(c => (
        <div key={c.name} className="story-champ" style={{ background: teamColor(c.t) }}>
          <Trophy size={22} strokeWidth={2.4} />
          <div><small>{c.name} champions</small><b>{tn(S, c.t)}</b></div>
          <Badge S={S} t={c.t} />
        </div>
      ))}

      {cards.length > 0 && (
        <div className="hl-row">
          {cards.map(h => {
            const [label, Icon] = KIND[h.kind];
            return (
              <div key={h.key} className={`hl ${h.kind}`}>
                <span className="hl-kind"><Icon size={12} strokeWidth={2.6} />{label}</span>
                <div className="hl-score">
                  <Badge S={S} t={h.match.win} size="sm" /><b className="num">{h.match.result}</b><Badge S={S} t={h.match.lose} size="sm" />
                </div>
                <small className="hl-names">{h.match.winner} beat {h.match.loser}</small>
                <small className="hl-fact">{fact(h)}</small>
                {captions[h.key] && <p>{captions[h.key]}</p>}
              </div>
            );
          })}
        </div>
      )}

      {champs.length < 2 && race.length > 0 && (
        <div className="race">
          {race.map(g => (
            <div key={g.name} className="race-g">
              <small>{g.name}</small>
              <div className="race-teams">
                {g.rows.map(r => (
                  <span key={r.t} className={`race-t ${r.status.replace(" ", "-")}`} title={`${r.team}: ${r.status === "through" ? BR.Cup : r.status === "out" ? BR.Plate : "still in the race for the top 2"}`}>
                    <Badge S={S} t={r.t} size="sm" />
                    {r.status === "through" ? <Check size={11} strokeWidth={3.5} /> : r.status === "out" ? <X size={11} strokeWidth={3.5} /> : null}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="race-key"><span><Check size={10} strokeWidth={3.5} />{BR.Cup}</span><span><X size={10} strokeWidth={3.5} />{BR.Plate}</span><span>Table order</span></div>
        </div>
      )}
    </section>
  );
}
