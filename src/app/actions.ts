"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { money, priceFor, type Sponsorship } from "@/lib/pricing";
import { AVATAR_KEYS, EVENT, TRACKS, YEARS, currentFee } from "@/lib/config";

export type ActionResult = { error?: string; ok?: string } | null;

async function getUserOrRedirect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Postgres raises our plain-English messages; pass them through.
const msg = (e: { message: string } | null) => e?.message ?? "Something went wrong. Try again.";

// ---------------------------------------------------------------- profile
export async function saveProfile(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await getUserOrRedirect();
  const list = (k: string) => form.getAll(k).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const full_name = String(form.get("full_name") ?? "").trim();
  const year = String(form.get("year") ?? "");
  const study_area = String(form.get("study_area") ?? "").trim();
  const tracks = list("tracks").filter((t) => (TRACKS as readonly string[]).includes(t));
  const schoolRaw = form.get("school_id");
  const linkedin = String(form.get("linkedin_url") ?? "").trim();
  const avatar = String(form.get("avatar_url") ?? "").trim();

  if (full_name.length < 2) return { error: "Add your name." };
  if (!(YEARS as readonly string[]).includes(year)) return { error: "Pick your year." };
  if (!study_area) return { error: "Pick what you study." };
  if (!tracks.length) return { error: "Pick at least one track." };
  const ownFolder = `/storage/v1/object/public/avatars/${user.id}/`;
  if (avatar && !AVATAR_KEYS.includes(avatar)
      && !(avatar.startsWith("https://") && avatar.includes(ownFolder))) return { error: "That picture isn't valid. Pick another." };
  if (linkedin && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedin)) return { error: "LinkedIn links start with https://linkedin.com/" };

  const { data: current } = await supabase.from("profiles").select("onboarded_at, school_id").eq("id", user.id).single();
  const update: Record<string, unknown> = {
    full_name, year, study_area, tracks,
    skills: list("skills"), interests: list("interests"),
    bio: String(form.get("bio") ?? "").trim().slice(0, 100) || null,
    looking_for_team: form.get("looking_for_team") === "on",
    pronouns: String(form.get("pronouns") ?? "").trim().slice(0, 30) || null,
    placement_pref: ["place_me", "own_team"].includes(String(form.get("placement_pref"))) ? String(form.get("placement_pref")) : null,
    linkedin_url: linkedin || null,
    avatar_url: avatar || null,
  };
  const resume = String(form.get("resume_path") ?? "").trim();
  if (resume && !resume.startsWith(`${user.id}/`) || resume.includes("..")) return { error: "That resume isn't valid. Upload it again." };
  update.resume_path = resume || null;
  if (schoolRaw) update.school_id = Number(schoolRaw);
  if (!current?.school_id && !schoolRaw) return { error: "Pick your campus." };
  if (!current?.onboarded_at) update.onboarded_at = new Date().toISOString();

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { error: msg(error) };
  revalidatePath("/", "layout");
  if (!current?.onboarded_at) redirect(safeNext(String(form.get("next") ?? "")) ?? "/dashboard?welcome=1");
  return { ok: "Profile saved." };
}

// ---------------------------------------------------------------- payment
export async function startCheckout() {
  const { supabase, user } = await getUserOrRedirect();
  const { data: p } = await supabase.from("profiles").select("paid_at").eq("id", user.id).single();
  if (p?.paid_at) redirect("/dashboard");
  const fee = currentFee();
  // The school's share comes from the database, worked out from the school on this student's verified profile.
  const { data: sponsor } = await supabase.rpc("my_sponsorship");
  const sp = (sponsor as Sponsorship | null) ?? { subsidy_pct: 0 };
  const quote = priceFor(fee.cents, sp.subsidy_pct);

  if (quote.dueCents === 0) {
    // Fully covered by the school: no Stripe. The database re-checks the sponsorship and records the claim.
    const { error } = await createAdminClient().rpc("claim_sponsored_registration", { p_user: user.id, p_base_cents: fee.cents });
    if (error) {
      console.error("Sponsored claim failed:", error.message);
      redirect("/dashboard?sponsor=changed");
    }
    revalidatePath("/", "layout");
    redirect("/dashboard?claimed=1");
  }

  // Prefer the configured site URL; the request's own Origin header is only a fallback for local development.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  // Recorded on the payment by the Stripe webhook, so the sponsor's share is exact even if the tier is edited later.
  const metadata: Record<string, string> = { user_id: user.id };
  if (quote.subsidyCents > 0 && sp.school_id) {
    Object.assign(metadata, {
      base_cents: String(quote.baseCents), subsidy_pct: String(quote.subsidyPct), subsidy_cents: String(quote.subsidyCents),
      school_id: String(sp.school_id), tier: sp.tier ?? "",
    });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    allow_promotion_codes: true, // coupons (e.g. early-bird codes) are created in the Stripe dashboard
    client_reference_id: user.id,
    metadata,
    payment_intent_data: { metadata },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: quote.dueCents,
        product_data: {
          name: `${EVENT.name} registration fee${fee.earlyBird ? " (early bird)" : ""}`,
          description: quote.subsidyCents > 0 ? `${money(quote.baseCents)} fee, your school covers ${money(quote.subsidyCents)}. Non-refundable.` : "Non-refundable.",
        },
      },
    }],
    success_url: `${origin}/dashboard?paid=1`,
    cancel_url: `${origin}/dashboard`,
  });
  redirect(session.url!);
}

// ---------------------------------------------------------------- teams
export async function createTeam(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await getUserOrRedirect();
  const { error } = await supabase.rpc("create_team", {
    p_name: String(form.get("name") ?? ""),
    p_track: String(form.get("track") ?? "") || null,
    p_needs: String(form.get("needs") ?? "").trim() || null,
  });
  if (error) return { error: error.message.includes("check constraint") ? "Team names are 2 to 40 characters." : msg(error) };
  revalidatePath("/", "layout");
  redirect("/team");
}

export async function updateTeam(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await getUserOrRedirect();
  const { error } = await supabase.rpc("update_team", {
    p_name: String(form.get("name") ?? ""),
    p_track: String(form.get("track") ?? "") || null,
    p_needs: String(form.get("needs") ?? "").trim() || null,
  });
  if (error) return { error: msg(error) };
  revalidatePath("/team");
  return { ok: "Team updated." };
}

async function rpcAction(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionResult> {
  const { supabase } = await getUserOrRedirect();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: msg(error) };
  revalidatePath("/", "layout");
  return { ok };
}

export async function sendInvite(studentId: string) { return rpcAction("send_invite", { p_student: studentId }, "Invite sent."); }
export async function requestToJoin(teamId: string) { return rpcAction("request_to_join", { p_team: teamId }, "Request sent."); }
export async function respondInvite(inviteId: string, accept: boolean) {
  return rpcAction("respond_invite", { p_invite: inviteId, p_accept: accept }, accept ? "You're on the team." : "Declined.");
}
export async function cancelInvite(inviteId: string) { return rpcAction("cancel_invite", { p_invite: inviteId }, "Cancelled."); }
export async function lockTeam() { return rpcAction("lock_team", {}, "Your team is locked in."); }
export async function leaveTeam() { return rpcAction("leave_team", {}, "You left the team."); }
export async function setTeamLeader(userId: string) { return rpcAction("set_team_leader", { p_user: userId }, "Team leader changed."); }

// Students who asked organizers to place them can switch to picking their own team (or back) without redoing their profile.
export async function setPlacementPref(pref: "place_me" | "own_team"): Promise<ActionResult> {
  const { supabase, user } = await getUserOrRedirect();
  const { error } = await supabase.from("profiles").update({ placement_pref: pref }).eq("id", user.id);
  if (error) return { error: msg(error) };
  revalidatePath("/", "layout");
  return { ok: pref === "place_me" ? "Organizers will place you." : "You'll pick your own team." };
}

// Leave the hackathon for good: off the team, then the login (and with it the profile, messages and points) is deleted.
export async function deleteAccount(confirmText: string): Promise<ActionResult> {
  const { supabase, user } = await getUserOrRedirect();
  if (confirmText.trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  const { error } = await supabase.rpc("leave_hackathon");
  if (error) return { error: msg(error) };
  const admin = createAdminClient();
  // Their uploaded files go too (a failure here shouldn't strand the account).
  for (const bucket of ["avatars", "resumes"]) {
    const { data: files } = await admin.storage.from(bucket).list(user.id);
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) { console.error("Account delete failed:", delErr.message); return { error: "We took you off your team but couldn't finish deleting your account. Try again or email an organizer." }; }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

// ---------------------------------------------------------------- check-in
export async function selfCheckIn(token: string): Promise<ActionResult> {
  const { supabase } = await getUserOrRedirect();
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return { error: "That QR code is not valid. Ask an organizer for help." };
  const { error } = await supabase.rpc("self_check_in", { p_token: token });
  if (error) return { error: msg(error) };
  revalidatePath("/", "layout");
  return { ok: "Checked in." };
}

// ---------------------------------------------------------------- messages
export async function messageStudent(otherId: string): Promise<ActionResult> {
  const { supabase } = await getUserOrRedirect();
  const { data, error } = await supabase.rpc("start_direct_conversation", { p_other: otherId });
  if (error) return { error: msg(error) };
  redirect(`/messages/${data}`);
}
