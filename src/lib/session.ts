import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string; email: string; full_name: string | null; school_id: number | null; year: string | null;
  study_area: string | null; skills: string[]; interests: string[]; tracks: string[]; bio: string | null;
  looking_for_team: boolean; linkedin_url: string | null; onboarded_at: string | null; paid_at: string | null;
  is_admin: boolean; avatar_url: string | null; checked_in_at: string | null; signup_source: string | null;
  pronouns: string | null; resume_path: string | null; placement_pref: "place_me" | "own_team" | null;
};

// Signed-in student + their profile. Sends them to login/onboarding if needed.
export async function requireStudent({ allowNotOnboarded = false } = {}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");
  if (!profile.onboarded_at && !allowNotOnboarded) {
    // Organizers and judges are not participants: send them to their own area, not student onboarding.
    if (profile.is_admin) redirect("/admin");
    const { data: judge } = await supabase.rpc("judge_me");
    if (judge) redirect("/judge");
    redirect("/onboarding");
  }
  return { supabase, user, profile };
}
