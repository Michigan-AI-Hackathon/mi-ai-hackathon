import "server-only";
import { cookies } from "next/headers";

// DEV ONLY. In `next dev`, a cookie turns the whole app into a clickable preview with fake
// students, teams and messages, so every page can be designed without signing in.
// Does nothing in production builds (NODE_ENV is "production" there).
export type Scenario = "unpaid" | "solo" | "team";
export const isDev = process.env.NODE_ENV === "development";

export async function devScenario(): Promise<Scenario | null> {
  if (!isDev) return null;
  const v = (await cookies()).get("dev_preview")?.value;
  return v === "unpaid" || v === "solo" || v === "team" ? v : null;
}

const ME = "00000000-0000-4000-8000-000000000001";
const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const T3 = "10000000-0000-4000-8000-000000000003";
const T4 = "10000000-0000-4000-8000-000000000004";
const iso = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const people = [
  ["Priya Shah", 4, "Michigan State University", "msu", "Computer science", ["Machine learning", "Backend"], ["FinTech"], "preset-2", T1, "Maize Mind"],
  ["Marcus Bell", 5, "Wayne State University", "wayne", "Finance", ["Finance", "Pitching"], ["FinTech", "Industry 4.0"], null, T1, "Maize Mind"],
  ["Elena Rossi", 53, "Calvin University", "calvin", "Nursing", ["Healthcare", "Research"], ["HealthTech"], "preset-3", T2, "Pulse Labs"],
  ["Devon Carter", 9, "Grand Valley State University", "gvsu", "Industrial design", ["UI/UX design", "Hardware"], ["Industry 4.0"], null, T2, "Pulse Labs"],
  ["Hana Kim", 2, "University of Michigan – Dearborn", "umd", "Software engineering", ["Mobile", "Frontend"], ["SportsTech"], "preset-1", T3, "Sideline"],
  ["Jordan Okafor", 11, "Michigan Technological University", "mtu", "Mechanical engineering", ["Hardware", "Data analysis"], ["Industry 4.0", "SportsTech"], null, null, null],
  ["Sofia Alvarez", 66, "Lawrence Technological University", "ltu", "Architecture", ["UI/UX design", "Writing"], ["HealthTech"], "preset-4", null, null],
  ["Tyler Nguyen", 10, "Oakland University", "oakland", "Marketing", ["Marketing", "Pitching"], ["SportsTech", "FinTech"], null, null, null],
  ["Amara Johnson", 7, "Eastern Michigan University", "emu", "Public health", ["Healthcare", "Research"], ["HealthTech"], "preset-2", null, null],
  ["Noah Becker", 62, "Hope College", "hope", "Economics", ["Finance", "Data analysis"], ["FinTech"], null, null, null],
  ["Zoe Martin", 6, "Central Michigan University", "cmu", "Cognitive science", ["Machine learning", "Research"], ["HealthTech", "FinTech"], "preset-3", null, null],
  ["Ravi Patel", 64, "Kettering University", "kettering", "Computer engineering", ["Backend", "Hardware"], ["Industry 4.0"], null, T4, "Gearbox"],
] as const;

function build(scenario: Scenario) {
  const meTeam = scenario === "team" ? T1 : null;
  const dir = [
    { id: ME, full_name: "Alex Rivera", school_id: 1, school_name: "University of Michigan – Ann Arbor", school_group: "school-1", study_area: "Information science",
      skills: ["Frontend", "Product management"], interests: ["Startups"], tracks: ["FinTech"], bio: "Looking for someone who knows finance and a strong backend engineer.",
      looking_for_team: true, linkedin_url: null, team_id: meTeam, team_name: meTeam ? "Maize Mind" : null, avatar_url: "preset-1" },
    ...people.map((p, i) => ({
      id: `20000000-0000-4000-8000-0000000000${String(i + 10)}`, full_name: p[0], school_id: p[1], school_name: p[2], school_group: `school-${p[1]}`,
      study_area: p[4], skills: [...p[5]], interests: ["Startups"], tracks: [...p[6]],
      bio: i % 2 ? "Happy to be the builder on a team. Interested in real problems, not demos." : "Looking for teammates who ship. I can handle the research and the pitch.",
      looking_for_team: !p[8], linkedin_url: null, team_id: scenario === "team" || p[8] !== T1 ? p[8] : null, team_name: scenario === "team" || p[8] !== T1 ? p[9] : null, avatar_url: p[7],
    })),
  ];
  const members = dir.filter((d) => d.team_id).map((d) => ({ team_id: d.team_id, user_id: d.id, teams: { name: d.team_name, locked_at: null } }));
  const teams = [
    { id: T1, name: "Maize Mind", track: "FinTech", needs: "A designer and someone with healthcare experience", created_at: iso(-60), locked_at: null },
    { id: T2, name: "Pulse Labs", track: "HealthTech", needs: "A backend engineer", created_at: iso(-40), locked_at: null },
    { id: T3, name: "Sideline", track: "SportsTech", needs: "Someone who knows data and sports analytics", created_at: iso(-20), locked_at: null },
    { id: T4, name: "Gearbox", track: "Industry 4.0", needs: null, created_at: iso(-5), locked_at: null },
  ].filter((t) => scenario === "team" || t.id !== T1);
  const live = teams.map((t) => t.id);
  const memberRows = members.filter((m) => live.includes(m.team_id!));
  const invites = scenario === "team"
    ? [{ id: "i1", kind: "request", team_id: T1, student_id: dir[7].id, sent_by: dir[7].id, status: "pending", expires_at: iso(30), created_at: iso(-4), teams: { name: "Maize Mind", track: "FinTech", needs: null } },
       { id: "i2", kind: "invite", team_id: T1, student_id: dir[8].id, sent_by: ME, status: "pending", expires_at: iso(41), created_at: iso(-2), teams: { name: "Maize Mind", track: "FinTech", needs: null } }]
    : [{ id: "i1", kind: "invite", team_id: T2, student_id: ME, sent_by: dir[3].id, status: "pending", expires_at: iso(36), created_at: iso(-3), teams: { name: "Pulse Labs", track: "HealthTech", needs: "A backend engineer" } },
       { id: "i2", kind: "request", team_id: T3, student_id: ME, sent_by: ME, status: "pending", expires_at: iso(20), created_at: iso(-9), teams: { name: "Sideline", track: "SportsTech", needs: null } },
       { id: "i3", kind: "invite", team_id: T4, student_id: ME, sent_by: dir[11].id, status: "declined", expires_at: iso(-30), created_at: iso(-80), teams: { name: "Gearbox", track: "Industry 4.0", needs: null } }];
  const profile = { id: ME, email: "alex.rivera@umich.edu", full_name: "Alex Rivera", school_id: 1, year: "Third year", study_area: "Information science",
    skills: ["Frontend", "Product management"], interests: ["Startups"], tracks: ["FinTech"], bio: dir[0].bio, looking_for_team: true, linkedin_url: null,
    onboarded_at: iso(-200), paid_at: scenario === "unpaid" ? null : iso(-150), is_admin: false, avatar_url: "preset-1" };
  const convs = [
    { conversation_id: "c1", kind: scenario === "team" ? "team" : "direct", title: scenario === "team" ? "Maize Mind" : "Devon Carter", last_body: "Sounds good, I can sketch the onboarding flow tonight.", last_at: iso(-1), unread: 2 },
    { conversation_id: "c2", kind: "direct", title: "Priya Shah", last_body: "Are you free to chat about the FinTech idea?", last_at: iso(-26), unread: 0 },
  ];
  const messages = [
    { id: 1, conversation_id: "c1", sender_id: dir[1].id, body: "Hey team, I was thinking we build a budgeting copilot for students.", created_at: iso(-5) },
    { id: 2, conversation_id: "c1", sender_id: ME, body: "Love it. I can own the frontend and the pitch.", created_at: iso(-4.5) },
    { id: 3, conversation_id: "c1", sender_id: dir[2].id, body: "Sounds good, I can sketch the onboarding flow tonight.", created_at: iso(-1) },
  ];
  return {
    profiles: [profile], student_directory: dir, team_members: members.filter((m) => m.user_id === ME || live.includes(m.team_id!)).concat([]),
    teams, invites, app_settings: [{ lock_deadline: null, require_payment: true }],
    conversations: [{ id: "c1", kind: scenario === "team" ? "team" : "direct", team_id: meTeam, teams: { name: "Maize Mind" } }],
    conversation_members: [{ conversation_id: "c1", user_id: ME }, { conversation_id: "c1", user_id: dir[1].id }],
    messages, schools: [{ id: 1, name: "University of Michigan – Ann Arbor" }, { id: 2, name: "University of Michigan – Dearborn" }, { id: 4, name: "Michigan State University" }, { id: 5, name: "Wayne State University" }],
    _convs: convs, _memberRows: memberRows,
  };
}

type Row = Record<string, unknown>;
class Query {
  private fns: ((r: Row) => boolean)[] = [];
  private head = false; private count = false; private lim = Infinity; private ord: [string, boolean] | null = null;
  constructor(private rows: Row[]) {}
  select(_c?: string, o?: { count?: string; head?: boolean }) { this.head = !!o?.head; this.count = !!o?.count; return this; }
  eq(c: string, v: unknown) { this.fns.push((r) => (r[c] ?? null) === (v ?? null)); return this; }
  neq(c: string, v: unknown) { this.fns.push((r) => (r[c] ?? null) !== (v ?? null)); return this; }
  is(c: string, v: unknown) { return this.eq(c, v); }
  in(c: string, v: unknown[]) { this.fns.push((r) => v.includes(r[c])); return this; }
  gt(c: string, v: string) { this.fns.push((r) => String(r[c]) > v); return this; }
  contains(c: string, v: unknown[]) { this.fns.push((r) => Array.isArray(r[c]) && v.every((x) => (r[c] as unknown[]).includes(x))); return this; }
  or(f: string) { const q = (f.match(/ilike\.%(.*?)%/)?.[1] ?? "").toLowerCase(); if (q) this.fns.push((r) => ["full_name", "study_area", "bio"].some((k) => String(r[k] ?? "").toLowerCase().includes(q))); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.ord = [c, o?.ascending !== false]; return this; }
  limit(n: number) { this.lim = n; return this; }
  insert() { return this; } update() { return this; } upsert() { return this; } delete() { return this; }
  private run() {
    let r = this.rows.filter((x) => this.fns.every((f) => f(x)));
    if (this.ord) { const [c, asc] = this.ord; r = [...r].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (asc ? 1 : -1)); }
    return r.slice(0, this.lim);
  }
  single() { return Promise.resolve({ data: this.run()[0] ?? null, error: null }); }
  maybeSingle() { return this.single(); }
  then<T>(res: (v: { data: Row[] | null; count: number | null; error: null }) => T) {
    const r = this.run();
    return Promise.resolve({ data: this.head ? null : r, count: this.count ? r.length : null, error: null }).then(res);
  }
}

export function createMockClient(scenario: Scenario) {
  const db = build(scenario) as unknown as Record<string, Row[]>;
  const me = db.profiles[0];
  const rpcs: Record<string, unknown> = {
    my_conversations: db._convs,
    team_lock_problem: scenario === "team" ? "You need 4 people to lock in. Your team has 3." : null,
    schools_for_email: db.schools,
    mark_read: null,
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: me.id, email: me.email } }, error: null }) },
    from: (t: string) => new Query(t === "team_members" ? db._memberRows.length ? [...db.team_members, ...db._memberRows.filter((m) => !db.team_members.includes(m))] : db.team_members : db[t] ?? []),
    rpc: async (fn: string) => (fn in rpcs ? { data: rpcs[fn], error: null } : { data: null, error: { message: "Preview mode: actions are turned off." } }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  };
}
