import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/Logo";
import AutoCheckIn from "@/components/AutoCheckIn";
import { StatusScreen } from "@/components/AutoCheckIn";
import { createClient } from "@/lib/supabase/server";
import { isDev } from "@/lib/dev-preview";
import type { Profile } from "@/lib/session";

export const metadata = { robots: { index: false, follow: false } };

// Opened by scanning the organizers' venue QR code (/checkin?t=<venue token>).
// Signed out -> middleware sends them to /login and brings them back here with the token.
// The token is validated in the database (self_check_in); this page only picks which screen to show.
export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ t?: string; demo?: string }> }) {
  const { t, demo } = await searchParams;
  const here = `/checkin${t ? `?t=${encodeURIComponent(t)}` : ""}`;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (!profile.onboarded_at) redirect(`/onboarding?next=${encodeURIComponent(here)}`);

  const [{ data: membership }, { data: settings }] = await Promise.all([
    supabase.from("team_members").select("teams(name)").eq("user_id", user.id).maybeSingle(),
    supabase.from("app_settings").select("require_payment").single(),
  ]);
  const team = (membership?.teams as unknown as { name: string } | null)?.name ?? null;
  const first = profile.full_name?.split(" ")[0] ?? "there";
  const checkedIn = !!profile.checked_in_at || (isDev && demo === "checked");

  let body: React.ReactNode;
  if (checkedIn) {
    body = <StatusScreen tone="ok" title={`You're checked in, ${first}.`} text={team ? `Your team: ${team}.` : "You don't have a team yet."} href={team ? "/team" : "/teams"} cta={team ? "My team" : "Find a team"} />;
  } else if (!t || !/^[a-f0-9]{16,64}$/i.test(t)) {
    body = <StatusScreen tone="info" title="Scan the QR code at the venue" text="Open your phone camera, point it at the organizers' check-in QR code, and tap the link. You'll be checked in right away." href="/dashboard" cta="Dashboard" />;
  } else if (settings?.require_payment !== false && !profile.paid_at) {
    body = <StatusScreen tone="warn" title="Registration fee not paid" text="Pay the fee to check in. After paying, scan the venue QR code again." href="/dashboard" cta="Pay now" />;
  } else {
    body = <AutoCheckIn token={t} name={first} team={team} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <Logo href="/dashboard" />
      <div className="my-auto py-10">{body}</div>
      <p className="text-center text-sm text-muted">Need help? Ask an organizer at the desk. <Link href="/dashboard" className="underline">Dashboard</Link></p>
    </div>
  );
}
