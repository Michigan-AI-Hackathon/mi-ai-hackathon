import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/components/admin/PrintButton";
import QrCode from "@/components/QrCode";
import { requireAdmin } from "@/lib/admin";
import { EVENT } from "@/lib/config";
import { siteUrl } from "@/lib/site";
import type { SourceRow } from "../page";

// A printable poster: big QR code and the pitch. Print it, or screenshot it for a slide.
export default async function PosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_source_stats");
  const s = ((data as { sources: SourceRow[] } | null)?.sources ?? []).find((x) => x.slug === slug);
  if (!s) notFound();
  const url = `${await siteUrl()}/join/${s.slug}`;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden"><Link href="/admin/events" className="link-draw text-sm text-muted hover:text-ink">All events</Link><PrintButton label="Print poster" /></div>
      <div className="mx-auto max-w-xl rounded-3xl border border-line bg-card p-10 text-center print:border-0 print:shadow-none">
        <p className="eyebrow text-primary">{EVENT.dateLabel} · Detroit</p>
        <h1 className="mt-4 font-heading text-5xl font-bold leading-[0.98]">Michigan&apos;s <span className="hl">24-hour</span> hackathon.</h1>
        <p className="mt-4 text-lg text-muted">For college students across the state. Build an AI product with a team from other schools.</p>
        <div className="mx-auto mt-8 w-fit rounded-2xl border-2 border-ink bg-white p-5"><QrCode value={url} size={300} label={`Sign-up QR code for ${s.name}`} /></div>
        <p className="mt-5 font-heading text-2xl font-semibold">Scan to sign up</p>
        <p className="mt-1 text-sm text-muted">Use your school email.</p>
        <p className="mt-6 text-sm text-muted">{EVENT.host}</p>
      </div>
    </div>
  );
}
