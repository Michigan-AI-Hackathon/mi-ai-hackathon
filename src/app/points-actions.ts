"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions";

async function who() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type ScanResult = { error?: string; awarded?: boolean; name?: string; points?: number; balance?: number } | null;

// A student scanned a workshop QR code. The database checks the code, check-in and payment, and makes repeats harmless.
export async function scanPoints(token: string): Promise<ScanResult> {
  const { supabase } = await who();
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return { error: "That QR code is not valid. Ask an organizer for help." };
  const { data, error } = await supabase.rpc("scan_points", { p_token: token });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return data as ScanResult;
}

// Help button: store the request first (so it is never lost), organizers answer it from /admin/help.
export async function submitHelp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await who();
  const topic = String(form.get("topic") ?? "").trim().slice(0, 60);
  const message = String(form.get("message") ?? "").trim().slice(0, 2000);
  if (message.length < 3) return { error: "Write a short message." };
  const { error } = await supabase.rpc("submit_help_request", { p_topic: topic, p_message: message });
  if (error) return { error: error.message };
  return { ok: "Sent. You'll get a reply in Messages." };
}
