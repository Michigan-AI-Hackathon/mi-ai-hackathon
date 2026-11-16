"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

// Unambiguous letters and digits (no 0/O/1/I) so a code is easy to read out loud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");

export async function adminCreatePromo(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const typed = String(form.get("code") ?? "").trim().toUpperCase();
  const uses = Number(form.get("max_uses") ?? 0);
  if (typed && !/^[A-Z0-9-]{4,24}$/.test(typed)) return { error: "A code is 4 to 24 letters, numbers or dashes." };
  if (form.get("max_uses") && (!Number.isInteger(uses) || uses < 1 || uses > 10000)) return { error: "Uses must be a whole number from 1 to 10,000." };
  const code = typed || randomCode();
  const { error } = await supabase.rpc("admin_save_promo", { p_code: code, p_label: String(form.get("label") ?? "").trim().slice(0, 60) || null, p_max_uses: uses > 0 ? uses : null });
  if (error) return { error: error.message };
  revalidatePath("/admin/promo");
  return { ok: `Code ${code} is ready.` };
}

export async function adminSetPromoActive(code: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!/^[A-Z0-9-]{4,24}$/.test(code)) return { error: "Bad request." };
  const { error } = await supabase.rpc("admin_set_promo_active", { p_code: code, p_active: !!active });
  if (error) return { error: error.message };
  revalidatePath("/admin/promo");
  return { ok: active ? "Code is on." : "Code is off." };
}
