// Runs migrations 0014-0018 (matching, profile fields, judging, points, help) in an in-memory Postgres (PGlite)
// and checks the access rules: judges see only their teams and scores, students can't touch any of it,
// points can't be double-claimed or double-spent, help replies reach the student.
// Run: node supabase/tests/judging.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync } from "node:fs";

const db = new PGlite({ extensions: { citext } });
const read = (f) => readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), "utf8");

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create publication supabase_realtime;
  -- minimal stand-in for Supabase Storage, only so migration 0015/0018 can run
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`);
for (const f of ["0001_init", "0002_schools", "0005_team_rules_avatars", "0008_admin", "0009_checkin_and_system_messages", "0010_signup_sources", "0011_campus_schools", "0014_matching", "0015_profile_fields", "0016_judging", "0017_points", "0018_help_replies"]) {
  try { await db.exec(read(f)); } catch (e) { console.log(`FAIL  migration ${f} did not run: ${e.message}`); process.exit(1); }
}
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;`);
// Tables the migrations closed to students must stay closed after the blanket grant above.
await db.exec(`revoke all on public.judges, public.judge_tracks, public.judge_teams, public.scoring_criteria, public.judge_scores, public.judge_reviews, public.point_activities from authenticated`);

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
const as = async (uid) => db.exec(`select set_config('test.uid', '${uid ?? ""}', false)`);
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function fails(name, sql, match, params) {
  try { await db.query(sql, params); ok(name + " (should have failed)", false); }
  catch (e) { const hit = !match || e.message.includes(match); ok(name, hit); if (!hit) console.log("   got:", e.message); }
}
// Role switch so RLS and grants apply like they do for a signed-in browser session.
const asAuthed = async (uid) => { signedIn = true; await as(uid); await db.exec(`set role authenticated`); };
// Read a closed table as its owner, then go back to the signed-in role.
let signedIn = false;
const qo = async (sql, params) => { await db.exec(`reset role`); try { return await q(sql, params); } finally { if (signedIn) await db.exec(`set role authenticated`); } };
const asOwner = async () => { signedIn = false; await db.exec(`reset role`); await as(null); };

async function signup(email) { return (await q(`insert into auth.users (email) values ($1) returning id`, [email]))[0].id; }
async function student(email) {
  const id = await signup(email);
  await q(`update public.profiles set full_name=$2, onboarded_at=now(), paid_at=now(), school_id=coalesce(school_id,(select id from public.schools where name='Michigan State University')) where id=$1`, [id, email.split("@")[0]]);
  return id;
}

// ---------------- people ----------------
const org = await student("org@msu.edu"); await q(`update public.profiles set is_admin=true where id=$1`, [org]);
const s1 = await student("s1@msu.edu"), s2 = await student("s2@wayne.edu"), s3 = await student("s3@oakland.edu"), s4 = await student("s4@gvsu.edu");
await q(`update public.profiles set school_id=(select id from public.schools where name='Wayne State University') where id=$1`, [s2]);
await q(`update public.profiles set school_id=(select id from public.schools where name='Oakland University') where id=$1`, [s3]);
await q(`update public.profiles set school_id=(select id from public.schools where name='Grand Valley State University') where id=$1`, [s4]);

// two teams on different tracks
await as(s1); const tA = (await q(`select public.create_team('Alpha', 'Health') as id`))[0].id;
await as(s2); const tB = (await q(`select public.create_team('Beta', 'Education') as id`))[0].id;
await as(s3); const tC = (await q(`select public.create_team('Gamma', 'Health') as id`))[0].id;

// ---------------- sign-in for judges ----------------
await as(org);
await asAuthed(org);
const jid = (await q(`select public.admin_add_judge('  Judge@Acme.com ', 'Dana', 'Acme') as id`))[0].id;
await fails("adding the same judge twice is refused", `select public.admin_add_judge('judge@acme.com')`, "already added");
await fails("bad email refused", `select public.admin_add_judge('nope')`, "full email");
await asOwner();
ok("judge email normalised to lower case", (await qo(`select email from public.judges where id=$1`, [jid]))[0]?.email === "judge@acme.com");
ok("judge_invited says yes to an invited address", (await q(`select public.judge_invited('JUDGE@acme.com') as v`))[0].v === true);
ok("judge_invited says no to a stranger", (await q(`select public.judge_invited('x@acme.com') as v`))[0].v === false);
const judgeUser = await signup("judge@acme.com"); // non-Michigan email allowed only because they're on the list
ok("invited judge can create an account with a non-Michigan email", !!judgeUser);
await fails("a non-invited non-Michigan email still can't sign up", `insert into auth.users (email) values ('rando@acme.com')`, "Only Michigan");

// ---------------- students can't reach judging ----------------
await asAuthed(s1);
await fails("student can't read the judges table", `select * from public.judges`, "permission denied");
await fails("student can't read scores", `select * from public.judge_scores`, "permission denied");
await fails("student can't add a judge", `select public.admin_add_judge('x@y.com')`, "Organizers only");
await fails("student can't see judge data", `select public.admin_judging_data()`, "Organizers only");
await fails("student can't call judge_overview", `select public.judge_overview()`, "Judges only");
await fails("student can't submit a score", `select public.judge_save_review('${tA}', '{}'::jsonb, 'hi')`, "Judges only");
ok("student: is_judge() is false", (await q(`select public.is_judge() as v`))[0].v === false);
await fails("student can't set team numbers", `select public.admin_set_team_number('${tA}', 5)`, "Organizers only");
await asOwner();

// ---------------- organizer setup ----------------
await asAuthed(org);
await db.exec(`select public.admin_save_criteria('[{"name":"Impact","description":"Does it matter?","max_score":10},{"name":"Demo","max_score":5}]'::jsonb)`);
const crit = await qo(`select id, name, max_score from public.scoring_criteria order by position`);
ok("rubric saved in order", crit.length === 2 && crit[0].name === "Impact" && crit[1].max_score === 5);
const [cImpact, cDemo] = [crit[0].id, crit[1].id];
await fails("rubric needs a name", `select public.admin_save_criteria('[{"name":"","max_score":5}]'::jsonb)`, "needs a name");
await fails("rubric top score out of range", `select public.admin_save_criteria('[{"name":"X","max_score":500}]'::jsonb)`, "top score");
ok("failed save left the rubric alone", (await qo(`select count(*)::int c from public.scoring_criteria`))[0].c === 2);

const n = (await q(`select public.admin_auto_number_teams(false) as n`))[0].n;
ok("auto-number numbers all 3 teams", n === 3);
const nums = (await q(`select team_number from public.teams order by team_number`)).map((r) => r.team_number);
ok("numbers are 1..3 with no gaps", nums.join() === "1,2,3");
ok("auto-number is idempotent for already-numbered teams", (await q(`select public.admin_auto_number_teams(false) as n`))[0].n === 0);
await fails("duplicate team number refused", `select public.admin_set_team_number('${tA}', (select team_number from public.teams where id='${tB}'))`, "already used");
await fails("team number out of range", `select public.admin_set_team_number('${tA}', 10000)`, "1 to 9999");

// judge is assigned the Health track only
await db.exec(`select public.admin_set_judge_assignments('${jid}', array['Health'], '{}'::uuid[])`);
await asOwner();

// ---------------- judge view ----------------
await asAuthed(judgeUser);
ok("judge: is_judge() is true", (await q(`select public.is_judge() as v`))[0].v === true);
let ov = (await q(`select public.judge_overview() as v`))[0].v;
ok("judge sees exactly the two Health teams", ov.teams.length === 2 && ov.teams.every((t) => t.track === "Health"));
ok("judge does NOT see the Education team", !ov.teams.some((t) => t.id === tB));
ok("judge sees team members' names and schools", ov.teams.find((t) => t.id === tA).members[0].school === "Michigan State University");
ok("judge overview exposes no emails", !JSON.stringify(ov).includes("@msu.edu"));

await fails("judge can't score a team that isn't theirs", `select public.judge_save_review('${tB}', '{"${cImpact}": 5}'::jsonb, null)`, "not assigned");
await fails("score above max refused", `select public.judge_save_review('${tA}', '{"${cDemo}": 6}'::jsonb, null)`, "from 0 to 5");
await fails("fractional score refused", `select public.judge_save_review('${tA}', '{"${cDemo}": 2.5}'::jsonb, null)`, "whole number");
await fails("negative score refused", `select public.judge_save_review('${tA}', '{"${cDemo}": -1}'::jsonb, null)`, "from 0 to 5");
await fails("unknown criterion refused", `select public.judge_save_review('${tA}', '{"${tA}": 1}'::jsonb, null)`, "Unknown criterion");
await db.exec(`select public.judge_save_review('${tA}', '{"${cImpact}": 8, "${cDemo}": 4}'::jsonb, 'Strong demo')`);
await db.exec(`select public.judge_save_review('${tA}', '{"${cImpact}": 9}'::jsonb, 'Strong demo, great impact')`);
ov = (await q(`select public.judge_overview() as v`))[0].v;
const a = ov.teams.find((t) => t.id === tA);
ok("re-saving updates instead of duplicating", a.scores[cImpact] === 9 && a.scores[cDemo] === 4 && a.comment === "Strong demo, great impact");
ok("failed save did not store a partial score", ov.teams.find((t) => t.id === tC).comment === null && Object.keys(ov.teams.find((t) => t.id === tC).scores).length === 0);

// a second judge on a specific team only
await asOwner(); await asAuthed(org);
const j2 = (await q(`select public.admin_add_judge('second@acme.com') as id`))[0].id;
await db.exec(`select public.admin_set_judge_assignments('${j2}', '{}'::text[], array['${tB}']::uuid[])`);
await asOwner();
const judge2User = await signup("second@acme.com");
await asAuthed(judge2User);
ov = (await q(`select public.judge_overview() as v`))[0].v;
ok("second judge sees only the team assigned by id", ov.teams.length === 1 && ov.teams[0].id === tB);
ok("second judge cannot see the first judge's scores", Object.keys(ov.teams[0].scores).length === 0);
await fails("second judge can't read Alpha", `select public.judge_save_review('${tA}', '{}'::jsonb, 'x')`, "not assigned");
await asOwner();

// ---------------- organizer results ----------------
await asAuthed(org);
const d = (await q(`select public.admin_judging_data() as v`))[0].v;
ok("organizer sees every judge's scores", d.scores.length === 2 && d.scores.every((s) => s.judge === jid));
ok("organizer sees judges as signed in", d.judges.every((j) => j.signed_in === true));
// shrinking a max below an existing score is refused (not silently clamped)
await fails("can't lower a top score below existing scores", `select public.admin_save_criteria('[{"id":"${cImpact}","name":"Impact","max_score":3},{"id":"${cDemo}","name":"Demo","max_score":5}]'::jsonb)`, "already gave");
ok("...and the rubric is unchanged afterwards", (await qo(`select max_score from public.scoring_criteria where id=$1`, [cImpact]))[0].max_score === 10);
// removing a scored criterion hides it, an unscored one is deleted
await db.exec(`select public.admin_save_criteria('[{"id":"${cImpact}","name":"Impact","max_score":10}]'::jsonb)`);
const left = await qo(`select name, active from public.scoring_criteria order by name`);
ok("scored criterion is kept as inactive, scores preserved", left.length === 2 && left.find((c) => c.name === "Demo").active === false && (await qo(`select count(*)::int c from public.judge_scores`))[0].c === 2);
await db.exec(`select public.admin_remove_judge('${j2}')`);
ok("removing a judge removes them", (await qo(`select count(*)::int c from public.judges`))[0].c === 1);
ok("organizer actions are audited", (await qo(`select count(*)::int c from public.audit_log where action in ('add_judge','save_criteria','set_team_number','auto_number_teams','remove_judge')`))[0].c >= 5);
await asOwner();

// ---------------- points ----------------
await asAuthed(org);
await db.exec(`select public.admin_create_activity('Workshop 1', 50)`);
const act = (await q(`select id, token from public.admin_points_activities()`))[0];
await asOwner();
await q(`update public.profiles set checked_in_at = now() where id = $1`, [s1]);

await asAuthed(s1);
await fails("student can't read activity tokens", `select token from public.point_activities`, "permission denied");
await fails("student can't create activities", `select public.admin_create_activity('Cheat', 1000)`, "Organizers only");
await fails("bad QR token refused", `select public.scan_points('nope')`, "not valid");
let r = (await q(`select public.scan_points($1) as v`, [act.token]))[0].v;
ok("first scan awards points", r.awarded === true && r.points === 50 && r.balance === 50);
r = (await q(`select public.scan_points($1) as v`, [act.token]))[0].v;
ok("scanning again awards nothing", r.awarded === false && r.balance === 50);
ok("student can read their own balance", (await q(`select public.my_points() as v`))[0].v === 50);
await fails("student can't insert into the ledger directly", `insert into public.point_ledger (user_id, label, points) values ('${s1}', 'free', 999)`, null);
await asOwner();

await asAuthed(s2);
await fails("student who has not checked in can't scan", `select public.scan_points('${act.token}')`, "Check in");
await asOwner();
await q(`update public.profiles set paid_at = null, checked_in_at = now() where id = $1`, [s2]);
await asAuthed(s2);
await fails("unpaid student can't scan", `select public.scan_points('${act.token}')`, "not paid");
await asOwner();

await asAuthed(org);
await db.exec(`select public.admin_set_activity_active('${act.id}', false)`);
await asOwner();
await asAuthed(s1);
await fails("closed activity refuses scans", `select public.scan_points('${act.token}')`, "closed");
await asOwner();

// prizes
await asAuthed(org);
await db.exec(`select public.admin_save_prize(null, 'Sticker', 30, true)`);
await db.exec(`select public.admin_save_prize(null, 'Hoodie', 500, true)`);
const sticker = (await q(`select id from public.prizes where name='Sticker'`))[0].id;
const hoodie = (await q(`select id from public.prizes where name='Hoodie'`))[0].id;
await fails("can't redeem more than the balance", `select public.admin_redeem_prize('${s1}', '${hoodie}', null)`, "Not enough points");
ok("redeeming returns the new balance", (await q(`select public.admin_redeem_prize('${s1}', '${sticker}', 'handed over') as v`))[0].v === 20);
await fails("second redemption that would overspend is refused", `select public.admin_redeem_prize('${s1}', '${sticker}', null)`, "Not enough points");
const lb = await q(`select full_name, earned, spent, balance from public.admin_points_leaderboard(10)`);
ok("leaderboard shows earned 50, spent 30, balance 20", lb.length === 1 && lb[0].earned === 50 && lb[0].spent === 30 && lb[0].balance === 20);
await asOwner();
await asAuthed(s1);
ok("student's balance reflects the spend", (await q(`select public.my_points() as v`))[0].v === 20);
await fails("student can't redeem for themselves", `select public.admin_redeem_prize('${s1}', '${sticker}', null)`, "Organizers only");
await asOwner();

// ---------------- help requests ----------------
await asAuthed(s1);
const help = (await q(`select public.submit_help_request('Teams', 'Where do I find my team?') as v`))[0].v;
ok("help request stored", !!help);
await fails("help requests are rate limited", `select public.submit_help_request('Teams', 'again right away')`, "wait a bit");
await asOwner();
await asAuthed(s3);
ok("another student sees none of s1's help requests", (await q(`select count(*)::int c from public.help_requests`))[0].c === 0);
await asOwner();
await asAuthed(org);
ok("organizer sees help requests", (await q(`select count(*)::int c from public.help_requests`))[0].c === 1);
await db.exec(`select public.admin_reply_help('${help}', 'Check the Teams page, you can join one now.')`);
await asOwner();
ok("reply is stored on the request", (await q(`select reply, replied_at is not null as done from public.help_requests where id=$1`, [help]))[0].done === true);
await asAuthed(s1);
const msgs = await q(`select count(*)::int c from public.messages where body like '%you can join one now%'`);
ok("student receives the reply in Messages", msgs[0].c >= 1);
await asOwner();

// ---------------- joinable teams ----------------
await q(`update public.teams set locked_at = now() where id = $1`, [tC]);
await asAuthed(s4);
const joinable = (await q(`select * from public.joinable_teams() as t`)).map((r) => r.t);
ok("joinable_teams lists open teams", joinable.includes(tA) && joinable.includes(tB));
ok("joinable_teams hides locked teams", !joinable.includes(tC));
await asOwner();

// ---------------- directory hides organizers and judges ----------------
await asAuthed(s4);
const dirNames = (await q(`select full_name from public.student_directory`)).map((r) => r.full_name);
ok("directory never lists the organizer", !dirNames.includes("org"));
ok("directory never lists judges", !dirNames.some((n) => n && n.includes("judge")));
await asOwner();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
