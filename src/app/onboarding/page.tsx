import Logo from "@/components/Logo";
import { requireStudent } from "@/lib/session";
import ProfileForm from "./ProfileForm";

export default async function OnboardingPage() {
  const { supabase, profile } = await requireStudent({ allowNotOnboarded: true });
  const { data: schools } = await supabase.rpc("schools_for_email", { p_email: profile.email });
  const isNew = !profile.onboarded_at;
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Logo href={isNew ? "/" : "/dashboard"} />
      <h1 className="mt-10 font-heading text-4xl font-bold">{isNew ? "Set up your profile" : "Edit your profile"}</h1>
      <p className="mt-3 text-[16px] text-muted">
        Other students see this when they&apos;re looking for teammates. Fields marked private are only seen by organizers.
      </p>
      <ProfileForm profile={profile} schools={(schools ?? []) as { id: number; name: string }[]} isNew={isNew} />
    </div>
  );
}
