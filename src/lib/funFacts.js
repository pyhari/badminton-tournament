// A fun fact for each player, shown when they pick their name and in the team draw.
// The list (src/data/funFacts.json) uses full names; the app's short names map to them here.
import FACTS from "../data/funFacts.json" with { type: "json" };

const ALIASES = {
  "Dinesh R": "Dinesh Ramakrishnan",
  "Dinesh B": "Dinesh Babu",
  "Shankar": "Shankar Gopal",
  "Hari": "Harikumar Ravindran",
  "Harikumar": "Harikumar Ravindran",
  "Hema": "Hema Ragupathy",
  "Sai": "Sai Sudhir",
  "Praveen": "Praveen V"
};

export function funFact(name) {
  if (!name) return null;
  const n = name.trim();
  if (FACTS[n]) return FACTS[n];
  if (FACTS[ALIASES[n]]) return FACTS[ALIASES[n]];
  // A new short name: the one full name that starts with it, if only one does.
  const hits = Object.keys(FACTS).filter(k => k.toLowerCase().startsWith(n.toLowerCase() + " "));
  return hits.length === 1 ? FACTS[hits[0]] : null;
}
