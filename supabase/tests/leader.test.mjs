// Tests for migration 0020 (team leader, last active, leaving the hackathon) in an in-memory Postgres (PGlite).
// Run: node supabase/tests/leader.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

// ---- database
const db = new PGlite({ extensions: { citext } });
const read = (f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), "utf8");
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create publication supabase_realtime;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`);
for (const f of ["0001_init", "0002_schools", "0005_team_rules_avatars", "0008_admin", "0009_checkin_and_system_messages", "0010_signup_sources", "0011_campus_schools", "0014_matching", "0015_profile_fields", "0016_judging", "0017_points", "0018_help_replies", "0019_sponsorship", "0020_leader_activity_delete"]) {
  try { await db.exec(read(f)); } catch (e) { console.log(`FAIL  migration ${f}: ${e.message}`); process.exit(1); }
}
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;`);

const q = async (sql, p) => (await db.query(sql, p)).rows;
const as = (uid) => db.exec(`select set_config('test.uid', '${uid ?? ""}', false)`);
const authed = async (uid) => { await as(uid); await db.exec(`set role authenticated`); };
const owner = async () => { await db.exec(`reset role`); await as(null); };
async function fails(name, sql, match) {
  try { await db.query(sql); ok(name + " (should have failed)", false); }
  catch (e) { const hit = !match || e.message.includes(match); ok(name, hit); if (!hit) console.log("   got:", e.message); }
}
const school = async (name) => (await q(`select id from public.schools where name=$1`, [name]))[0].id;
async function student(email, schoolName) {
  const id = (await q(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id;
  await q(`update public.profiles set full_name='x', onboarded_at=now(), school_id=$2 where id=$1`, [id, schoolName ? await school(schoolName) : null]);
  return id;
}
const quote = async (uid) => { await authed(uid); const v = (await q(`select public.my_sponsorship() as v`))[0].v; await owner(); return v; };
const MSU = "Michigan State University", WSU = "Wayne State University";


const org = await student("org@msu.edu", MSU); await q(`update public.profiles set is_admin=true where id=$1`, [org]);
const a = await student("a@msu.edu", MSU), b = await student("b@wayne.edu", WSU), c = await student("c@msu.edu", MSU);
const paid = `update public.profiles set paid_at=now() where id in ('${a}','${b}','${c}')`; await db.exec(paid);

// creator becomes leader
await authed(a); const team = (await q(`select public.create_team('Alpha') as id`))[0].id; await owner();
const leader = async () => (await q(`select leader_id from public.teams where id=$1`, [team]))[0]?.leader_id;
ok("creator is the leader", await leader() === a);
await q(`insert into public.team_members (team_id, user_id) values ($1,$2)`, [team, b]);
await q(`insert into public.team_members (team_id, user_id) values ($1,$2)`, [team, c]);
ok("joining doesn't change the leader", await leader() === a);

// only leader locks; only leader hands over
await authed(b);
await fails("non-leader can't lock", `select public.lock_team()`, "Only your team leader");
await fails("non-leader can't hand over lead", `select public.set_team_leader('${b}')`, "Only your team leader");
await owner();
await authed(a);
await fails("can't hand lead to someone off the team", `select public.set_team_leader('${org}')`, "not on your team");
await db.exec(`select public.set_team_leader('${b}')`); await owner();
ok("leader handed to b", await leader() === b);
await authed(a); await fails("old leader can no longer lock", `select public.lock_team()`, "Only your team leader"); await owner();

// leader leaves -> longest-standing member takes over
await authed(b); await db.exec(`select public.leave_team()`); await owner();
ok("leader leaving passes lead to a remaining member", [a, c].includes(await leader()));

// last-active: students can't forge it, touch is throttled
await authed(a);
await db.exec(`update public.profiles set last_active_at = '2000-01-01' where id='${a}'`);
await db.exec(`select public.touch_active()`); await owner();
const t1 = (await q(`select last_active_at from public.profiles where id=$1`, [a]))[0].last_active_at;
ok("student can't write last_active_at, touch sets it", t1 && new Date(t1).getFullYear() > 2020);
await authed(a); await db.exec(`select public.touch_active()`); await owner();
const t2 = (await q(`select last_active_at from public.profiles where id=$1`, [a]))[0].last_active_at;
ok("touch within 10 minutes doesn't rewrite", String(t1) === String(t2));

// leaving the hackathon: locked team unlocks, leader passes on, payment row survives
await q(`insert into public.team_members (team_id, user_id) values ($1,$2)`, [team, b]);
await q(`insert into public.payments (user_id, stripe_session_id, amount_cents) values ($1,'s1',2000)`, [a]);
await q(`update public.teams set locked_at = now() where id=$1`, [team]);
await authed(a); await db.exec(`select public.leave_hackathon()`); await owner();
ok("left the team", (await q(`select count(*)::int n from public.team_members where user_id=$1`, [a]))[0].n === 0);
ok("lead moved off the deleted member", await leader() !== a && await leader() !== null);
ok("locked team reopens after losing a member", (await q(`select locked_at from public.teams where id=$1`, [team]))[0].locked_at === null);
await q(`delete from auth.users where id=$1`, [a]);
ok("profile gone after account delete", (await q(`select count(*)::int n from public.profiles where id=$1`, [a]))[0].n === 0);
const pay = (await q(`select user_id from public.payments where stripe_session_id='s1'`))[0];
ok("payment record is kept, detached from the person", pay && pay.user_id === null);
await authed(org); await fails("organizers can't use leave_hackathon", `select public.leave_hackathon()`, "Organizer accounts"); await owner();
// last member leaves -> team disappears
await authed(c); await db.exec(`select public.leave_hackathon()`); await owner();
await authed(b); await db.exec(`select public.leave_hackathon()`); await owner();
ok("empty team is removed", (await q(`select count(*)::int n from public.teams where id=$1`, [team]))[0].n === 0);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
