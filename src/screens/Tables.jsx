import { ListOrdered } from "lucide-react";
import { BR, groups, seeds, table, tn, tp } from "../lib/engine.js";
import { Badge, Empty } from "../components/ui.jsx";
import Outlook from "../components/Outlook.jsx";
import { VIEW } from "../lib/store.js";

export default function Tables({ S }) {
  if (!groups(S)) return <div className="page"><Empty icon={ListOrdered} title="No tables yet">Tables appear once the groups are drawn.</Empty></div>;
  const sd = seeds(S);
  return (
    <div className="page wide">
      <h1 className="page-title">Tables</h1>
      {VIEW && <Outlook S={S} />}
      <div className="pair">
        {["A", "B"].map(gk => (
          <div key={gk}>
            <div className="section"><h2>Group {gk}</h2></div>
            <div className="card flat">
              <table className="standings">
                <thead><tr><th className="l" style={{ paddingLeft: 14 }}>#</th><th className="l">Team</th><th>P</th><th>W</th><th>GW</th><th>PD</th></tr></thead>
                <tbody>
                  {table(S, gk).map((x, i) => (
                    <tr key={x.t} className={i < 2 ? "q" : ""}>
                      <td className="l pos">{i + 1}</td>
                      <td className="l"><div className="tm"><Badge S={S} t={x.t} size="sm" /><div className="tm-nm"><b>{tn(S, x.t)}</b><small>{tp(S, x.t)}</small></div></div></td>
                      <td>{x.p}</td>
                      <td className="pts">{x.w}</td>
                      <td>{x.gw}</td>
                      <td>{x.pd > 0 ? "+" : ""}{x.pd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <div className="legend"><span><i style={{ background: "var(--accent-text)" }} />Top 2: {BR.Cup}</span><span><i style={{ background: "var(--surface-3)" }} />3rd and 4th: {BR.Plate}</span></div>
      <p className="hint">P matches played · W matches won · GW games won · PD point difference. Ranked by matches won, then games won, then point difference, then results between the level teams.</p>
      <div className="pair">
        {sd && ["Cup", "Plate"].map(br => (
          <div key={br}>
            <div className="section"><h2>{BR[br]} seeds</h2></div>
            <div className="card">
              {sd[br].map((t, i) => <div key={t} className="gitem"><span className="seat">{i + 1}</span><Badge S={S} t={t} size="sm" /><div className="tm-nm"><b>{tn(S, t)}</b><small>{tp(S, t)}</small></div></div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
