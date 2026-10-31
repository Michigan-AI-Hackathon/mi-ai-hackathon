// Suggests where students without a team should go. This only PROPOSES: the database
// (admin_apply_plan -> team_add_problem) re-checks every rule when an organizer applies it.
export type Candidate = { id: string; name: string; group: string; school: string; tracks: string[]; skills: string[] };
export type OpenTeam = { id: string; name: string; track: string | null; members: Candidate[] };
export type PlanGroup = { team_id: string | null; name: string; track: string | null; existing: boolean; keep: string[]; students: Candidate[] };
export type Plan = { groups: PlanGroup[]; leftover: Candidate[] };

// Same rules as team_add_problem in the database.
export function canAdd(members: Candidate[], c: Candidate) {
  if (members.length >= 4) return false;
  const same = members.filter((m) => m.group === c.group).length;
  if (same >= 2) return false;
  if (same === 1) {
    const counts = new Map<string, number>();
    members.forEach((m) => counts.set(m.group, (counts.get(m.group) ?? 0) + 1));
    if ([...counts.values()].some((n) => n >= 2)) return false;
  }
  return true;
}

function score(members: Candidate[], track: string | null, c: Candidate) {
  let s = 0;
  if (track && c.tracks.includes(track)) s += 3;
  s += members.reduce((n, m) => n + m.tracks.filter((t) => c.tracks.includes(t)).length, 0) * 0.5;
  const have = new Set(members.flatMap((m) => m.skills.map((k) => k.toLowerCase())));
  s += c.skills.filter((k) => !have.has(k.toLowerCase())).length * 0.5;   // fills a skill gap
  if (!members.some((m) => m.group === c.group)) s += 2;                    // adds a new school
  return s;
}

function best(members: Candidate[], track: string | null, pool: Candidate[]) {
  let pick: Candidate | null = null, top = -1;
  for (const c of pool) {
    if (!canAdd(members, c)) continue;
    const sc = score(members, track, c);
    if (sc > top) { top = sc; pick = c; }
  }
  return pick;
}

const commonTrack = (ms: Candidate[]) => {
  const n = new Map<string, number>();
  ms.forEach((m) => m.tracks.forEach((t) => n.set(t, (n.get(t) ?? 0) + 1)));
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

export function buildPlan(solos: Candidate[], openTeams: OpenTeam[], existingNames: string[]): Plan {
  const pool = [...solos];
  const take = (c: Candidate) => pool.splice(pool.indexOf(c), 1);
  const groups: PlanGroup[] = [];

  // 1) complete teams that already exist, fullest first
  for (const t of [...openTeams].sort((a, b) => b.members.length - a.members.length)) {
    const members = [...t.members], added: Candidate[] = [];
    for (let c = best(members, t.track, pool); c && members.length < 4; c = best(members, t.track, pool)) {
      members.push(c); added.push(c); take(c);
    }
    if (added.length) groups.push({ team_id: t.id, name: t.name, track: t.track, existing: true, keep: t.members.map((m) => m.name), students: added });
  }

  // 2) form new teams of 4 from whoever is left
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const leftover: Candidate[] = [];
  let n = 1;
  while (pool.length) {
    const seed = pool[0];
    take(seed);
    const members = [seed];
    for (let c = best(members, commonTrack(members), pool); c && members.length < 4; c = best(members, commonTrack(members), pool)) { members.push(c); take(c); }
    if (members.length === 4) {
      let name = `Team ${n++}`;
      while (taken.has(name.toLowerCase())) name = `Team ${n++}`;
      taken.add(name.toLowerCase());
      groups.push({ team_id: null, name, track: commonTrack(members), existing: false, keep: [], students: members });
    } else {
      // couldn't make a valid 4: hand the seed back for manual placement, release the others
      leftover.push(seed);
      members.slice(1).forEach((m) => pool.push(m));
    }
  }
  return { groups, leftover };
}
