// Removes everything scripts/seed-demo.mjs created (exact email list, so real students are never touched).
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/remove-demo.mjs
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key } = process.env;
if (!url || !key) { console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY."); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const EMAILS = [
  "organizer@umich.edu", "organizer2@msu.edu",
  "ns.ava@umich.edu", "ns.ben@msu.edu", "ns.cam@wayne.edu", "ns.dee@gvsu.edu",
  "wh.eli@umich.edu", "wh.fay@oakland.edu", "wh.gus@wmich.edu", "wh.hana@cmich.edu",
  "bh.ivy@msu.edu", "bh.jay@umich.edu", "bh.kai@emich.edu",
  "mr.lena@umich.edu", "mr.milo@kettering.edu", "sl.nora@msu.edu",
  "solo.omar@umich.edu", "solo.pia@msu.edu", "solo.quin@wayne.edu", "solo.rae@ferris.edu", "solo.sam@gvsu.edu",
  "unpaid.tia@umich.edu", "unpaid.uma@msu.edu", "unpaid.vic@wmich.edu",
  "unfinished.wes@umich.edu", "unfinished.xia@msu.edu", "newstudent@umich.edu",
];
const TEAMS = ["Northstar", "Wolverine Health", "Blue Heron", "Maize Rush", "Spartan Labs"];

const { data: profiles } = await sb.from("profiles").select("id, email").in("email", EMAILS);
// Teams first (members go with them), then the logins (profiles, messages and points cascade).
const { error: te } = await sb.from("teams").delete().in("name", TEAMS);
if (te) console.log("teams:", te.message);
let n = 0;
for (const p of profiles ?? []) {
  const { error } = await sb.auth.admin.deleteUser(p.id);
  if (error) console.log(p.email, error.message); else n++;
}
console.log(`Removed ${n} demo accounts and the demo teams.`);
