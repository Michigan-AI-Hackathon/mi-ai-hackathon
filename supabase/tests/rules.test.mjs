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
await db.exec(read("0005_team_rules_avatars.sql"));
await db.exec(read("0008_admin.sql"));
await db.exec(read("0009_checkin_and_system_messages.sql"));
await db.exec(read("0010_signup_sources.sql"));
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

// 3 people can't lock, even from 3 schools
await expectError("team of 3 can't lock", `select public.lock_team()`, "4 people");

// open invites are capped by open spots: 3 members -> 1 spot -> 1 invite
const hope = await signup("h@hope.edu"); await ready(hope);
await db.query(`select public.send_invite('${ou1}')`);
await expectError("2nd invite blocked when only 1 spot is open", `select public.send_invite('${hope}')`, "1 open spot");
await db.query(`update invites set status='cancelled' where team_id=$1 and status='pending'`, [team]);

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

// UM campuses are separate schools: Ann Arbor + Dearborn + GVSU + Hope = 4 people, 4 schools
await as(um);
const t2 = (await db.query(`select public.create_team('Blue') as id`)).rows[0].id;
for (const who of [umd, gv, hope]) {
  await as(um);
  const iv = (await db.query(`select public.send_invite($1) as id`, [who])).rows[0].id;
  await as(who); await db.query(`select public.respond_invite($1, true)`, [iv]);
}
await as(um); await db.query(`select public.lock_team()`);
ok("Ann Arbor + Dearborn count as different schools", (await db.query(`select locked_at is not null l from teams where id=$1`, [t2])).rows[0].l);

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

// --- Organizer tools -------------------------------------------------
const boss = await signup("boss@umich.edu"); await ready(boss, "University of Michigan – Ann Arbor");
await db.query(`update profiles set is_admin = true where id = $1`, [boss]);
const [f1, f2, f3, f4] = [await signup("u1@ferris.edu"), await signup("u2@svsu.edu"), await signup("u3@nmu.edu"), await signup("u4@lssu.edu")];
for (const id of [f1, f2, f3, f4]) await ready(id);

await as(f1);
for (const [name, sql] of [
  ["stats", `select public.admin_stats()`], ["add to team", `select public.admin_add_to_team('${f2}', '${t4}', false)`],
  ["comp payment", `select public.admin_comp_student('${f2}', 'x')`], ["lock", `select public.admin_set_team_lock('${t4}', true)`],
  ["dissolve", `select public.admin_dissolve_team('${t4}')`], ["check in", `select public.admin_set_checked_in('${f2}', true)`],
  ["apply plan", `select public.admin_apply_plan('[]'::jsonb)`], ["write audit log", `select public.admin_log_event('x', '{}')`],
]) await expectError(`student can't use organizer action: ${name}`, sql, "Organizers only");
await as(null);
await expectError("signed-out user can't use organizer actions", `select public.admin_stats()`, "Organizers only");

await as(boss);
const stats = (await db.query(`select public.admin_stats() as s`)).rows[0].s;
ok("organizer sees stats", stats.signed_up >= 10 && typeof stats.revenue_cents === "number" && Array.isArray(stats.by_school));

// move a solo student onto a team
await db.query(`select public.admin_add_to_team($1, $2, false)`, [f1, t4]);
ok("organizer adds a student to a team", (await db.query(`select count(*)::int c from team_members where team_id=$1 and user_id=$2`, [t4, f1])).rows[0].c === 1);
// school rules still apply unless forced
const dupe = await signup("dupe@ferris.edu"); await ready(dupe);
const dupe2 = await signup("dupe2@ferris.edu"); await ready(dupe2);
await db.query(`select public.admin_add_to_team($1, $2, false)`, [dupe, t4]);
await expectError("organizer can't break the 2-per-school rule without forcing", `select public.admin_add_to_team('${dupe2}', '${t4}', false)`, "at most 2");
await db.query(`select public.admin_add_to_team($1, $2, true)`, [dupe2, t4]);
ok("organizer can force past the school rule", (await db.query(`select count(*)::int c from team_members where team_id=$1`, [t4])).rows[0].c === 4);
await expectError("the 4-person cap never bends, even when forced", `select public.admin_add_to_team('${f2}', '${t4}', true)`, "full");

// moving someone removes them from the old team; empty teams disappear
await db.query(`select public.admin_remove_from_team($1)`, [dupe2]);
ok("organizer removes a student", (await db.query(`select count(*)::int c from team_members where user_id=$1`, [dupe2])).rows[0].c === 0);
await db.query(`select public.admin_add_to_team($1, $2, true)`, [f2, t4]);
await db.query(`select public.admin_set_team_lock($1, true)`, [t4]);
ok("organizer locks a team", (await db.query(`select locked_at is not null l from teams where id=$1`, [t4])).rows[0].l);
await db.query(`select public.admin_set_team_lock($1, false)`, [t4]);
ok("organizer unlocks a team", !(await db.query(`select locked_at is not null l from teams where id=$1`, [t4])).rows[0].l);

// comp payment + check-in
const poor = await signup("poor@mtu.edu");
await db.query(`update profiles set onboarded_at = now(), full_name = 'P' where id = $1`, [poor]);
await db.query(`select public.admin_comp_student($1, 'scholarship')`, [poor]);
ok("comp marks a student paid", (await db.query(`select paid_at is not null p from profiles where id=$1`, [poor])).rows[0].p);
await db.query(`select public.admin_set_checked_in($1, true)`, [poor]);
ok("check-in recorded", (await db.query(`select checked_in_at is not null c from profiles where id=$1`, [poor])).rows[0].c);

// auto-fill plan applies atomically
const p1 = await signup("p1@baker.edu"), p2 = await signup("p2@kzoo.edu"), p3 = await signup("p3@alma.edu"), p4 = await signup("p4@uolivet.edu");
for (const id of [p1, p2, p3, p4]) await ready(id);
await db.query(`select public.admin_apply_plan($1::jsonb)`, [JSON.stringify([{ team_id: null, name: "Auto 1", track: "FinTech", students: [p1, p2, p3, p4] }])]);
ok("plan creates a team of 4", (await db.query(`select count(*)::int c from team_members tm join teams t on t.id=tm.team_id where t.name='Auto 1'`)).rows[0].c === 4);
const q1 = await signup("q1@adrian.edu"), q2 = await signup("q2@hope.edu"), q3 = await signup("q3@hillsdale.edu");
for (const id of [q1, q2, q3]) await ready(id);
const before = (await db.query(`select count(*)::int c from team_members`)).rows[0].c;
await expectError("a plan with a student already on a team is rejected", `select public.admin_apply_plan('${JSON.stringify([{ team_id: null, name: "Bad", students: [q1, q2, p1] }])}'::jsonb)`, "already joined");
ok("a rejected plan changes nothing (all-or-nothing)",
  (await db.query(`select count(*)::int c from team_members`)).rows[0].c === before &&
  (await db.query(`select count(*)::int c from teams where name='Bad'`)).rows[0].c === 0);

// audit log: written by actions, readable only by organizers
ok("actions are logged", (await db.query(`select count(*)::int c from audit_log`)).rows[0].c >= 8);
await as(ghost);
await db.query(`set role authenticated`);
const seen = (await db.query(`select count(*)::int c from audit_log`)).rows[0].c;
await expectError("students can't write the audit log directly", `insert into audit_log (action) values ('forged')`, "row-level security");
await db.query(`reset role`);
ok("students can't read the audit log", seen === 0);

// students can't give themselves a check-in or a hostile avatar
await as(ghost);
await db.query(`set role authenticated`);
await db.query(`update profiles set checked_in_at = now() where id = $1`, [ghost]);
await db.query(`reset role`);
ok("students can't check themselves in", (await db.query(`select checked_in_at is null c from profiles where id=$1`, [ghost])).rows[0].c);
await expectError("avatar must be a preset or in our bucket", `update profiles set avatar_url = 'https://evil.example/pixel.gif' where id = '${ghost}'`, "avatar_url_format");
await db.query(`update profiles set avatar_url = 'preset-engineer' where id = $1`, [ghost]);

// --- QR check-in -----------------------------------------------------
const att = await signup("att@wmich.edu"); await ready(att);
const attUnpaid = await signup("att2@gvsu.edu");
await db.query(`update profiles set onboarded_at = now(), full_name = 'U' where id = $1`, [attUnpaid]);
await as(boss);
const cfg = (await db.query(`select public.admin_checkin_config() as c`)).rows[0].c;
ok("organizer can read the check-in code", typeof cfg.token === "string" && cfg.token.length >= 32 && cfg.open === false);
await as(att);
await expectError("student can't read the check-in code", `select public.admin_checkin_config()`, "Organizers only");
await expectError("check-in refused while closed", `select public.self_check_in('${cfg.token}')`, "not open");
await as(boss); await db.query(`select public.admin_set_checkin(true, false)`);
await as(att);
await expectError("wrong QR code is refused", `select public.self_check_in('not-the-code')`, "not valid");
await as(attUnpaid);
await expectError("unpaid student can't self check in", `select public.self_check_in('${cfg.token}')`, "not paid");
await as(att); await db.query(`select public.self_check_in($1)`, [cfg.token]);
ok("student checks in with the right QR code", (await db.query(`select checked_in_at is not null c from profiles where id=$1`, [att])).rows[0].c);
await as(boss); await db.query(`select public.admin_set_checkin(true, true)`);
const cfg2 = (await db.query(`select public.admin_checkin_config() as c`)).rows[0].c;
ok("rotating the code changes the token", cfg2.token !== cfg.token);
await as(attUnpaid); await db.query(`update profiles set paid_at = now() where id = $1`, [attUnpaid]);
await as(attUnpaid);
await expectError("old QR code stops working after rotation", `select public.self_check_in('${cfg.token}')`, "not valid");
await as(att);
await db.query(`set role authenticated`);
const seeTok = await db.query(`select * from checkin_config`).then((r) => r.rows.length, () => 0);
await db.query(`reset role`);
ok("students can't read the check-in table directly", seeTok === 0);

// --- Announcements land in Messages as unread, then clear when read ---
await as(boss);
await db.query(`select public.admin_post_announcement($1::uuid[], 'Doors open at 8', 'Bring your laptop and charger.')`, [[att, ghost]]);
await as(att);
let inbox = (await db.query(`select * from public.my_conversations() where kind = 'system'`)).rows;
ok("announcement shows up as 1 unread 'Organizers' message", inbox.length === 1 && inbox[0].unread === 1 && inbox[0].title === "Organizers");
await db.query(`select public.mark_read($1)`, [inbox[0].conversation_id]);
inbox = (await db.query(`select * from public.my_conversations() where kind = 'system'`)).rows;
ok("reading the announcement clears the unread count", inbox[0].unread === 0);
await db.query(`select pg_sleep(0.05)`); // the in-memory test database only has millisecond timestamps
await as(boss);
await db.query(`select public.admin_post_announcement($1::uuid[], 'Lunch at noon', 'Pizza in the main hall.')`, [[att]]);
await as(att);
inbox = (await db.query(`select * from public.my_conversations() where kind = 'system'`)).rows;
ok("a second announcement reuses the conversation and is unread again", inbox.length === 1 && inbox[0].unread === 1);
await db.query(`set role authenticated`);
await expectError("students can't reply into the Organizers conversation",
  `insert into messages (conversation_id, sender_id, body) values ('${inbox[0].conversation_id}', '${att}', 'hi')`, "row-level security");
await db.query(`reset role`);
await as(att);
await expectError("students can't post announcements", `select public.admin_post_announcement('{}'::uuid[], 'Hello there', 'Free money for everyone')`, "Organizers only");
const digestSys = (await db.query(`select * from public.unread_message_digest(0)`)).rows.filter((d) => d.user_id === att);
ok("announcements don't trigger 'unread message' emails", digestSys.length === 0);

// --- Event QR codes (sign-up sources) ---------------------------------
await as(att);
await expectError("student can't create an event code", `select public.admin_create_source('Fake Event', null)`, "Organizers only");
await as(boss);
const src = (await db.query(`select public.admin_create_source('Ross Welcome Week Table', '2026-11-20') as r`)).rows[0].r;
ok("organizer creates an event code with a random tail", /^ross-welcome-week-table-[a-f0-9]{5}$/.test(src.slug));
await as(null);
ok("anyone can look up an active event's name", (await db.query(`select public.source_info($1) as i`, [src.slug])).rows[0].i?.name === "Ross Welcome Week Table");
ok("unknown codes return nothing", (await db.query(`select public.source_info('nope-nope') as i`)).rows[0].i === null);
const fresh = await signup("new1@wmich.edu");
await as(fresh);
ok("a brand-new student is credited to the event", (await db.query(`select public.claim_signup_source($1) as c`, [src.slug])).rows[0].c === true);
ok("first touch wins (a second code is ignored)", (await db.query(`select public.claim_signup_source('another-code') as c`)).rows[0].c === false);
await as(att);
await db.query(`update profiles set created_at = now() - interval '10 days' where id = $1`, [att]);
ok("an older account can't be credited later", (await db.query(`select public.claim_signup_source($1) as c`, [src.slug])).rows[0].c === false);
await as(fresh);
await db.query(`set role authenticated`);
await db.query(`update profiles set signup_source = 'sneaky' where id = $1`, [fresh]);
await db.query(`reset role`);
ok("students can't set signup_source directly", (await db.query(`select signup_source from profiles where id=$1`, [fresh])).rows[0].signup_source === src.slug);
await as(boss);
await db.query(`select public.admin_set_source_active($1, false)`, [src.id]);
await as(null);
ok("a switched-off code stops resolving", (await db.query(`select public.source_info($1) as i`, [src.slug])).rows[0].i === null);
await as(boss);
const st = (await db.query(`select public.admin_source_stats() as s`)).rows[0].s;
ok("event stats count sign-ups", st.sources.find((x) => x.slug === src.slug).signups === 1 && st.direct >= 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
