// Demo data for a LOCAL or STAGING Supabase project: organizers, students in every state, and teams of every size.
// Safe to re-run (existing accounts are skipped). Never point this at the production project.
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_KEY=... DEMO_PASSWORD=... node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key, DEMO_PASSWORD: password } = process.env;
if (!url || !key || !password) { console.error("Set SUPABASE_URL, SUPABASE_SERVICE_KEY and DEMO_PASSWORD."); process.exit(1); }
if (/zdkihzeauilqvragfqvg/.test(url)) { console.error("Refusing to seed the production project."); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const DAY = 86400000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const now = new Date().toISOString();

async function account(email) {
  const found = (await sb.from("profiles").select("id, full_name").eq("email", email).maybeSingle()).data;
  if (found) return { id: found.id, existed: !!found.full_name };
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { id: data.user.id, existed: false };
}

// state: "new" (signed in, no profile) | "unfinished" | "unpaid" | "paid"
async function student({ email, name, year = "Third year", study = "Computer Science", tracks = ["FinTech"], skills = ["Backend"], state = "paid", pref = null, active = 1, admin = false }) {
  const { id, existed } = await account(email);
  if (existed) return id; // already seeded
  const { data: schools } = await sb.rpc("schools_for_email", { p_email: email });
  const patch = { full_name: name, is_admin: admin, last_active_at: ago(active), school_id: schools?.[0]?.id ?? null };
  if (state !== "new") Object.assign(patch, { year, study_area: study, tracks, skills, placement_pref: pref === "have" ? null : pref, looking_for_team: pref !== "have" });
  if (state === "unpaid" || state === "paid") patch.onboarded_at = now;
  if (state === "paid") patch.paid_at = now;
  const { error } = await sb.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error(`${email}: ${error.message}`);
  return id;
}

async function team(name, track, emails, { locked = false } = {}) {
  if ((await sb.from("teams").select("id").eq("name", name).maybeSingle()).data) return;
  const ids = [];
  for (const [email, person, study, active] of emails) ids.push(await student({ email, name: person, study, tracks: [track], active, pref: "have" }));
  const { data: t, error } = await sb.from("teams").insert({ name, track, created_by: ids[0] }).select().single();
  if (error) throw new Error(`${name}: ${error.message}`);
  for (const id of ids) {
    await sb.from("team_members").insert({ team_id: t.id, user_id: id });
    await sb.rpc("add_to_team_conversation", { p_team: t.id, p_user: id });
  }
  if (locked) await sb.from("teams").update({ locked_at: now }).eq("id", t.id);
}

// Organizers
await student({ email: "organizer@umich.edu", name: "Olivia Organizer", state: "paid", admin: true });
await student({ email: "organizer2@msu.edu", name: "Omar Organizer", state: "paid", admin: true });

// Teams: full and locked, full not locked, 3/4, 2/4, 1/4
await team("Northstar", "FinTech", [["ns.ava@umich.edu", "Ava Chen", "Computer Science", 0], ["ns.ben@msu.edu", "Ben Ortiz", "Business", 1], ["ns.cam@wayne.edu", "Cam Reid", "Data Science", 2], ["ns.dee@gvsu.edu", "Dee Patel", "Engineering", 0]], { locked: true });
await team("Wolverine Health", "HealthTech", [["wh.eli@umich.edu", "Eli Brooks", "Biology", 0], ["wh.fay@oakland.edu", "Fay Kim", "Nursing or health", 3], ["wh.gus@wmich.edu", "Gus Novak", "Computer Science", 1], ["wh.hana@cmich.edu", "Hana Ito", "Psychology", 6]]);
await team("Blue Heron", "SportsTech", [["bh.ivy@msu.edu", "Ivy Lopez", "Engineering", 1], ["bh.jay@umich.edu", "Jay Moore", "Computer Science", 2], ["bh.kai@emich.edu", "Kai Duval", "Business", 9]]);
await team("Maize Rush", "Industry 4.0", [["mr.lena@umich.edu", "Lena Fox", "Engineering", 0], ["mr.milo@kettering.edu", "Milo Park", "Engineering", 4]]);
await team("Spartan Labs", "FinTech", [["sl.nora@msu.edu", "Nora Quinn", "Data Science", 12]]);

// Students with no team
await student({ email: "solo.omar@umich.edu", name: "Omar Haddad", state: "paid", pref: "place_me", active: 0 });
await student({ email: "solo.pia@msu.edu", name: "Pia Santos", state: "paid", pref: "place_me", study: "Business", active: 2 });
await student({ email: "solo.quin@wayne.edu", name: "Quin Adler", state: "paid", pref: "place_me", tracks: ["HealthTech"], active: 5 });
await student({ email: "solo.rae@ferris.edu", name: "Rae Tucker", state: "paid", pref: "own_team", tracks: ["Industry 4.0"], active: 1 });
await student({ email: "solo.sam@gvsu.edu", name: "Sam Weiss", state: "paid", pref: "place_me", year: "PhD student", active: 8 });
await student({ email: "unpaid.tia@umich.edu", name: "Tia Banks", state: "unpaid", pref: "place_me", active: 0 });
await student({ email: "unpaid.uma@msu.edu", name: "Uma Roy", state: "unpaid", pref: "own_team", active: 3 });
await student({ email: "unpaid.vic@wmich.edu", name: "Vic Hart", state: "unpaid", pref: "have", active: 20 });
await student({ email: "unfinished.wes@umich.edu", name: "Wes Lund", state: "unfinished", active: 1 });
await student({ email: "unfinished.xia@msu.edu", name: "Xia Lin", state: "unfinished", active: 14 });
await student({ email: "newstudent@umich.edu", name: "Yan New", state: "new", active: 0 });

const { count } = await sb.from("profiles").select("*", { count: "exact", head: true });
console.log(`Done. ${count} profiles in this project. Organizers: organizer@umich.edu, organizer2@msu.edu.`);
