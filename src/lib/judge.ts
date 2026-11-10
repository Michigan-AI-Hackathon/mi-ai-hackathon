import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JudgeMe = { id: string; name: string | null; org: string | null; email: string };

// Gate for the judge area. Anyone who isn't on the organizers' judge list gets a plain 404, like /admin.
// The database re-checks inside every judge function and only returns teams assigned to this judge.
export async function requireJudge() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/judge");
  const { data } = await supabase.rpc("judge_me");
  if (!data) notFound();
  return { supabase, judge: data as JudgeMe };
}
