"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { EVENT, TRACKS, YEARS } from "@/lib/config";

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

  if (full_name.length < 2) return { error: "Add your name." };
  if (!(YEARS as readonly string[]).includes(year)) return { error: "Pick your year." };
  if (!study_area) return { error: "Add what you study." };
  if (!tracks.length) return { error: "Pick at least one track." };
  if (linkedin && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedin)) return { error: "LinkedIn links start with https://linkedin.com/" };

  const { data: current } = await supabase.from("profiles").select("onboarded_at, school_id").eq("id", user.id).single();
  const update: Record<string, unknown> = {
    full_name, year, study_area, tracks,
    skills: list("skills"), interests: list("interests"),
    bio: String(form.get("bio") ?? "").trim().slice(0, 500) || null,
    looking_for_team: form.get("looking_for_team") === "on",
    linkedin_url: linkedin || null,
  };
  if (schoolRaw) update.school_id = Number(schoolRaw);
  if (!current?.school_id && !schoolRaw) return { error: "Pick your campus." };
  if (!current?.onboarded_at) update.onboarded_at = new Date().toISOString();

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { error: msg(error) };
  revalidatePath("/", "layout");
  if (!current?.onboarded_at) redirect("/dashboard?welcome=1");
  return { ok: "Profile saved." };
}

// ---------------------------------------------------------------- payment
export async function startCheckout() {
  const { supabase, user } = await getUserOrRedirect();
  const { data: p } = await supabase.from("profiles").select("email, paid_at").eq("id", user.id).single();
  if (p?.paid_at) redirect("/dashboard");
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: p?.email ?? user.email,
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    payment_intent_data: { metadata: { user_id: user.id } },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: EVENT.feeCents,
        product_data: {
          name: `${EVENT.name} registration fee`,
          description: "Non-refundable.",
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

// ---------------------------------------------------------------- messages
export async function messageStudent(otherId: string): Promise<ActionResult> {
  const { supabase } = await getUserOrRedirect();
  const { data, error } = await supabase.rpc("start_direct_conversation", { p_other: otherId });
  if (error) return { error: msg(error) };
  redirect(`/messages/${data}`);
}
