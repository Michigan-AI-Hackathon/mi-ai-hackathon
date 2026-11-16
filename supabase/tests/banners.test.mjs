// Tests for migration 0021 (homepage banners) in an in-memory Postgres (PGlite).
// Run: node supabase/tests/banners.test.mjs
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
for (const f of ["0001_init", "0002_schools", "0005_team_rules_avatars", "0008_admin", "0009_checkin_and_system_messages", "0010_signup_sources", "0011_campus_schools", "0014_matching", "0015_profile_fields", "0016_judging", "0017_points", "0018_help_replies", "0019_sponsorship", "0020_leader_activity_delete", "0021_banners"]) {
  try { await db.exec(read(f)); } catch (e) { console.log(`FAIL  migration ${f}: ${e.message}`); process.exit(1); }
}
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;
  revoke all on public.banners from authenticated;`);

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
const paidNoTeam = await student("p@msu.edu", MSU), unpaid = await student("u@wayne.edu", WSU);
await q(`update public.profiles set paid_at=now() where id=$1`, [paidNoTeam]);
const mine = async (uid) => { await authed(uid); const r = (await q(`select message from public.my_banners()`)).map((x) => x.message); await owner(); return r; };

await authed(unpaid);
await fails("student can't read banners table", `select * from public.banners`, "permission denied");
await fails("student can't publish", `select public.admin_save_banner('hi', null, null, 'all', 'info', null)`, "Organizers only");
await fails("student can't list all", `select * from public.admin_banners()`, "Organizers only");
await owner();

await authed(org);
await db.exec(`select public.admin_save_banner('Everyone', null, null, 'all', 'info', null)`);
await db.exec(`select public.admin_save_banner('Pay up', '/dashboard', 'Pay', 'unpaid', 'warn', null)`);
await db.exec(`select public.admin_save_banner('Need team', null, null, 'no_team', 'info', null)`);
await db.exec(`select public.admin_save_banner('Old news', null, null, 'all', 'info', now() - interval '1 day')`);
await fails("javascript: links refused", `select public.admin_save_banner('x', 'javascript:alert(1)', null, 'all', 'info', null)`, "check constraint");
await fails("unknown audience refused", `select public.admin_save_banner('x', null, null, 'nobody', 'info', null)`, "check constraint");
await owner();

const a = await mine(unpaid), b = await mine(paidNoTeam);
ok("unpaid sees everyone + unpaid + no-team banners", a.includes("Everyone") && a.includes("Pay up") && a.includes("Need team"));
ok("paid student doesn't see the unpaid banner", b.includes("Everyone") && !b.includes("Pay up") && b.includes("Need team"));
ok("expired banners are hidden", !a.includes("Old news") && !b.includes("Old news"));

await authed(org);
const id = (await q(`select id from public.banners where message='Everyone'`))[0]?.id ?? (await q(`select id from public.admin_banners() where message='Everyone'`))[0].id;
await db.exec(`select public.admin_set_banner_active('${id}', false)`); await owner();
ok("turning a banner off hides it", !(await mine(unpaid)).includes("Everyone"));
await authed(org); await db.exec(`select public.admin_delete_banner('${id}')`); await owner();
ok("deleted banner is gone", (await q(`select count(*)::int n from public.banners where id=$1`, [id]))[0].n === 0);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
