// Tests for src/lib/pricing.ts (pure) and migration 0019 (school sponsorship) in an in-memory Postgres (PGlite).
// Run: node supabase/tests/sponsorship.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

// ---- pricing.ts
const src = readFileSync(new URL("../../src/lib/pricing.ts", import.meta.url), "utf8");
const dir = mkdtempSync(join(tmpdir(), "pricing-"));
writeFileSync(join(dir, "pricing.mjs"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { priceFor, money } = await import(join(dir, "pricing.mjs"));
const pf = (b, p) => { const q = priceFor(b, p); return `${q.dueCents}/${q.subsidyCents}`; };
ok("no sponsor: pays full", pf(2000, 0) === "2000/0");
ok("tier B 50%: pays half", pf(2000, 50) === "1000/1000");
ok("tier A 100%: free", pf(2000, 100) === "0/2000");
ok("percent is clamped to 0..100", pf(2000, 150) === "0/2000" && pf(2000, -20) === "2000/0");
ok("garbage percent counts as 0", pf(2000, NaN) === "2000/0");
ok("partial sponsor never drops under Stripe's 50 cent minimum", pf(2000, 98) === "50/1950");
ok("tiny base with partial sponsor is just the base", pf(30, 50) === "30/0");
ok("rounds to whole cents", pf(2001, 50) === "1000/1001" || pf(2001, 50) === "1001/1000");
ok("money formatting", money(2000) === "$20" && money(1050) === "$10.50" && money(0) === "$0");

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
for (const f of ["0001_init", "0002_schools", "0005_team_rules_avatars", "0008_admin", "0009_checkin_and_system_messages", "0010_signup_sources", "0011_campus_schools", "0014_matching", "0015_profile_fields", "0016_judging", "0017_points", "0018_help_replies", "0019_sponsorship"]) {
  try { await db.exec(read(f)); } catch (e) { console.log(`FAIL  migration ${f}: ${e.message}`); process.exit(1); }
}
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;
  revoke all on public.pricing_tiers, public.school_sponsorship from authenticated;`);

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
const m1 = await student("m1@msu.edu", MSU), m2 = await student("m2@msu.edu", MSU), m3 = await student("m3@msu.edu", MSU);
const w1 = await student("w1@wayne.edu", WSU);
const noSchool = await student("n@umich.edu", null);

ok("tiers are seeded A=100, B=50, C=0", (await q(`select string_agg(code || subsidy_pct, ',' order by position) s from public.pricing_tiers`))[0].s === "A100,B50,C0");
ok("with no sponsorship, nobody gets a discount", (await quote(m1)).subsidy_pct === 0);

// students can't reach any of it
await authed(m1);
await fails("student can't read sponsorship table", `select * from public.school_sponsorship`, "permission denied");
await fails("student can't set a sponsorship", `select public.admin_set_school_sponsorship(1, 'A', null, null)`, "Organizers only");
await fails("student can't edit a tier", `select public.admin_save_tier('A', 'Free', 100)`, "Organizers only");
await fails("student can't read sponsor report", `select public.admin_sponsorship_data()`, "Organizers only");
await fails("student can't claim a spot directly", `select public.claim_sponsored_registration('${m1}', 2000)`, "permission denied");
await owner();

// organizer: MSU on tier B
await authed(org);
await db.exec(`select public.admin_set_school_sponsorship(${await school(MSU)}, 'B', 'Broad College', null)`);
await fails("unknown tier refused", `select public.admin_set_school_sponsorship(${await school(MSU)}, 'Z', null, null)`, "Unknown tier");
await fails("negative seats refused", `select public.admin_set_school_sponsorship(${await school(MSU)}, 'B', null, -1)`, "negative");
await fails("tier percent out of range refused", `select public.admin_save_tier('D', 'Bad', 150)`, "0 to 100");
await owner();
let v = await quote(m1);
ok("MSU student gets 50%", v.subsidy_pct === 50 && v.tier === "B" && v.label === "Half sponsor");
ok("Wayne student is unaffected by MSU's tier", (await quote(w1)).subsidy_pct === 0);
ok("student with no school gets nothing", (await quote(noSchool)).subsidy_pct === 0);
ok("quote doesn't leak the sponsor name", !("sponsor" in v) && !JSON.stringify(v).includes("Broad"));

// a 50% school can't be claimed for free
await fails("claim refused when school only covers half", `select public.claim_sponsored_registration('${m1}', 2000)`, "no longer covers");

// switch MSU to full sponsor with 2 seats
await authed(org);
await db.exec(`select public.admin_set_school_sponsorship(${await school(MSU)}, 'A', 'Broad College', 2)`);
await owner();
ok("claim returns true the first time", (await q(`select public.claim_sponsored_registration('${m1}', 2000) as v`))[0].v === true);
const pay = (await q(`select amount_cents, base_cents, subsidy_pct, subsidy_cents, tier, school_id from public.payments where user_id=$1`, [m1]))[0];
ok("claim records a $0 payment with the sponsor's share", pay.amount_cents === 0 && pay.base_cents === 2000 && pay.subsidy_cents === 2000 && pay.tier === "A" && pay.school_id === await school(MSU));
ok("claim marks the student paid", (await q(`select paid_at from public.profiles where id=$1`, [m1]))[0].paid_at !== null);
ok("claiming twice is harmless", (await q(`select public.claim_sponsored_registration('${m1}', 2000) as v`))[0].v === false && (await q(`select count(*)::int c from public.payments where user_id=$1`, [m1]))[0].c === 1);

// seat cap: 2 tickets
ok("seats_left counts down", (await quote(m2)).seats_left === 1);
await q(`select public.claim_sponsored_registration('${m2}', 2000)`);
v = await quote(m3);
ok("when the seats are used up the next student gets no discount", v.subsidy_pct === 0 && v.seats_left === 0);
await fails("claim refused once the seats are gone", `select public.claim_sponsored_registration('${m3}', 2000)`, "no longer covers");

// partially subsidized paid tickets also use up seats; refunds give them back
await q(`insert into public.payments (user_id, stripe_session_id, amount_cents, base_cents, subsidy_pct, subsidy_cents, school_id, tier) values ($1, 'x1', 1000, 2000, 50, 1000, $2, 'B')`, [w1, await school(MSU)]);
ok("a half-sponsored ticket also uses a seat (m1, m2 and w1 = 3 of 2)", (await quote(m3)).seats_left === 0);
await q(`update public.payments set status='refunded' where user_id=$1`, [m2]);
ok("refunding one ticket (used m1 + w1, cap 2) still leaves none open", (await quote(m3)).subsidy_pct === 0);
await q(`update public.school_sponsorship set seat_cap = 3`);
ok("...and a cap of 3 then leaves one seat", (await quote(m3)).seats_left === 1);

// editing a tier changes new quotes, not recorded payments
await authed(org);
await db.exec(`select public.admin_save_tier('A', 'Full sponsor', 80)`);
await owner();
ok("tier edit applies to new quotes", (await quote(m3)).subsidy_pct === 80);
ok("tier edit leaves recorded payments alone", (await q(`select subsidy_pct from public.payments where user_id=$1`, [m1]))[0].subsidy_pct === 100);
await authed(org); await db.exec(`select public.admin_save_tier('A', 'Full sponsor', 100)`); await owner();

// campuses that share a group move together
const ann = await school("University of Michigan – Ann Arbor"), flint = await school("University of Michigan – Flint");
await authed(org);
ok("group apply covers every campus sharing umich.edu", (await q(`select public.admin_set_school_sponsorship(${ann}, 'B', 'UM', null) as n`))[0].n === 3);
await owner();
ok("Flint got the same tier", (await q(`select tier from public.school_sponsorship where school_id=$1`, [flint]))[0].tier === "B");
await authed(org);
await db.exec(`select public.admin_set_school_sponsorship(${ann}, null, null, null, false)`);
await owner();
ok("remove for one campus only leaves the others", (await q(`select count(*)::int c from public.school_sponsorship where school_id in ($1,$2)`, [ann, flint]))[0].c === 1);

// report
await authed(org);
const d = (await q(`select public.admin_sponsorship_data() as v`))[0].v;
const msu = d.schools.find((s) => s.name === MSU);
ok("report: MSU free tickets and money owed", msu.free === 1 && msu.sponsored === 2 && msu.subsidy_cents === 3000);
ok("report lists every school, sponsored or not", d.schools.length > 40 && d.tiers.length === 3);
ok("sponsorship changes are audited", (await q(`select count(*)::int c from public.audit_log where action in ('set_school_sponsorship','save_tier')`))[0].c >= 4);
await owner();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
