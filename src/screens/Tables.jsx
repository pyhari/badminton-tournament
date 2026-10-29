import { ListOrdered } from "lucide-react";
import { BR, BR_FULL, groups, seeds, table } from "../lib/engine.js";
import { Fragment } from "react";
import { Badge, Empty, GenderKey, TeamName, toast } from "../components/ui.jsx";
import Outlook from "../components/Outlook.jsx";
import { VIEW } from "../lib/store.js";

// Column headings: short on the phone, the full words on a tap.
const COLS = [["P", "P = matches played"], ["W", "W = matches won (ranked on this first)"], ["GW", "GW = games won (the first tiebreaker)"], ["PD", "PD = point difference (the next tiebreaker)"]];

export default function Tables({ S }) {
  if (!groups(S)) return <div className="page"><Empty icon={ListOrdered} title="No standings yet">Standings appear once the groups are drawn.</Empty></div>;
  const sd = seeds(S);
  return (
    <div className="page wide">
      <h1 className="page-title">Standings</h1>
      {VIEW && <Outlook S={S} />}
      <div className="pair">
        {["A", "B"].map(gk => (
          <div key={gk}>
            <div className="section"><h2>Group {gk}</h2></div>
            <div className="card flat">
              <table className="standings">
                <thead><tr><th className="l" style={{ paddingLeft: 14 }}>#</th><th className="l">Team</th>{COLS.map(([k, full]) => <th key={k} className={`th-${k.toLowerCase()}`}><button className="th-btn" onClick={() => toast(full)} aria-label={full}>{k}</button></th>)}</tr></thead>
                <tbody>
                  {table(S, gk).map((x, i) => (
                    <Fragment key={x.t}>
                    {/* The line between the top 2 and the rest: where the two playoffs split. */}
                    {i === 2 && <tr className="cut"><td colSpan={6}><span>▲ {BR.Cup}</span><span>▼ {BR.Plate}</span></td></tr>}
                    <tr className={i < 2 ? "q" : ""}>
                      <td className="l pos">{i + 1}</td>
                      <td className="l team"><div className="tm"><Badge S={S} t={x.t} size="sm" /><TeamName S={S} t={x.t} /></div></td>
                      <td className="sub">{x.p}</td>
                      <td className="pts">{x.w}</td>
                      <td className="sub">{x.gw}</td>
                      <td className={`pdv ${x.pd > 0 ? "up" : x.pd < 0 ? "down" : ""}`}>{x.pd > 0 ? "+" : ""}{x.pd}</td>
                    </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <div className="legend"><span><i style={{ background: "var(--accent-text)" }} />Top 2: {BR.Cup}</span><span><i style={{ background: "var(--surface-3)" }} />3rd and 4th: {BR.Plate}</span><GenderKey /></div>
      <p className="hint">Tap P, W, GW or PD for what it means. Ranked by matches won, then games won, then point difference, then results between the level teams.</p>
      <div className="pair">
        {sd && ["Cup", "Plate"].map(br => (
          <div key={br}>
            <div className="section"><h2>{BR_FULL[br]} seeds</h2></div>
            <div className="card">
              {sd[br].map((t, i) => <div key={t} className="gitem"><span className="seat">{i + 1}</span><Badge S={S} t={t} size="sm" /><TeamName S={S} t={t} /></div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
