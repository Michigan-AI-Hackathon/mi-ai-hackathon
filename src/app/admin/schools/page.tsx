import ActionButton from "@/components/ActionButton";
import PageHeader from "@/components/PageHeader";
import { SponsorForm, TierForm, type Tier } from "@/components/admin/SponsorForms";
import { adminRemoveSponsorship } from "@/app/admin/schools/actions";
import { requireAdmin } from "@/lib/admin";
import { currentFee } from "@/lib/config";
import { money } from "@/lib/pricing";

type School = {
  id: number; name: string; kind: string; tier: string | null; sponsor: string | null; seat_cap: number | null;
  students: number; paid: number; sponsored: number; free: number; subsidy_cents: number; student_cents: number;
};

export default async function SponsorsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_sponsorship_data");
  const { tiers, schools } = (data ?? { tiers: [], schools: [] }) as { tiers: Tier[]; schools: School[] };
  const pct = new Map(tiers.map((t) => [t.code, t]));
  const sponsored = schools.filter((s) => s.tier);
  const owed = sponsored.reduce((n, s) => n + s.subsidy_cents, 0);
  const students = sponsored.reduce((n, s) => n + s.paid, 0);
  const fee = currentFee();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="School discounts" title="Free or discounted schools">
        Put a school on a tier and its students pay less, or nothing, when they register. The discount comes from the school on each student&apos;s verified email, so it can&apos;t be claimed by someone from another school.
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel"><p className="eyebrow text-muted">Sponsored schools</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{sponsored.length}</p></div>
        <div className="panel"><p className="eyebrow text-muted">Students registered at them</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{students}</p></div>
        <div className="panel"><p className="eyebrow text-muted">Sponsors owe us</p><p className="mt-3 font-heading text-4xl font-bold tabular-nums">{money(owed)}</p></div>
      </div>

      <section className="panel space-y-4" aria-labelledby="tiers-h">
        <div>
          <h2 id="tiers-h" className="font-heading text-xl font-semibold">Tiers</h2>
          <p className="text-[15px] text-muted">The ticket is {money(fee.cents)} today. A tier is the share of it the school covers. Changing a tier only affects students who haven&apos;t paid yet.</p>
        </div>
        {tiers.map((t) => <TierForm key={t.code} tier={t} />)}
        <details><summary className="link-draw min-h-11 cursor-pointer py-2 text-sm font-medium">Add another tier</summary><div className="pt-2"><TierForm /></div></details>
      </section>

      <section className="panel space-y-4" aria-labelledby="add-h">
        <h2 id="add-h" className="font-heading text-xl font-semibold">Sponsor a school</h2>
        <p className="text-[15px] text-muted">&ldquo;Tickets paid for&rdquo; is how many sponsored tickets the school bought. Once they&apos;re used up, later students pay the full price. Leave it blank for no limit.</p>
        <SponsorForm tiers={tiers} schools={schools.filter((s) => !s.tier).map((s) => ({ id: s.id, name: s.name }))} />
      </section>

      <section aria-labelledby="list-h" className="space-y-4">
        <h2 id="list-h" className="font-heading text-xl font-semibold">Sponsored schools</h2>
        {sponsored.length === 0 ? <p className="panel text-[15px] text-muted">No school is sponsored yet. Everyone pays {money(fee.cents)}.</p> : (
          <ul className="space-y-4">
            {sponsored.map((s) => {
              const t = pct.get(s.tier!);
              return (
                <li key={s.id} className="panel space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-lg font-semibold">{s.name}</h3>
                      <p className="text-sm text-muted">Tier {s.tier}{t ? `: ${t.label}, covers ${t.pct}%` : ""}{s.sponsor ? ` · paid by ${s.sponsor}` : ""}</p>
                    </div>
                    <ActionButton variant="secondary" confirm={`Remove sponsorship from ${s.name}? Students who already registered keep their spot.`} action={adminRemoveSponsorship.bind(null, s.id, true)}>Remove</ActionButton>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 text-center sm:grid-cols-5">
                    <div><dt className="eyebrow text-muted">Students</dt><dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{s.students}</dd></div>
                    <div><dt className="eyebrow text-muted">Registered</dt><dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{s.paid}</dd></div>
                    <div><dt className="eyebrow text-muted">Tickets used</dt><dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{s.sponsored}{s.seat_cap !== null ? ` / ${s.seat_cap}` : ""}</dd></div>
                    <div><dt className="eyebrow text-muted">Students paid</dt><dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{money(s.student_cents)}</dd></div>
                    <div><dt className="eyebrow text-muted">School owes</dt><dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{money(s.subsidy_cents)}</dd></div>
                  </dl>
                  <SponsorForm tiers={tiers} current={{ id: s.id, name: s.name, tier: s.tier!, sponsor: s.sponsor, seat_cap: s.seat_cap }} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
