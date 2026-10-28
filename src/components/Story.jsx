import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { useInsights } from "../lib/insightsFeed.js";

const hhmm = t => new Date(t).toTimeString().slice(0, 5);

// "Story so far": a short AI write-up of the day, on the players' page.
export default function Story() {
  const d = useInsights();
  const [open, setOpen] = useState(false);
  if (!d || !d.story) return null;
  const [first, ...rest] = d.story.paragraphs;
  return (
    <div className="story">
      <div className="story-top"><Sparkles size={14} /><span>Story so far</span><small>AI · {d.current === false ? "updating" : "updated " + hhmm(d.at)}</small></div>
      <h3>{d.story.headline}</h3>
      {first && <p>{first}</p>}
      {open && rest.map(p => <p key={p}>{p}</p>)}
      {rest.length > 0 && (
        <button className="story-more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Less" : "Read more"}<ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none" }} />
        </button>
      )}
    </div>
  );
}
