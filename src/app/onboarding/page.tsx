import { requireStudent } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";
import ProfileForm from "./ProfileForm";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { supabase, profile } = await requireStudent({ allowNotOnboarded: true });
  const { data: schools } = await supabase.rpc("schools_for_email", { p_email: profile.email });
  return <ProfileForm profile={profile} schools={(schools ?? []) as { id: number; name: string }[]} isNew={!profile.onboarded_at} next={safeNext(next)} />;
}
