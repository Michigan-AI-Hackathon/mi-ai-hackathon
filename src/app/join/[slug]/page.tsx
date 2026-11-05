import Link from "next/link";
import Logo from "@/components/Logo";
import { EVENT, currentFee } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Join the Michigan AI Hackathon", robots: { index: false, follow: false } };

// Where an event QR code lands. Public. The middleware has already remembered the code.
export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: info }, { data: { user } }] = await Promise.all([supabase.rpc("source_info", { p_slug: slug }), supabase.auth.getUser()]);
  const name = (info as { name?: string } | null)?.name;
  const fee = currentFee();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-6">
      <Logo />
      <div className="my-auto py-12">
        <p className="rise eyebrow text-primary" style={{ "--i": 0 } as React.CSSProperties}>{name ? `You met us at ${name}` : "You're invited"}</p>
        <h1 className="rise mt-4 font-heading text-5xl font-bold leading-[0.98] sm:text-7xl" style={{ "--i": 1 } as React.CSSProperties}>
          Michigan&apos;s <span className="hl whitespace-nowrap">24-hour</span> hackathon.
        </h1>
        <p className="rise mt-6 max-w-lg text-lg text-muted" style={{ "--i": 2 } as React.CSSProperties}>{EVENT.dateLabel}, Detroit.</p>
        <div className="rise mt-9 flex flex-wrap items-center gap-4" style={{ "--i": 3 } as React.CSSProperties}>
          <Link href={user ? "/dashboard" : "/login"} className="btn-primary px-7 py-4 text-base">{user ? "Dashboard" : "Sign up"} <span aria-hidden>→</span></Link>
        </div>
        <p className="rise mt-8 text-sm text-muted" style={{ "--i": 4 } as React.CSSProperties}>Registration is {fee.label}.</p>
      </div>
    </div>
  );
}
