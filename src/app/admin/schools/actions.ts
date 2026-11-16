"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

const msg = (e: { message: string } | null) => e?.message ?? "Something went wrong. Try again.";

export async function adminSaveTier(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const label = String(form.get("label") ?? "").trim().slice(0, 40);
  const pct = Number(form.get("pct"));
  if (!/^[A-Z0-9]{1,3}$/.test(code)) return { error: "A tier code is 1 to 3 letters or numbers." };
  if (!label) return { error: "Give the tier a short name." };
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return { error: "The percent covered must be a whole number from 0 to 100." };
  const { error } = await supabase.rpc("admin_save_tier", { p_code: code, p_label: label, p_pct: pct });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/schools");
  return { ok: "Saved. Students who already paid are not affected." };
}

export async function adminSetSponsorship(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const school = Number(form.get("school"));
  const tier = String(form.get("tier") ?? "").trim().toUpperCase();
  const capRaw = String(form.get("seat_cap") ?? "").trim();
  const cap = capRaw === "" ? null : Number(capRaw);
  if (!Number.isInteger(school) || school < 1) return { error: "Pick a school." };
  if (!tier) return { error: "Pick a tier." };
  if (cap !== null && (!Number.isInteger(cap) || cap < 0 || cap > 100000)) return { error: "Seats must be a whole number, or blank for no limit." };
  const { data, error } = await supabase.rpc("admin_set_school_sponsorship", {
    p_school: school, p_tier: tier, p_sponsor: String(form.get("sponsor") ?? "").slice(0, 80), p_seat_cap: cap,
    p_whole_group: form.get("whole_group") === "on",
  });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/schools");
  return { ok: (data as number) > 1 ? `Saved for ${data} campuses.` : "Saved." };
}

export async function adminRemoveSponsorship(school: number, wholeGroup: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!Number.isInteger(school) || school < 1) return { error: "Bad request." };
  const { error } = await supabase.rpc("admin_set_school_sponsorship", { p_school: school, p_tier: null, p_sponsor: null, p_seat_cap: null, p_whole_group: wholeGroup });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/schools");
  return { ok: "Sponsorship removed." };
}

// Sponsor by email ending ("umich.edu" or "@umich.edu"): every school that uses that ending gets the tier.
export async function adminSponsorDomain(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const domain = String(form.get("domain") ?? "").trim().toLowerCase().replace(/^.*@/, "");
  const tier = String(form.get("tier") ?? "").trim().toUpperCase();
  const capRaw = String(form.get("seat_cap") ?? "").trim();
  const cap = capRaw === "" ? null : Number(capRaw);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain)) return { error: "Enter an email ending like umich.edu." };
  if (!tier) return { error: "Pick a tier." };
  if (cap !== null && (!Number.isInteger(cap) || cap < 0 || cap > 100000)) return { error: "Tickets must be a whole number, or blank for no limit." };
  const { data: rows } = await supabase.from("school_domains").select("school_id").eq("domain", domain).limit(1);
  const school = rows?.[0]?.school_id as number | undefined;
  if (!school) return { error: `No school uses @${domain}.` };
  const { data, error } = await supabase.rpc("admin_set_school_sponsorship", {
    p_school: school, p_tier: tier, p_sponsor: String(form.get("sponsor") ?? "").slice(0, 80), p_seat_cap: cap, p_whole_group: true,
  });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/schools");
  return { ok: `@${domain} is set (${data} ${(data as number) === 1 ? "school" : "schools"}).` };
}
