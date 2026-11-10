"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, UUID } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

const msg = (e: { message: string } | null) => e?.message ?? "Something went wrong. Try again.";
const int = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };

export async function adminCreateActivity(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const points = int(form.get("points"));
  if (name.length < 2) return { error: "Give the workshop a name." };
  if (!(points >= 1 && points <= 1000)) return { error: "Points must be between 1 and 1000." };
  const { error } = await supabase.rpc("admin_create_activity", { p_name: name, p_points: points });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/points");
  return { ok: "Created. Its QR code is below." };
}

export async function adminSetActivityActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) return { error: "Bad request." };
  const { error } = await supabase.rpc("admin_set_activity_active", { p_id: id, p_active: !!active });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/points");
  return { ok: active ? "QR code is on." : "QR code is off." };
}

export async function adminSavePrize(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const idRaw = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const cost = int(form.get("cost"));
  if (idRaw && !UUID.test(idRaw)) return { error: "Bad request." };
  if (name.length < 2) return { error: "Name the prize." };
  if (!(cost >= 1 && cost <= 100000)) return { error: "Cost must be a positive number." };
  const active = idRaw ? form.get("active") === "on" : true;
  const { error } = await supabase.rpc("admin_save_prize", { p_id: idRaw || null, p_name: name, p_cost: cost, p_active: active });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/points");
  return { ok: "Saved." };
}

export async function adminRedeem(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const user = String(form.get("user") ?? "");
  const prize = String(form.get("prize") ?? "");
  if (!UUID.test(user) || !UUID.test(prize)) return { error: "Pick a person and a prize." };
  const { data, error } = await supabase.rpc("admin_redeem_prize", { p_user: user, p_prize: prize, p_note: String(form.get("note") ?? "").slice(0, 200) });
  if (error) return { error: msg(error) };
  revalidatePath("/admin/points");
  return { ok: `Recorded. They have ${data} points left.` };
}
