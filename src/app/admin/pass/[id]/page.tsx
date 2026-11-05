import { notFound } from "next/navigation";
import ActionButton from "@/components/ActionButton";
import Avatar from "@/components/Avatar";
import { adminCheckIn, adminComp } from "@/app/admin/actions";
import { requireAdmin, UUID } from "@/lib/admin";

// Organizer-only status page for one student (manual check-in toggle). Not linked from anywhere; admin-gated by requireAdmin.
export default async function PassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data: p } = await supabase.from("profiles").select("id, full_name, email, year, study_area, avatar_url, onboarded_at, paid_at, checked_in_at, schools(name)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: tm } = await supabase.from("team_members").select("team_id, teams(name)").eq("user_id", id).maybeSingle();
  const team = (tm?.teams as unknown as { name: string } | null)?.name;
  const school = (p.schools as unknown as { name: string } | null)?.name;
  return (
    <div className="mx-auto max-w-md text-center">
      <Avatar url={p.avatar_url} name={p.full_name} size={96} />
      <h1 className="mt-5 font-heading text-4xl font-bold">{p.full_name ?? "No name"}</h1>
      <p className="mt-1 text-[15px] text-muted">{school}{p.study_area ? ` · ${p.study_area}` : ""}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2 text-[13px] font-medium">
        <span className={`chip ${p.paid_at ? "border-ok text-ok" : "border-warn text-warn"}`}>{p.paid_at ? "Paid" : "Not paid"}</span>
        <span className="chip">{team ? `Team: ${team}` : "No team"}</span>
        {p.checked_in_at && <span className="chip border-ink bg-ink text-card">Checked in</span>}
      </div>
      <div className="mt-8 flex flex-col items-stretch gap-3">
        <ActionButton className="w-full py-4 text-base" variant={p.checked_in_at ? "secondary" : "primary"} action={adminCheckIn.bind(null, p.id, !p.checked_in_at)}>{p.checked_in_at ? "Undo check-in" : "Check in"}</ActionButton>
        {!p.paid_at && <ActionButton className="w-full" variant="secondary" confirm="Mark paid without a Stripe charge? This is logged." action={adminComp.bind(null, p.id, "marked paid at check-in")}>Mark paid (cash or scholarship)</ActionButton>}
      </div>
      <p className="mt-6 text-sm text-muted">{p.email}</p>
    </div>
  );
}
