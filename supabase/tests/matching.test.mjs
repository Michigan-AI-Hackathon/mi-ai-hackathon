// Unit tests for src/lib/matching.ts (pure logic) and the 0014 database functions.
// No new dependencies: the TypeScript file is transpiled with the typescript package already in the repo,
// and the SQL runs in an in-memory Postgres (PGlite) like rules.test.mjs.
// Run: node supabase/tests/matching.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

const src = readFileSync(new URL("../../src/lib/matching.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "matching-"));
writeFileSync(join(dir, "matching.mjs"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const M = await import(join(dir, "matching.mjs"));

let n = 0;
const P = (name, group, o = {}) => ({ id: `p${++n}`, name, group, school: group, schoolId: n, tracks: [], skills: [], checkedIn: true, ready: true, teamId: null, ...o });
const T = (id, o = {}) => ({ id, name: id, track: null, locked: false, ...o });

// ---- rules
ok("canAdd: empty team", M.canAdd([], { group: "a" }));
ok("canAdd: 5th person refused", !M.canAdd([{ group: "a" }, { group: "b" }, { group: "c" }, { group: "d" }], { group: "e" }));
ok("canAdd: 3rd from one school refused", !M.canAdd([{ group: "a" }, { group: "a" }], { group: "a" }));
ok("canAdd: 2nd from one school allowed", M.canAdd([{ group: "a" }, { group: "b" }], { group: "a" }));
ok("canAdd: second doubled school refused", !M.canAdd([{ group: "a" }, { group: "a" }, { group: "b" }], { group: "b" }));
ok("canAdd: new school onto a doubled team allowed", M.canAdd([{ group: "a" }, { group: "a" }, { group: "b" }], { group: "c" }));
ok("mixProblems: 2+2 flagged", M.mixProblems([{ group: "a", school: "A" }, { group: "a", school: "A" }, { group: "b", school: "B" }, { group: "b", school: "B" }]).length > 0);
ok("mixProblems: 2+1+1 fine", M.mixProblems([{ group: "a", school: "A" }, { group: "a", school: "A" }, { group: "b", school: "B" }, { group: "c", school: "C" }]).length === 0);

// ---- cohorts, both modes
{
  const t1 = T("t1"), t2 = T("t2"), t3 = T("t3"), t4 = T("t4", { locked: true });
  const people = [
    P("a1", "A", { teamId: "t1" }), P("b1", "B", { teamId: "t1" }), P("c1", "C", { teamId: "t1" }), P("d1", "D", { teamId: "t1" }), // valid, all here
    P("a2", "A", { teamId: "t2" }), P("b2", "B", { teamId: "t2", checkedIn: false }),                                                // incomplete + no-show
    P("a3", "A", { teamId: "t3" }), P("a4", "A", { teamId: "t3" }), P("b3", "B", { teamId: "t3" }), P("b4", "B", { teamId: "t3" }), // 2+2, breaks the mix rule
    P("solo-here", "E"), P("solo-away", "F", { checkedIn: false }), P("unready", "G", { ready: false }),
  ];
  const day = M.classify(people, [t1, t2, t3, t4], "day");
  ok("day: 1 no-show", day.noShows.length === 1 && day.noShows[0].person.name === "b2");
  ok("day: solo present / absent", day.soloPresent.length === 1 && day.soloAbsent.length === 1);
  ok("day: valid = just t1", day.valid.length === 1 && day.valid[0].team.id === "t1");
  ok("day: t2 and t3 incomplete", day.incomplete.map((v) => v.team.id).sort().join() === "t2,t3");
  ok("day: broken mix is reported", day.incomplete.find((v) => v.team.id === "t3").problems.some((x) => x.includes("Two schools")));
  ok("not-ready students are counted, not matched", day.notReady === 1);
  const pre = M.classify(people, [t1, t2, t3], "pre");
  ok("pre: nobody is a no-show, every solo is present", pre.noShows.length === 0 && pre.soloPresent.length === 2 && pre.soloAbsent.length === 0);
  ok("pre: t2 incomplete only because it is small", pre.incomplete.find((v) => v.team.id === "t2").problems.join().includes("Needs 2"));
  const f = M.classify(people, [t1, t2, t3], "day", M.DEFAULT_SETTINGS, { school: null, track: null, checkedInOnly: true });
  ok("filter checked-in only hides absent solos", f.soloAbsent.length === 0);
  const sf = M.classify(people, [t1, t2, t3], "day", M.DEFAULT_SETTINGS, { school: people.find((p) => p.name === "solo-here").schoolId, track: null, checkedInOnly: false });
  ok("filter by school narrows the solos", sf.soloPresent.length === 1 && sf.soloAbsent.length === 0);
}

// ---- suggestions fill gaps, respect rules, keep members, skip locked teams
{
  const teams = [T("t1", { track: "FinTech" }), T("locked", { locked: true })];
  const people = [
    P("a", "A", { teamId: "t1", tracks: ["FinTech"] }), P("b", "B", { teamId: "t1", tracks: ["FinTech"] }), P("c", "C", { teamId: "t1", tracks: ["FinTech"] }),
    P("l1", "A", { teamId: "locked" }), P("l2", "B", { teamId: "locked" }),
    P("fin-d", "D", { tracks: ["FinTech"] }), P("health-e", "E", { tracks: ["HealthTech"] }),
    P("dup-a", "A", { tracks: ["FinTech"] }),
  ];
  const sug = M.suggest(people, teams, { mode: "pre" });
  const to = (name) => sug.moves.find((m) => m.kind === "place" && m.student === people.find((p) => p.name === name).id);
  ok("fills the open seat with the same-track student", to("fin-d")?.to.team === "t1");
  ok("nobody is placed on the locked team", !sug.moves.some((m) => m.kind === "place" && m.to.team === "locked"));
  ok("existing members are never moved", !sug.moves.some((m) => m.kind === "place" && ["a", "b", "c"].includes(people.find((p) => p.id === m.student).name)));
  ok("reasons explain the pick", to("fin-d").reasons.some((r) => r.includes("FinTech")));
  const after = M.resolve(people, teams, sug.newTeams, sug.moves, new Set(sug.moves.map((m) => m.id)));
  ok("resolve: team ends with 4, valid", after.find((r) => r.key === "t1").after.length === 4 && after.find((r) => r.key === "t1").problems.length === 0);
}

// ---- new teams from solos, never breaking the rules
{
  const people = [];
  for (const g of ["A", "A", "A", "B", "B", "C", "D", "E", "F"]) people.push(P(`s${people.length}`, g, { tracks: [people.length % 2 ? "FinTech" : "HealthTech"] }));
  const sug = M.suggest(people, [], { mode: "pre" });
  ok("9 solos -> 2 new teams of 4, 1 left over", sug.newTeams.length === 2 && sug.leftover.length === 1);
  const after = M.resolve(people, [], sug.newTeams, sug.moves, new Set(sug.moves.map((m) => m.id)));
  ok("every new team passes the rules and has 4", after.every((r) => r.after.length === 4 && r.problems.length === 0 && !M.mixBroken(r)));
  ok("no one is placed twice", new Set(sug.moves.map((m) => m.student)).size === sug.moves.length);
  const two = [P("x1", "A"), P("x2", "A"), P("x3", "A"), P("x4", "B")];
  const bad = M.suggest(two, [], { mode: "pre" });
  ok("4 students from 2 schools can't form a team", bad.newTeams.length === 0 && bad.leftover.length === 4);
  const names = M.suggest(people, [T("FinTech team 1"), T("HealthTech team 1")].map((t) => ({ ...t, locked: true })), { mode: "pre" }).newTeams.map((t) => t.name);
  ok("new team names don't clash with existing ones", names.every((n) => !["fintech team 1", "healthtech team 1"].includes(n.toLowerCase())));
}

// ---- day-of: no-shows hold their seat until the organizer says otherwise
{
  const teams = [T("t1")];
  const people = [
    P("a", "A", { teamId: "t1" }), P("b", "B", { teamId: "t1" }), P("z", "Z", { teamId: "t1" }), P("gone", "C", { teamId: "t1", checkedIn: false }),
    P("late-d", "D", { checkedIn: true }), P("away-e", "E", { checkedIn: false }),
  ];
  const gone = people.find((p) => p.name === "gone").id;
  const keep = M.suggest(people, teams, { mode: "day" });
  ok("day: default keeps the no-show's seat (no automatic release)", !keep.moves.some((m) => m.kind === "release") && !keep.moves.some((m) => m.kind === "place"));
  ok("day: advice says release because a present student fits", keep.advice[gone] === "release");
  const rel = M.suggest(people, teams, { mode: "day", releases: [gone] });
  ok("day: releasing frees the seat for the present solo", rel.moves.some((m) => m.kind === "release" && m.student === gone) && rel.moves.some((m) => m.kind === "place" && m.to.team === "t1"));
  ok("day: absent solo is never placed", !rel.moves.some((m) => m.kind === "place" && m.student === people.find((p) => p.name === "away-e").id));
  const mark = M.suggest(people, teams, { mode: "day", marks: [gone] });
  ok("day: mark only records, doesn't release", mark.moves.length === 1 && mark.moves[0].kind === "mark");
  ok("never releases someone who is present", M.suggest(people, teams, { mode: "day", releases: [people[0].id] }).moves.length === 0);
  const noOne = M.suggest(people.filter((p) => p.name !== "late-d"), teams, { mode: "day" });
  ok("day: advice is keep when nobody can take the seat", noOne.advice[gone] === "keep");
  const payload = M.toPayload(rel.moves, new Set(rel.moves.map((m) => m.id)), rel.newTeams, false);
  ok("payload: release + one team group", payload.releases.length === 1 && payload.teams.length === 1 && payload.teams[0].team_id === "t1");
  const none = M.toPayload(rel.moves, new Set(), rel.newTeams, false);
  ok("payload: nothing accepted -> nothing sent", none.releases.length === 0 && none.teams.length === 0);
}

// ---- settings change the result
{
  const t = [T("t1", { track: "FinTech" })];
  const ppl = [P("a", "A", { teamId: "t1" }), P("b", "B", { teamId: "t1" }), P("c", "C", { teamId: "t1" }),
    P("fin", "D", { tracks: ["FinTech"] }), P("other", "E", { tracks: ["HealthTech"], skills: ["Backend", "Hardware", "Pitching"] })];
  const hi = M.suggest(ppl, t, { mode: "pre", settings: { ...M.DEFAULT_SETTINGS, trackWeight: 10 } });
  ok("high track weight picks the same-track student", hi.moves.find((m) => m.kind === "place").student === ppl.find((p) => p.name === "fin").id);
  const lo = M.suggest(ppl, t, { mode: "pre", settings: { ...M.DEFAULT_SETTINGS, trackWeight: 0 } });
  ok("track weight 0 lets skills decide", lo.moves.find((m) => m.kind === "place").student === ppl.find((p) => p.name === "other").id);
}

// ---- parity with the database: canAdd must agree with team_add_problem on random rosters
const db = new PGlite({ extensions: { citext } });
const read = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8");
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create publication supabase_realtime;
`);
for (const f of ["0001_init", "0002_schools", "0005_team_rules_avatars", "0008_admin", "0009_checkin_and_system_messages", "0010_signup_sources", "0011_campus_schools", "0014_matching"]) await db.exec(read(f + ".sql"));
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;`);
const as = async (uid) => db.exec(`select set_config('test.uid', '${uid ?? ""}', false)`);
async function expectError(name, sql, match) {
  try { await db.query(sql); ok(name + " (should have failed)", false); }
  catch (e) { const good = !match || e.message.includes(match); ok(name, good); if (!good) console.log("   got:", e.message); }
}
let emailN = 0;
const domains = ["msu.edu", "wayne.edu", "oakland.edu", "gvsu.edu", "cmich.edu"];
async function student(domain, o = {}) {
  const id = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`s${++emailN}@${domain}`])).rows[0].id;
  await db.query(`update public.profiles set full_name=$2, onboarded_at=now(), paid_at=$3, checked_in_at=$4 where id=$1`, [id, `S${emailN}`, o.paid === false ? null : new Date(), o.in ? new Date() : null]);
  return id;
}
const adminId = (await db.query(`insert into auth.users (email) values ('boss@umich.edu') returning id`)).rows[0].id;
await db.query(`update public.profiles set is_admin = true where id = $1`, [adminId]);

// parity: random rosters of up to 4, random candidate
{
  const pool = [];
  for (let i = 0; i < 12; i++) pool.push({ id: await student(domains[i % domains.length]), group: `g${i % domains.length}` });
  const sch = new Map((await db.query(`select p.id, public.school_group(p.school_id) g from public.profiles p`)).rows.map((r) => [r.id, r.g]));
  pool.forEach((p) => { p.group = sch.get(p.id); });
  let agree = 0, total = 0, seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 120; k++) {
    const shuffled = [...pool].sort(() => rnd() - 0.5);
    const size = Math.floor(rnd() * 5);
    const roster = shuffled.slice(0, size), cand = shuffled[size];
    const tid = (await db.query(`insert into public.teams (name) values ($1) returning id`, [`R${k}`])).rows[0].id;
    for (const m of roster) await db.query(`insert into public.team_members (team_id, user_id) values ($1,$2)`, [tid, m.id]);
    const dbOk = (await db.query(`select public.team_add_problem($1,$2) p`, [tid, cand.id])).rows[0].p === null;
    total++; if (dbOk === M.canAdd(roster, cand, 4)) agree++;
    await db.query(`delete from public.teams where id=$1`, [tid]);
  }
  ok(`canAdd agrees with team_add_problem on ${total} random rosters`, agree === total);
}

// ---- 0014 functions
{
  const a = await student("msu.edu", { in: true }), b = await student("wayne.edu", { in: true }), c = await student("oakland.edu", { in: true });
  const gone = await student("gvsu.edu", { in: false });
  const late = await student("cmich.edu", { in: true });
  const late2 = await student("cmich.edu", { in: true });
  const nobody = await student("msu.edu");
  await db.query(`update public.profiles set is_admin = false where id = $1`, [nobody]);
  await as(adminId);
  const team = (await db.query(`insert into public.teams (name) values ('Matching test') returning id`)).rows[0].id;
  for (const m of [a, b, c, gone]) await db.query(`insert into public.team_members (team_id, user_id) values ($1,$2)`, [team, m]);

  await as(nobody);
  await expectError("students can't read settings", `select public.admin_matching_settings()`, "Organizers only");
  await expectError("students can't apply a plan", `select public.admin_apply_matching('{}'::jsonb)`, "Organizers only");
  await expectError("students can't release seats", `select public.admin_release_seat('${gone}')`, "Organizers only");
  await as(adminId);
  ok("defaults: size 4, no forcing", (await db.query(`select public.admin_matching_settings() s`)).rows[0].s.allow_force_school_mix === false);
  await expectError("bad team size refused", `select public.admin_set_matching_settings(5, false, 3)`, "3 or 4");

  const plan = (o) => JSON.stringify({ force: false, releases: [], marks: [], teams: [], ...o });
  const apply = (o) => db.query(`select public.admin_apply_matching($1::jsonb) r`, [plan(o)]);
  await expectError("placing into a full team is refused, nothing changes", `select public.admin_apply_matching('${plan({ teams: [{ team_id: team, students: [late] }] })}')`, "over 4");
  await expectError("force needs the setting", `select public.admin_apply_matching('${plan({ force: true })}')`, "turned off");
  await expectError("release of someone not on that team is refused", `select public.admin_apply_matching('${plan({ releases: [{ student: late, team }] })}')`, "no longer on that team");

  const r = (await apply({ marks: [{ student: b, team }], releases: [{ student: gone, team }], teams: [{ team_id: team, students: [late] }, { team_id: null, name: "Fresh", track: "FinTech", students: [late2] }] })).rows[0].r;
  ok("apply: 1 released, 2 placed, 1 new team", r.released === 1 && r.placed === 2 && r.new_teams === 1);
  ok("apply: released student is on no team", (await db.query(`select count(*)::int c from public.team_members where user_id=$1`, [gone])).rows[0].c === 0);
  ok("apply: team now has a, b, c, late", (await db.query(`select count(*)::int c from public.team_members where team_id=$1`, [team])).rows[0].c === 4);
  ok("apply is audited", (await db.query(`select count(*)::int c from public.audit_log where action in ('apply_matching','mark_no_show')`)).rows[0].c >= 2);

  // a rule break rolls everything back (two from the same school, then a third)
  const m1 = await student("msu.edu"), m2 = await student("msu.edu"), m3 = await student("msu.edu");
  await expectError("rule break rolls the whole plan back", `select public.admin_apply_matching('${plan({ teams: [{ team_id: null, name: "Bad", students: [m1, m2, m3] }] })}')`, "at most 2");
  ok("rolled back: no 'Bad' team", (await db.query(`select count(*)::int c from public.teams where name='Bad'`)).rows[0].c === 0);
  ok("rolled back: m1 still free", (await db.query(`select count(*)::int c from public.team_members where user_id=$1`, [m1])).rows[0].c === 0);

  // locked team can't be released from
  await db.query(`update public.teams set locked_at = now() where id = $1`, [team]);
  await expectError("release on a locked team refused", `select public.admin_release_seat('${a}')`, "locked");
  await db.query(`update public.teams set locked_at = null where id = $1`, [team]);
  await db.query(`select public.admin_release_seat('${a}', null, 'no show')`);
  ok("admin_release_seat removes the member", (await db.query(`select count(*)::int c from public.team_members where user_id=$1`, [a])).rows[0].c === 0);
  await expectError("release when not on a team refused", `select public.admin_release_seat('${a}')`, "not on a team");

  // forcing (only when the setting is on) lets 3 from one school through, but never past 4
  await db.query(`select public.admin_set_matching_settings(4, true, 3)`);
  await apply({ force: true, teams: [{ team_id: null, name: "Forced", students: [m1, m2, m3] }] });
  ok("force on: 3 from one school placed", (await db.query(`select count(*)::int c from public.team_members tm join public.teams t on t.id=tm.team_id where t.name='Forced'`)).rows[0].c === 3);
  const ft = (await db.query(`select id from public.teams where name='Forced'`)).rows[0].id;
  const x1 = await student("wayne.edu"), x2 = await student("gvsu.edu");
  await expectError("force never goes past the team size", `select public.admin_apply_matching('${plan({ force: true, teams: [{ team_id: ft, students: [x1, x2] }] })}')`, "over 4");
  await db.query(`select public.admin_set_matching_settings(3, false, 3)`);
  await expectError("target size 3 stops a 4th person", `select public.admin_apply_matching('${plan({ teams: [{ team_id: ft, students: [x1, x2] }] })}')`, "over 3");
}

// ---- team-chat notices (default on, in the same transaction)
{
  await db.query(`select public.admin_set_matching_settings(4, false, 3)`);
  await as(adminId);
  const plan = (o) => JSON.stringify({ force: false, releases: [], marks: [], teams: [], ...o });
  const run = (o) => db.query(`select public.admin_apply_matching($1::jsonb) r`, [plan(o)]);
  const nameOf = async (id) => (await db.query(`select full_name n from public.profiles where id=$1`, [id])).rows[0].n;
  const mkTeam = async (name, members) => {
    const id = (await db.query(`insert into public.teams (name) values ($1) returning id`, [name])).rows[0].id;
    for (const m of members) { await db.query(`insert into public.team_members (team_id, user_id) values ($1,$2)`, [id, m]); await db.query(`select public.add_to_team_conversation($1,$2)`, [id, m]); }
    return id;
  };
  const chat = async (teamId) => (await db.query(`select m.body, m.sender_id from public.messages m join public.conversations c on c.id=m.conversation_id where c.team_id=$1 order by m.id`, [teamId])).rows;
  const inChat = async (teamId, uid) => (await db.query(`select count(*)::int c from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id where c.team_id=$1 and cm.user_id=$2`, [teamId, uid])).rows[0].c === 1;
  const msgCount = async () => (await db.query(`select count(*)::int c from public.messages`)).rows[0].c;
  const D = domains;

  // 1) existing team X (p1,p2); team Y (q1 here, q2 no-show) is emptied; q1 moves to X; solo s joins X too
  const p1 = await student(D[0], { in: true }), p2 = await student(D[1], { in: true });
  const q1 = await student(D[2], { in: true }), q2 = await student(D[3], { in: false }), s1 = await student(D[4], { in: true });
  const X = await mkTeam("Notice X", [p1, p2]), Y = await mkTeam("Notice Y", [q1, q2]);
  const before = await msgCount();
  await run({ releases: [{ student: q1, team: Y }, { student: q2, team: Y }], teams: [{ team_id: X, students: [q1, s1] }] });
  const msgs = (await chat(X)).map((m) => m.body);
  const [nq1, ns1, np1, np2] = await Promise.all([q1, s1, p1, p2].map(nameOf));
  ok("notice: teammates told the placed student's teammates didn't show up", msgs.includes(`${nq1} joined your team. Their teammates didn't show up, so they were placed with you. Say hi and keep going!`));
  ok("notice: solo student told as 'looking for a team'", msgs.includes(`${ns1} joined your team. They were looking for a team, so they were placed with you. Say hi and keep going!`));
  ok("TS preview text matches the database text", msgs.includes(M.joinNotice(nq1, "noshow")) && msgs.includes(M.joinNotice(ns1, "solo")) && msgs.includes(M.welcomeNotice(ns1, [np1, np2, nq1])));
  ok("notice: welcome lists the new teammates' names", msgs.includes(`Welcome, ${ns1}! Your teammates are ${np1}, ${np2} and ${nq1}. Say hi and keep going!`));
  ok("notice: 2 join notices + 2 welcomes, nothing else", msgs.length === 4 && (await msgCount()) - before === 4);
  ok("notice: placed students are in the team conversation", (await inChat(X, q1)) && (await inChat(X, s1)));
  ok("notice: released student is out of the old chat (old team gone)", !(await inChat(Y, q2)));
  ok("notice: sender is the organizer", (await chat(X)).every((m) => m.sender_id === adminId));
  await as(p1);
  ok("notice: existing member has it unread in Messages", (await db.query(`select coalesce(sum(unread),0)::int u from public.my_conversations() where kind='team'`)).rows[0].u === 4);
  await as(s1);
  ok("notice: placed student sees it unread too", (await db.query(`select coalesce(sum(unread),0)::int u from public.my_conversations() where kind='team'`)).rows[0].u >= 1);
  await as(adminId);

  // 2) moved between teams while their old team stays: "their team was incomplete"; released leaves old chat
  const w1 = await student(D[0], { in: true }), w2 = await student(D[1], { in: true });
  const z1 = await student(D[2], { in: true }), z2 = await student(D[3], { in: true }), z3 = await student(D[4], { in: true });
  const W = await mkTeam("Notice W", [w1, w2]), Z = await mkTeam("Notice Z", [z1, z2, z3]);
  await run({ releases: [{ student: z1, team: Z }], teams: [{ team_id: W, students: [z1] }] });
  const nz1 = await nameOf(z1);
  ok("notice: moved student -> 'their team was incomplete'", (await chat(W)).some((m) => m.body === `${nz1} joined your team. Their team was incomplete, so they were placed with you. Say hi and keep going!`));
  ok("notice: moved student left the old team chat and joined the new one", !(await inChat(Z, z1)) && (await inChat(W, z1)));
  ok("notice: old team's chat got nothing", (await chat(Z)).length === 0);

  // 3) a brand-new team gets exactly one welcome listing members
  const n1 = await student(D[0], { in: true }), n2 = await student(D[1], { in: true }), n3 = await student(D[2], { in: true });
  await run({ teams: [{ team_id: null, name: "Notice New", students: [n1, n2, n3] }] });
  const NT = (await db.query(`select id from public.teams where name='Notice New'`)).rows[0].id;
  const [a1, a2, a3] = await Promise.all([n1, n2, n3].map(nameOf));
  const nm = (await chat(NT)).map((m) => m.body);
  ok("notice: new team gets one welcome with all members", nm.length === 1 && nm[0] === M.newTeamNotice((await db.query(`select p.full_name n from public.team_members tm join public.profiles p on p.id=tm.user_id where tm.team_id=$1 order by tm.joined_at, tm.user_id`, [NT])).rows.map((r) => r.n)) || ([a1, a2, a3].every((x) => nm[0].includes(x)) && nm[0].startsWith("Welcome to the team! An organizer put you together: ") && nm[0].endsWith(" Say hi and keep going!")));

  // 4) notify=false posts nothing but still places and joins the chat
  const o1 = await student(D[0], { in: true }), o2 = await student(D[1], { in: true });
  const O = await mkTeam("Notice Off", [o1]);
  const o3 = await student(D[2], { in: true });
  const c0 = await msgCount();
  await run({ notify: false, teams: [{ team_id: O, students: [o2] }, { team_id: null, name: "Notice Off New", students: [o3] }] });
  ok("notify=false: no messages posted", (await msgCount()) === c0);
  ok("notify=false: student is still placed and in the team chat", (await inChat(O, o2)));

  // 5) a rule failure rolls back notices too (valid placement first, then a bad team)
  const r1 = await student(D[0], { in: true }), r2 = await student(D[1], { in: true });
  const R = await mkTeam("Notice Roll", [r1]);
  const b1 = await student("msu.edu"), b2 = await student("msu.edu"), b3 = await student("msu.edu");
  const c1 = await msgCount();
  await expectError("rollback: bad second team fails the plan", `select public.admin_apply_matching('${plan({ teams: [{ team_id: R, students: [r2] }, { team_id: null, name: "Notice Bad", students: [b1, b2, b3] }] })}')`, "at most 2");
  ok("rollback: no messages posted", (await msgCount()) === c1 && (await chat(R)).length === 0);
  ok("rollback: student not on the team or in its chat", !(await inChat(R, r2)));

  // 6) names are cleaned and capped
  const long = await student(D[3], { in: true });
  await db.query(`update public.profiles set full_name = $2 where id = $1`, [long, "  Evil\nName  " + "x".repeat(80)]);
  const L = await mkTeam("Notice Long", [await student(D[0], { in: true })]);
  await run({ teams: [{ team_id: L, students: [long] }] });
  const lm = (await chat(L))[0].body;
  ok("names: control characters removed, length capped at 40", !lm.includes("\n") && lm.startsWith("Evil Name") && lm.split(" joined your team")[0].length === 40);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
