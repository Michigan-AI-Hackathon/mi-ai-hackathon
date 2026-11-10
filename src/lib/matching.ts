// Organizer matching. PURE functions only (no imports, no I/O) so they can be unit tested with node.
// This only PROPOSES. The database (admin_apply_matching -> team_add_problem) re-checks every rule
// when an organizer applies, and nothing is applied without that click.
//
// Rules mirrored from the database (team_add_problem / team_lock_problem):
//   * at most `cap` (4) people on a team
//   * at most 2 people from the same school (each campus is its own school)
//   * at most ONE school may have 2 people, so a full team always has 3+ schools
//   * locked teams are never touched

export type Mode = "pre" | "day"; // pre = everyone registered counts; day = only checked-in people are present

export type Person = {
  id: string; name: string;
  group: string;            // school/campus key used by the rules (school_group)
  school: string;           // display name
  schoolId: number;
  tracks: string[]; skills: string[];
  checkedIn: boolean;
  ready: boolean;           // finished profile (and paid, when payment is required)
  teamId: string | null;
  wantsPlacement?: boolean; // student asked organizers to place them on a team
};
export type Team = { id: string; name: string; track: string | null; locked: boolean };
export type Settings = { teamSize: number; allowForce: boolean; trackWeight: number };
export const DEFAULT_SETTINGS: Settings = { teamSize: 4, allowForce: false, trackWeight: 3 };
export type Filters = { school: number | null; track: string | null; checkedInOnly: boolean };
export const NO_FILTERS: Filters = { school: null, track: null, checkedInOnly: false };

// ---------------------------------------------------------------- rules
export function canAdd(members: { group: string }[], c: { group: string }, cap = 4): boolean {
  if (members.length >= cap) return false;
  const same = members.filter((m) => m.group === c.group).length;
  if (same >= 2) return false;
  if (same === 1) {
    const counts = new Map<string, number>();
    members.forEach((m) => counts.set(m.group, (counts.get(m.group) ?? 0) + 1));
    if ([...counts.values()].some((n) => n >= 2)) return false;
  }
  return true;
}

// Plain-language problems with a roster (empty = fine). `size` problems are reported separately by callers.
export function mixProblems(members: { group: string; school: string }[], cap = 4): string[] {
  const out: string[] = [];
  if (members.length > cap) out.push(`More than ${cap} people`);
  const counts = new Map<string, { n: number; school: string }>();
  members.forEach((m) => counts.set(m.group, { n: (counts.get(m.group)?.n ?? 0) + 1, school: m.school }));
  const over = [...counts.values()].filter((c) => c.n > 2);
  over.forEach((c) => out.push(`${c.n} people from ${c.school} (max 2)`));
  const doubles = [...counts.values()].filter((c) => c.n === 2);
  if (doubles.length > 1) out.push("Two schools have 2 people each");
  if (members.length >= 4 && counts.size < 3) out.push("Fewer than 3 schools");
  return out;
}

export const isPresent = (p: Person, mode: Mode) => mode === "pre" || p.checkedIn;

export function personMatches(p: Person, f: Filters): boolean {
  if (f.school != null && p.schoolId !== f.school) return false;
  if (f.track && !p.tracks.includes(f.track)) return false;
  if (f.checkedInOnly && !p.checkedIn) return false;
  return true;
}

// ---------------------------------------------------------------- cohorts
export type TeamView = {
  team: Team; members: Person[]; present: Person[]; absent: Person[];
  problems: string[];       // what is wrong, in plain words
  complete: boolean;        // full, rules fine, and (day-of) everyone here
};
export type Cohorts = {
  noShows: { person: Person; team: Team }[];  // (a)
  soloPresent: Person[];                       // (b)
  incomplete: TeamView[];                      // (c)
  soloAbsent: Person[];                        // (d)
  valid: TeamView[];                           // (e)
  notReady: number;                            // signed up but profile unfinished / unpaid (not matched)
  openSeats: number;                           // seats on unlocked teams
};

export function teamViews(people: Person[], teams: Team[], mode: Mode, s: Settings = DEFAULT_SETTINGS): TeamView[] {
  const by = new Map<string, Person[]>();
  people.forEach((p) => { if (p.teamId) by.set(p.teamId, [...(by.get(p.teamId) ?? []), p]); });
  return teams.filter((t) => by.has(t.id)).map((team) => {
    const members = by.get(team.id) ?? [];
    const present = members.filter((m) => isPresent(m, mode));
    const absent = members.filter((m) => !isPresent(m, mode));
    const problems = mixProblems(members, 4);
    if (members.length < s.teamSize) problems.unshift(`Needs ${s.teamSize - members.length} more`);
    if (absent.length) problems.push(`${absent.length} not here`);
    return { team, members, present, absent, problems, complete: problems.length === 0 };
  });
}

function teamTouches(v: TeamView, f: Filters): boolean {
  const any = f.school != null || !!f.track || f.checkedInOnly;
  if (!any) return true;
  return v.members.some((m) => personMatches(m, f)) || (!!f.track && v.team.track === f.track && f.school == null && !f.checkedInOnly);
}

export function classify(people: Person[], teams: Team[], mode: Mode, s: Settings = DEFAULT_SETTINGS, f: Filters = NO_FILTERS): Cohorts {
  const views = teamViews(people, teams, mode, s).filter((v) => teamTouches(v, f));
  const noShows = views.flatMap((v) => v.absent.filter((p) => personMatches(p, { ...f, checkedInOnly: false })).map((person) => ({ person, team: v.team })));
  const solos = people.filter((p) => !p.teamId && p.ready && personMatches(p, f));
  const openSeats = teamViews(people, teams, mode, s).filter((v) => !v.team.locked).reduce((n, v) => n + Math.max(0, s.teamSize - v.members.length), 0);
  return {
    noShows,
    soloPresent: solos.filter((p) => isPresent(p, mode)),
    soloAbsent: solos.filter((p) => !isPresent(p, mode)),
    incomplete: views.filter((v) => !v.complete),
    valid: views.filter((v) => v.complete),
    notReady: people.filter((p) => !p.teamId && !p.ready).length,
    openSeats,
  };
}

// ---------------------------------------------------------------- suggestions
export type NewTeam = { key: string; name: string; track: string | null };
export type Place = { id: string; kind: "place"; student: string; to: { team: string } | { newTeam: string }; score: number; reasons: string[] };
export type Release = { id: string; kind: "release"; student: string; team: string };
export type Mark = { id: string; kind: "mark"; student: string; team: string };
export type Move = Place | Release | Mark;
export type Suggestion = {
  moves: Move[]; newTeams: NewTeam[];
  leftover: string[];                              // present solo students nobody could take
  advice: Record<string, "release" | "keep">;      // per no-show: a hint only, the organizer decides
};
export type SuggestOptions = {
  mode: Mode; settings?: Settings; filters?: Filters;
  releases?: Iterable<string>;   // no-shows the organizer chose to release
  marks?: Iterable<string>;      // no-shows the organizer chose to mark
  takenNames?: string[];
};

const mostCommon = (xs: string[]): string | null => {
  const n = new Map<string, number>();
  xs.forEach((x) => n.set(x, (n.get(x) ?? 0) + 1));
  return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
};

// How good a fit is `c` for a team that currently has `members` and aims at `track`?
export function fitScore(members: Person[], track: string | null, c: Person, s: Settings = DEFAULT_SETTINGS): { score: number; reasons: string[] } {
  let score = 0; const reasons: string[] = [];
  if (track && c.tracks.includes(track)) { score += s.trackWeight; reasons.push(`Same track (${track})`); }
  const shared = Math.min(2, members.reduce((n, m) => n + m.tracks.filter((t) => c.tracks.includes(t)).length, 0));
  if (shared > 0) score += shared * 0.5;
  const have = new Set(members.flatMap((m) => m.skills.map((k) => k.toLowerCase())));
  const fresh = c.skills.filter((k) => !have.has(k.toLowerCase()));
  if (fresh.length) { score += Math.min(3, fresh.length) * 0.6; reasons.push(`Adds ${fresh.slice(0, 2).join(", ")}`); }
  if (!members.some((m) => m.group === c.group)) { score += 2; if (members.length) reasons.push("New school"); }
  else score -= 1; // a second person from one school is allowed but a last resort
  if (members.length + 1 >= 4) score += 1.5;
  return { score, reasons };
}

export function suggest(people: Person[], teams: Team[], o: SuggestOptions): Suggestion {
  const s = o.settings ?? DEFAULT_SETTINGS, f = o.filters ?? NO_FILTERS, mode = o.mode, cap = s.teamSize;
  const releases = new Set(o.releases ?? []), marks = new Set(o.marks ?? []);
  const byId = new Map(people.map((p) => [p.id, p]));
  const teamOf = new Map(teams.map((t) => [t.id, t]));

  const moves: Move[] = [];
  // Roster per unlocked team after the organizer's own release choices. Existing members always stay together.
  const roster = new Map<string, Person[]>();
  teams.forEach((t) => roster.set(t.id, []));
  people.forEach((p) => { if (p.teamId && roster.has(p.teamId)) roster.get(p.teamId)!.push(p); });
  for (const id of releases) {
    const p = byId.get(id);
    if (!p?.teamId || teamOf.get(p.teamId)?.locked || isPresent(p, mode)) continue; // never release someone who is here, or on a locked team
    roster.set(p.teamId, roster.get(p.teamId)!.filter((m) => m.id !== id));
    moves.push({ id: `release:${id}`, kind: "release", student: id, team: p.teamId });
  }
  for (const id of marks) {
    const p = byId.get(id);
    if (p?.teamId && !releases.has(id) && !isPresent(p, mode)) moves.push({ id: `mark:${id}`, kind: "mark", student: id, team: p.teamId });
  }

  // Candidates: ready, no team, present, and inside the organizer's filters.
  const allSolos = people.filter((p) => !p.teamId && p.ready && isPresent(p, mode));
  let pool = allSolos.filter((p) => personMatches(p, f)).sort((a, b) => (a.id < b.id ? -1 : 1));

  // Advice for no-shows: release only if someone present could actually take the seat.
  const advice: Record<string, "release" | "keep"> = {};
  for (const p of people) {
    if (!p.teamId || isPresent(p, mode)) continue;
    const t = teamOf.get(p.teamId);
    if (!t || t.locked) continue;
    const without = people.filter((m) => m.teamId === p.teamId && m.id !== p.id);
    advice[p.id] = allSolos.some((c) => canAdd(without, c, cap)) ? "release" : "keep";
  }

  const placed: Place[] = [];
  const newTeams: NewTeam[] = [];

  // 1) Fill incomplete existing teams, best (team, student) pair first. Teams with people already here go first.
  const open = () => teams.filter((t) => !t.locked && roster.get(t.id)!.length < cap && roster.get(t.id)!.length > 0);
  for (;;) {
    let best: { t: Team; c: Person; sc: number; reasons: string[] } | null = null;
    for (const t of open()) {
      const members = roster.get(t.id)!;
      const track = t.track ?? mostCommon(members.flatMap((m) => m.tracks));
      const urgency = members.filter((m) => isPresent(m, mode)).length * 0.4 + members.length * 0.2;
      for (const c of pool) {
        if (!canAdd(members, c, cap)) continue;
        const r = fitScore(members, track, c, s);
        const sc = r.score + urgency;
        if (!best || sc > best.sc + 1e-9) best = { t, c, sc, reasons: r.reasons };
      }
    }
    if (!best) break;
    roster.get(best.t.id)!.push(best.c);
    pool = pool.filter((p) => p.id !== best!.c.id);
    placed.push({ id: `place:${best.c.id}`, kind: "place", student: best.c.id, to: { team: best.t.id }, score: Math.round(best.sc * 10) / 10, reasons: best.reasons });
  }

  // 2) New teams from whoever is left. Seed from the biggest school group (hardest to place), then add best fits.
  const names = new Set([...(o.takenNames ?? []), ...teams.map((t) => t.name)].map((n) => n.toLowerCase()));
  const failed = new Set<string>();
  while (pool.length >= cap) {
    const size = new Map<string, number>();
    pool.forEach((p) => size.set(p.group, (size.get(p.group) ?? 0) + 1));
    const seeds = pool.filter((p) => !failed.has(p.id)).sort((a, b) => (size.get(b.group)! - size.get(a.group)!) || (a.id < b.id ? -1 : 1));
    const seed = seeds[0];
    if (!seed) break;
    const trackPop = new Map<string, number>();
    pool.forEach((p) => p.tracks.forEach((t) => trackPop.set(t, (trackPop.get(t) ?? 0) + 1)));
    const seedTrack = [...seed.tracks].sort((a, b) => (trackPop.get(b)! - trackPop.get(a)!) || (a < b ? -1 : 1))[0] ?? null;
    const team: Person[] = [seed], reasons = new Map<string, { score: number; reasons: string[] }>([[seed.id, { score: 0, reasons: seedTrack ? [`Track: ${seedTrack}`] : [] }]]);
    let track = seedTrack;
    while (team.length < cap) {
      let pick: Person | null = null, top = -Infinity, why: string[] = [];
      for (const c of pool) {
        if (team.includes(c) || !canAdd(team, c, cap)) continue;
        const r = fitScore(team, track, c, s);
        if (r.score > top + 1e-9) { top = r.score; pick = c; why = r.reasons; }
      }
      if (!pick) break;
      team.push(pick); reasons.set(pick.id, { score: Math.round(top * 10) / 10, reasons: why });
      track = mostCommon(team.flatMap((m) => m.tracks)) ?? track;
    }
    if (team.length < cap) { failed.add(seed.id); continue; }
    const common = mostCommon(team.flatMap((m) => m.tracks));
    const shared = common && team.filter((m) => m.tracks.includes(common)).length >= 2 ? common : null;
    const n = newTeams.length + 1;
    let name = `${shared ?? "Open"} team ${n}`, k = n;
    while (names.has(name.toLowerCase())) name = `${shared ?? "Open"} team ${++k}`;
    names.add(name.toLowerCase());
    const key = `new-${n}`;
    newTeams.push({ key, name, track: shared });
    const ids = new Set(team.map((m) => m.id));
    pool = pool.filter((p) => !ids.has(p.id));
    team.forEach((m) => placed.push({ id: `place:${m.id}`, kind: "place", student: m.id, to: { newTeam: key }, score: reasons.get(m.id)!.score, reasons: reasons.get(m.id)!.reasons }));
  }

  return { moves: [...moves, ...placed], newTeams, leftover: pool.map((p) => p.id), advice };
}

// ---------------------------------------------------------------- before / after for the review screen
export type TeamAfter = {
  key: string; name: string; track: string | null; isNew: boolean; locked: boolean;
  before: Person[]; after: Person[]; added: Person[]; removed: Person[];
  problems: string[]; fresh: boolean;
};

// `accepted` = the moves currently switched on. Only teams touched by an accepted move are returned.
export function resolve(people: Person[], teams: Team[], newTeams: NewTeam[], moves: Move[], accepted: Set<string>, s: Settings = DEFAULT_SETTINGS): TeamAfter[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const out = new Map<string, TeamAfter>();
  const get = (key: string): TeamAfter | null => {
    if (out.has(key)) return out.get(key)!;
    const t = teams.find((x) => x.id === key), nt = newTeams.find((x) => x.key === key);
    if (!t && !nt) return null;
    const before = t ? people.filter((p) => p.teamId === t.id) : [];
    const row: TeamAfter = { key, name: (t ?? nt)!.name, track: (t ?? nt)!.track, isNew: !t, locked: !!t?.locked, before, after: [...before], added: [], removed: [], problems: [], fresh: false };
    out.set(key, row); return row;
  };
  for (const m of moves) {
    if (!accepted.has(m.id)) continue;
    const p = byId.get(m.student); if (!p) continue;
    if (m.kind === "release") { const r = get(m.team); if (r) { r.after = r.after.filter((x) => x.id !== p.id); r.removed.push(p); } }
    if (m.kind === "place") { const r = get("team" in m.to ? m.to.team : m.to.newTeam); if (r) { r.after.push(p); r.added.push(p); } }
  }
  for (const r of out.values()) {
    r.problems = mixProblems(r.after, 4);
    if (r.after.length > s.teamSize) r.problems.push(`More than ${s.teamSize} people`);
    if (r.after.length < s.teamSize) r.problems.push(`Still needs ${s.teamSize - r.after.length}`);
    r.fresh = r.problems.length === 0;
  }
  return [...out.values()];
}

// True when a roster breaks the add rules (needs "ignore school rules" to apply). "Needs more people" does not count.
export function mixBroken(r: { after: { group: string }[] }): boolean {
  const counts = new Map<string, number>();
  r.after.forEach((m) => counts.set(m.group, (counts.get(m.group) ?? 0) + 1));
  const n = [...counts.values()];
  return r.after.length > 4 || n.some((x) => x > 2) || n.filter((x) => x === 2).length > 1;
}

// The payload the server action sends to admin_apply_matching.
export function toPayload(moves: Move[], accepted: Set<string>, newTeams: NewTeam[], force: boolean) {
  const on = moves.filter((m) => accepted.has(m.id));
  const groups = new Map<string, string[]>();
  on.forEach((m) => { if (m.kind === "place") { const k = "team" in m.to ? m.to.team : `new:${m.to.newTeam}`; groups.set(k, [...(groups.get(k) ?? []), m.student]); } });
  return {
    force,
    releases: on.filter((m): m is Release => m.kind === "release").map((m) => ({ student: m.student, team: m.team })),
    marks: on.filter((m): m is Mark => m.kind === "mark").map((m) => ({ student: m.student, team: m.team })),
    teams: [...groups.entries()].map(([k, students]) => {
      const nt = k.startsWith("new:") ? newTeams.find((t) => t.key === k.slice(4)) : null;
      return { team_id: nt ? null : k, name: nt?.name ?? "", track: nt?.track ?? null, students };
    }),
  };
}


// ---- team-chat notices: the exact text admin_apply_matching posts (kept in step with 0014_matching.sql)
export type NoticeReason = "solo" | "noshow" | "incomplete";
const cleanName = (n: string | null | undefined) => (n ?? "").replace(/[\p{Cc}\s]+/gu, " ").trim().slice(0, 40) || "A new teammate";
const joinNames = (a: string[]) => (a.length === 0 ? "your teammates" : a.length === 1 ? a[0] : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
export const REASON_TEXT: Record<NoticeReason, string> = {
  noshow: "Their teammates didn't show up, so they were placed with you.",
  incomplete: "Their team was incomplete, so they were placed with you.",
  solo: "They were looking for a team, so they were placed with you.",
};
export const joinNotice = (name: string, reason: NoticeReason) => `${cleanName(name)} joined your team. ${REASON_TEXT[reason]} Say hi and keep going!`;
export const welcomeNotice = (name: string, mates: string[]) => `Welcome, ${cleanName(name)}! Your teammates are ${joinNames(mates.map(cleanName))}. Say hi and keep going!`;
export const newTeamNotice = (members: string[]) => `Welcome to the team! An organizer put you together: ${joinNames(members.map(cleanName))}. Say hi and keep going!`;

// Same reasoning as the database: a student who is also released from another team moves because their teammates
// were released/marked too ("noshow") or just because that team was incomplete; otherwise they were solo.
export function noticeReason(student: string, releases: { student: string; team: string }[], marks: { student: string; team: string }[]): NoticeReason {
  const rel = releases.find((r) => r.student === student);
  if (!rel) return "solo";
  return [...releases, ...marks].some((o) => o.team === rel.team && o.student !== student) ? "noshow" : "incomplete";
}

/** What each affected team will see, for the confirm dialog. Uses the same payload that gets sent. */
export function previewNotices(payload: ReturnType<typeof toPayload>, people: Person[], teams: Team[]): { team: string; isNew: boolean; messages: string[] }[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const nm = (id: string) => byId.get(id)?.name ?? "";
  return payload.teams.map((g) => {
    const existing = g.team_id ? people.filter((p) => p.teamId === g.team_id && !payload.releases.some((r) => r.student === p.id)).map((p) => p.id) : [];
    const everyone = [...existing, ...g.students];
    const messages: string[] = [];
    if (!g.team_id) messages.push(newTeamNotice(everyone.map(nm)));
    else {
      g.students.forEach((s) => {
        messages.push(joinNotice(nm(s), noticeReason(s, payload.releases, payload.marks)));
        messages.push(welcomeNotice(nm(s), everyone.filter((x) => x !== s).map(nm)));
      });
    }
    return { team: g.team_id ? teams.find((t) => t.id === g.team_id)?.name ?? "Team" : g.name || "New team", isNew: !g.team_id, messages };
  });
}
