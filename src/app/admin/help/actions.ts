"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin, UUID } from "@/lib/admin";
import type { ActionResult } from "@/app/actions";

export async function adminReplyHelp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const reply = String(form.get("reply") ?? "").trim().slice(0, 1800);
  if (!UUID.test(id)) return { error: "Bad request." };
  if (reply.length < 2) return { error: "Write a reply." };
  const { error } = await supabase.rpc("admin_reply_help", { p_id: id, p_reply: reply });
  if (error) return { error: error.message };
  revalidatePath("/admin/help");
  return { ok: "Sent to their Messages." };
}

export async function adminResolveHelp(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) return { error: "Bad request." };
  const { error } = await supabase.rpc("admin_resolve_help", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/admin/help");
  return { ok: "Marked done." };
}
