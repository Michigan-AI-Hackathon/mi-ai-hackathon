// Runs the real migrations in an in-memory Postgres (PGlite) with a tiny
// stand-in for Supabase's auth schema, then checks every team rule.
// Run: node supabase/tests/rules.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync } from "node:fs";

const db = new PGlite({ extensions: { citext } });
const read = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8");

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create publication supabase_realtime;
`);
await db.exec(read("0001_init.sql"));
await db.exec(read("0002_schools.sql"));
// Supabase grants table access to these roles by default; RLS does the filtering.
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;`);

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const as = async (uid) => db.exec(`select set_config('test.uid', '${uid ?? ""}', false)`);
async function expectError(name, sql, match) {
  try { await db.query(sql); ok(name + " (should have failed)", false); }
  catch (e) { ok(name, !match || e.message.includes(match)); if (match && !e.message.includes(match)) console.log("   got:", e.message); }
}
async function signup(email) {
  const r = await db.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  return r.rows[0].id;
}
async function ready(id, schoolName) {
  await db.query(`update public.profiles set full_name='x', onboarded_at=now(), paid_at=now(),
    school_id=coalesce((select id from public.schools where name=$2), school_id) where id=$1`, [id, schoolName ?? null]);
}

// --- Sign-up gating -------------------------------------------------
await expectError("rejects gmail", `insert into auth.users (email) values ('a@gmail.com')`, "Only Michigan");
await expectError("rejects look-alike fakeumich.edu", `insert into auth.users (email) values ('a@fakeumich.edu')`, "Only Michigan");
const gv = await signup("stu@mail.gvsu.edu");
ok("accepts subdomain mail.gvsu.edu -> GVSU",
  (await db.query(`select s.name from public.profiles p join public.schools s on s.id=p.school_id where p.id=$1`, [gv])).rows[0]?.name === "Grand Valley State University");
const um = await signup("a@umich.edu");
ok("umich.edu leaves school blank (student picks campus)",
  (await db.query(`select school_id from public.profiles where id=$1`, [um])).rows[0].school_id === null);
ok("calvin.edu and calvinseminary.edu don't mix",
  (await db.query(`select count(*)::int c from public.schools_for_email('x@calvin.edu')`)).rows[0].c === 1);

// --- Team rules ------------------------------------------------------
const msu1 = await signup("m1@msu.edu"), msu2 = await signup("m2@msu.edu"), msu3 = await signup("m3@msu.edu");
const wsu1 = await signup("w1@wayne.edu"), wsu2 = await signup("w2@wayne.edu");
const ou1  = await signup("o1@oakland.edu");
const umd  = await signup("d@umich.edu");
for (const id of [msu1, msu2, msu3, wsu1, wsu2, ou1, gv]) await ready(id);
await ready(um, "University of Michigan – Ann Arbor");
await ready(umd, "University of Michigan – Dearborn");

// unpaid student can't create a team
const unpaid = await signup("u@emich.edu");
await db.query(`update public.profiles set onboarded_at=now(), school_id=(select id from schools where name='Eastern Michigan University') where id=$1`, [unpaid]);
await as(unpaid);
await expectError("unpaid student can't create a team", `select public.create_team('Team U')`, "registration fee");

await as(msu1);
const team = (await db.query(`select public.create_team('Spartans+') as id`)).rows[0].id;
ok("create team", !!team);
await expectError("can't be on two teams", `select public.create_team('Again')`, "already on a team");

// invite 2nd MSU -> allowed (2 from same school)
const inv2 = (await db.query(`select public.send_invite($1) as id`, [msu2])).rows[0].id;
await as(msu2); await db.query(`select public.respond_invite($1, true)`, [inv2]);
ok("2nd MSU student joined", (await db.query(`select count(*)::int c from team_members where team_id=$1`, [team])).rows[0].c === 2);

// 3rd MSU -> blocked
await as(msu1);
await expectError("3rd from same school blocked", `select public.send_invite('${msu3}')`, "at most 2");

// add Wayne -> ok; then 2nd Wayne -> blocked (only one school may have 2)
const inv3 = (await db.query(`select public.send_invite($1) as id`, [wsu1])).rows[0].id;
await as(wsu1); await db.query(`select public.respond_invite($1, true)`, [inv3]);
await as(msu1);
await expectError("second doubled school blocked (4 must span 3 schools)", `select public.send_invite('${wsu2}')`, "different school");

// 3 people with 2 MSU can't lock
await expectError("team of 3 with a repeat school can't lock", `select public.lock_team()`, "different schools");

// request to join from Oakland -> accepted by a member
await as(ou1);
const req = (await db.query(`select public.request_to_join($1) as id`, [team])).rows[0].id;
await as(ou1);
await expectError("requester can't accept own request", `select public.respond_invite('${req}', true)`, "Only members");
await as(wsu1); await db.query(`select public.respond_invite($1, true)`, [req]);
ok("team of 4 (MSU,MSU,Wayne,Oakland)", (await db.query(`select count(*)::int c from team_members where team_id=$1`, [team])).rows[0].c === 4);

await as(msu1);
await expectError("5th member blocked", `select public.send_invite('${gv}')`, "full");
await db.query(`select public.lock_team()`);
ok("valid team of 4 locks", (await db.query(`select locked_at is not null l from teams where id=$1`, [team])).rows[0].l);
await expectError("can't leave a locked team", `select public.leave_team()`, "locked");

// UM campuses count as one school (rule_group 'umich')
await as(um);
const t2 = (await db.query(`select public.create_team('Blue') as id`)).rows[0].id;
const i4 = (await db.query(`select public.send_invite($1) as id`, [umd])).rows[0].id;
await as(umd); await db.query(`select public.respond_invite($1, true)`, [i4]);
await as(um);
const i5 = (await db.query(`select public.send_invite($1) as id`, [gv])).rows[0].id;
await as(gv); await db.query(`select public.respond_invite($1, true)`, [i5]);
await as(um);
await expectError("Ann Arbor + Dearborn + GVSU = only 2 schools, can't lock as 3", `select public.lock_team()`, "different schools");

// a team of 3 from 3 different schools locks
await as(wsu2);
const t3 = (await db.query(`select public.create_team('Three') as id`)).rows[0].id;
const ia = (await db.query(`select public.send_invite($1) as id`, [msu3])).rows[0].id;
await as(msu3); await db.query(`select public.respond_invite($1, true)`, [ia]);
const extra = await signup("x@hope.edu"); await ready(extra);
await as(wsu2);
const ib = (await db.query(`select public.send_invite($1) as id`, [extra])).rows[0].id;
await as(extra); await db.query(`select public.respond_invite($1, true)`, [ib]);
await as(wsu2); await db.query(`select public.lock_team()`);
ok("team of 3 from 3 schools locks", (await db.query(`select locked_at is not null l from teams where id=$1`, [t3])).rows[0].l);

// expiry
const solo = await signup("s@kzoo.edu"); await ready(solo);
const ghost = await signup("g@albion.edu"); await ready(ghost);
await as(solo);
const t4 = (await db.query(`select public.create_team('Solo') as id`)).rows[0].id;
const ie = (await db.query(`select public.send_invite($1) as id`, [ghost])).rows[0].id;
await db.query(`update invites set expires_at = now() - interval '1 minute' where id=$1`, [ie]);
await as(ghost);
await expectError("expired invite can't be accepted", `select public.respond_invite('${ie}', true)`, "expired");

// privacy: profile columns students can't change
await as(ghost);
await db.query(`set role authenticated`);
await db.query(`update public.profiles set is_admin = true, paid_at = null, bio = 'changed' where id = $1`, [ghost]);
await db.query(`reset role`);
const g = (await db.query(`select is_admin, paid_at, bio from profiles where id=$1`, [ghost])).rows[0];
ok("students can edit their bio", g.bio === 'changed');
ok("students can't make themselves admin or unpay", g.is_admin === false && g.paid_at !== null);
await db.query(`set role authenticated`);
await db.query(`update public.profiles set bio = 'hacked' where id = $1`, [msu1]);
await db.query(`reset role`);
ok("students can't edit someone else's profile", (await db.query(`select bio from profiles where id=$1`, [msu1])).rows[0].bio !== 'hacked');
ok("directory hides year and email",
  !(await db.query(`select * from student_directory limit 1`)).fields.some(f => ["year","email"].includes(f.name)));

// messaging + unread digest
await as(msu1);
const conv = (await db.query(`select c.id from conversations c where team_id=$1`, [team])).rows[0].id;
await db.query(`update conversation_members set last_read_at = now() - interval '1 hour' where conversation_id = $1`, [conv]);
await db.query(`insert into messages (conversation_id, sender_id, body, created_at) values ($1,$2,'hi team', now() - interval '20 minutes')`, [conv, msu1]);
const digest = (await db.query(`select * from public.unread_message_digest(15)`)).rows;
ok("3 teammates get an unread email, sender doesn't", digest.length === 3 && !digest.some(d => d.user_id === msu1));
await as(msu2); await db.query(`select public.mark_read($1)`, [conv]);
ok("reading clears it", !(await db.query(`select * from public.unread_message_digest(15)`)).rows.some(d => d.user_id === msu2));
await db.query(`select public.mark_digest_sent($1)`, [[wsu1, ou1]]);
ok("no repeat email for the same messages", (await db.query(`select * from public.unread_message_digest(15)`)).rows.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
