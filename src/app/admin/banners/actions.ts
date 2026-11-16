"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, UUID } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

const AUDIENCES = ["all", "unpaid", "paid", "no_team", "on_team", "unfinished"];

export async function adminCreateBanner(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const message = String(form.get("message") ?? "").trim().slice(0, 240);
  const link = String(form.get("link_url") ?? "").trim();
  const audience = String(form.get("audience") ?? "all");
  const tone = form.get("tone") === "warn" ? "warn" : "info";
  const days = Number(form.get("days") ?? 0);
  if (!message) return { error: "Write the banner message." };
  if (!AUDIENCES.includes(audience)) return { error: "Pick who should see it." };
  if (link && !/^(https:\/\/|\/)\S*$/.test(link)) return { error: "Links start with https:// or /" };
  const ends = days > 0 && days <= 365 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  const { error } = await supabase.rpc("admin_save_banner", {
    p_message: message, p_link_url: link || null, p_link_label: String(form.get("link_label") ?? "").trim().slice(0, 30) || null,
    p_audience: audience, p_tone: tone, p_ends_at: ends,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Banner is live." };
}

export async function adminSetBannerActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) return { error: "Bad request." };
  const { error } = await supabase.rpc("admin_set_banner_active", { p_id: id, p_active: !!active });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: active ? "Banner is on." : "Banner is off." };
}

export async function adminDeleteBanner(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) return { error: "Bad request." };
  const { error } = await supabase.rpc("admin_delete_banner", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Deleted." };
}
