import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import CopyLink from "@/components/admin/CopyLink";
import NewEventForm from "@/components/admin/NewEventForm";
import PageHeader from "@/components/PageHeader";
import QrCode from "@/components/QrCode";
import { adminSetEventActive } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { siteUrl } from "@/lib/site";

export type SourceRow = { id: string; slug: string; name: string; event_date: string | null; active: boolean; signups: number; finished: number; paid: number };

export default async function EventsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_source_stats");
  const { sources, direct } = (data ?? { sources: [], direct: 0 }) as { sources: SourceRow[]; direct: number };
  const site = await siteUrl();
  const total = sources.reduce((n, s) => n + s.signups, 0);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Events" title="Sign-up QR codes">Make a QR code for each event you tell people about. Anyone who scans it and signs up is credited to that event, so you can see which events bring students in.</PageHeader>
      <NewEventForm />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel"><p className="eyebrow text-muted">Credited to an event</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{total}</p></div>
        <div className="panel"><p className="eyebrow text-muted">Came straight to the site</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{direct}</p></div>
        <div className="panel"><p className="eyebrow text-muted">Events</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{sources.length}</p></div>
      </div>

      {sources.length === 0 ? <p className="panel text-[15px] text-muted">No events yet. Create one above.</p> : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {sources.map((s) => {
            const url = `${site}/join/${s.slug}`;
            return (
              <li key={s.id} className={`panel flex flex-col gap-5 ${s.active ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-2xl font-semibold">{s.name}</h2>
                    <p className="text-sm text-muted">{s.event_date ? new Date(s.event_date + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "No date"}</p>
                  </div>
                  <span className={`chip ${s.active ? "border-ok text-ok" : "border-warn text-warn"}`}>{s.active ? "QR code on" : "Off"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="rounded-xl border border-line bg-white p-3"><QrCode value={url} size={140} label={`QR code for ${s.name}`} /></div>
                  <dl className="grid grid-cols-3 gap-5 text-center">
                    <div><dt className="eyebrow text-muted">Sign-ups</dt><dd className="mt-1 font-heading text-3xl font-bold tabular-nums">{s.signups}</dd></div>
                    <div><dt className="eyebrow text-muted">Profile</dt><dd className="mt-1 font-heading text-3xl font-bold tabular-nums">{s.finished}</dd></div>
                    <div><dt className="eyebrow text-muted">Paid</dt><dd className="mt-1 font-heading text-3xl font-bold tabular-nums">{s.paid}</dd></div>
                  </dl>
                </div>
                <p className="break-all text-sm text-muted">{url}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/events/${s.slug}`} className="btn-primary">Open poster</Link>
                  <CopyLink url={url} />
                  <ActionButton variant="secondary" action={adminSetEventActive.bind(null, s.id, !s.active)}>{s.active ? "Turn off" : "Turn on"}</ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
