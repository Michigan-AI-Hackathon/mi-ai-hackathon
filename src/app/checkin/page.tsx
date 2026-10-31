import Logo from "@/components/Logo";
import AutoCheckIn from "@/components/AutoCheckIn";
import { requireStudent } from "@/lib/session";

export const metadata = { robots: { index: false, follow: false } };

// Opened by scanning the QR code at the venue. Needs a signed-in student; the token is checked in the database.
export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const { profile } = await requireStudent();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <Logo href="/dashboard" />
      <div className="my-auto py-12">
        {t && /^[a-f0-9]{16,64}$/i.test(t)
          ? <AutoCheckIn token={t} name={profile.full_name?.split(" ")[0] ?? "there"} />
          : <p role="alert" className="text-center text-danger">That QR code is incomplete. Scan it again or ask an organizer.</p>}
      </div>
    </div>
  );
}
