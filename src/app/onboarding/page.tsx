import { requireStudent } from "@/lib/session";
import ProfileForm from "./ProfileForm";

export default async function OnboardingPage() {
  const { supabase, profile } = await requireStudent({ allowNotOnboarded: true });
  const { data: schools } = await supabase.rpc("schools_for_email", { p_email: profile.email });
  return <ProfileForm profile={profile} schools={(schools ?? []) as { id: number; name: string }[]} isNew={!profile.onboarded_at} />;
}
