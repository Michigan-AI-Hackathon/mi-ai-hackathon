import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/components/admin/PrintButton";
import QrCode from "@/components/QrCode";
import { requireAdmin, UUID } from "@/lib/admin";
import { EVENT } from "@/lib/config";
import { siteUrl } from "@/lib/site";
import type { Activity } from "../page";

// Printable poster for one workshop code.
export default async function ActivityPoster({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_points_activities");
  const a = ((data ?? []) as Activity[]).find((x) => x.id === id);
  if (!a) notFound();
  const url = `${await siteUrl()}/points?t=${a.token}`;
  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden"><Link href="/admin/points" className="link-draw text-sm text-muted hover:text-ink">All workshops</Link><PrintButton label="Print poster" /></div>
      <div className="mx-auto max-w-xl rounded-3xl border border-line bg-card p-10 text-center print:border-0">
        <p className="eyebrow text-primary">{EVENT.name}</p>
        <h1 className="mt-4 font-heading text-5xl font-bold leading-[0.98]">{a.name}</h1>
        <p className="mt-4 text-2xl font-semibold"><span className="hl">+{a.points} points</span></p>
        <div className="mx-auto mt-8 w-fit rounded-2xl border-2 border-ink bg-white p-5"><QrCode value={url} size={300} label={`Points QR code for ${a.name}`} /></div>
        <p className="mt-5 font-heading text-2xl font-semibold">Scan to earn points</p>
        <p className="mt-1 text-sm text-muted">Check in at the venue first. One scan per person.</p>
      </div>
    </div>
  );
}
