import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Gate for every organizer page and action. Non-organizers get a plain 404 so the area isn't discoverable.
// This is only the front door: the database re-checks public.is_admin() inside every organizer function.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile } = await supabase.from("profiles").select("id, full_name, email, is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) notFound();
  return { supabase, profile: profile as { id: string; full_name: string | null; email: string; is_admin: boolean } };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
