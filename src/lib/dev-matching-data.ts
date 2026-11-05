import "server-only";

// DEV ONLY fake rows so /admin/matching shows every cohort: no-shows, solo (here / not here),
// incomplete teams, a rule-breaking team, full teams and a locked team.
const iso = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

export const DEV_SCHOOLS = [
  [1, "University of Michigan – Ann Arbor"], [2, "University of Michigan – Dearborn"], [3, "University of Michigan – Flint"],
  [4, "Michigan State University"], [5, "Wayne State University"], [6, "Central Michigan University"], [7, "Eastern Michigan University"],
  [9, "Grand Valley State University"], [10, "Oakland University"], [11, "Michigan Technological University"], [53, "Calvin University"],
  [62, "Hope College"], [64, "Kettering University"], [66, "Lawrence Technological University"],
].map(([id, name]) => ({ id, name, rule_group: null }));
const sname = (id: number) => DEV_SCHOOLS.find((s) => s.id === id)!.name;

const TR = ["FinTech", "HealthTech", "SportsTech", "Industry 4.0"];
const SK = ["Machine learning", "Backend", "Frontend", "UI/UX design", "Finance", "Healthcare", "Hardware", "Pitching", "Data analysis", "Marketing", "Mobile", "Research"];
const NAMES = ["Avery Chen", "Mateo Ruiz", "Imani Brooks", "Liam O'Neil", "Nadia Farouk", "Caleb Wright", "Mei Tanaka", "Omar Haddad", "Grace Lindqvist", "Diego Santos", "Hannah Weiss", "Jamal Pierce", "Sana Qureshi", "Ethan Kowalski", "Lucia Moretti", "Tobias Reed", "Aaliyah Grant", "Ben Fischer", "Yuki Sato", "Chloe Dubois", "Isaac Mensah", "Ruth Adler", "Pablo Ortega", "Leah Cohen", "Victor Ng", "Fatima Yusuf", "Owen Murphy", "Priyanka Rao", "Sam Whitaker", "Tessa Novak"];

// [team index or -1, school id, checked in, ready]
const ROWS: [number, number, boolean, boolean][] = [
  // E0 Northwind: full and valid, all here
  [0, 1, true, true], [0, 4, true, true], [0, 5, true, true], [0, 9, true, true],
  // E1 Lakeshore: 2 people
  [1, 4, true, true], [1, 10, false, true],
  // E2 Tidal: 3 people, one no-show
  [2, 5, true, true], [2, 6, true, true], [2, 53, false, true],
  // E3 Copperline: 4 people (2+1+1), one no-show
  [3, 1, true, true], [3, 1, true, true], [3, 7, true, true], [3, 9, false, true],
  // E4 Mismatch: 2+2, breaks the rule
  [4, 4, true, true], [4, 4, true, true], [4, 5, true, true], [4, 5, true, true],
  // E5 Locked Ten: full, locked
  [5, 2, true, true], [5, 3, true, true], [5, 11, true, true], [5, 62, true, true],
  // solos, here
  [-1, 1, true, true], [-1, 4, true, true], [-1, 5, true, true], [-1, 9, true, true], [-1, 10, true, true], [-1, 6, true, true], [-1, 7, true, true],
  [-1, 64, true, true], [-1, 66, true, true], [-1, 11, true, true], [-1, 1, true, true],
  // solos, not here
  [-1, 4, false, true], [-1, 53, false, true], [-1, 62, false, true], [-1, 2, false, true],
  // profile unfinished / unpaid
  [-1, 3, false, false],
];

export function devMatchingRows() {
  const team = (i: number) => `50000000-0000-4000-8000-00000000000${i}`;
  const teams = [
    { id: team(0), name: "Northwind", track: "FinTech", locked_at: null }, { id: team(1), name: "Lakeshore", track: "HealthTech", locked_at: null },
    { id: team(2), name: "Tidal", track: "SportsTech", locked_at: null }, { id: team(3), name: "Copperline", track: "Industry 4.0", locked_at: null },
    { id: team(4), name: "Mismatch", track: null, locked_at: null }, { id: team(5), name: "Locked Ten", track: "FinTech", locked_at: iso(-3) },
  ].map((t) => ({ ...t, needs: null, created_at: iso(-30) }));
  const profiles = ROWS.map(([t, sid, here, ready], i) => ({
    id: `60000000-0000-4000-8000-${String(1000 + i).padStart(12, "0")}`, email: `${NAMES[i % NAMES.length].toLowerCase().replace(/[^a-z]+/g, ".")}@example.edu`,
    full_name: NAMES[i % NAMES.length], year: "Second year", study_area: "Undeclared", school_id: sid, schools: { name: sname(sid) },
    tracks: [TR[i % 4], ...(i % 3 === 0 ? [TR[(i + 1) % 4]] : [])], skills: [SK[i % SK.length], SK[(i * 5 + 3) % SK.length]], avatar_url: null,
    onboarded_at: ready ? iso(-100) : null, paid_at: ready ? iso(-90) : null, checked_in_at: here ? iso(-1) : null, created_at: iso(-200 - i), is_admin: false, _team: t,
  }));
  const members = profiles.filter((p) => p._team >= 0).map((p) => ({ team_id: team(p._team), user_id: p.id, teams: { name: teams[p._team].name, locked_at: teams[p._team].locked_at } }));
  return { teams, profiles: profiles.map(({ _team, ...p }) => { void _team; return p; }), members };
}
