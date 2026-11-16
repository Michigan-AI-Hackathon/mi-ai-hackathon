"use client";
import { useActionState } from "react";
import { adminSaveTier, adminSetSponsorship, adminSponsorDomain } from "@/app/admin/schools/actions";
import type { ActionResult } from "@/app/actions";

export type Tier = { code: string; label: string; pct: number };
export type SchoolOption = { id: number; name: string };

function Msg({ s }: { s: ActionResult }) {
  return <>{s?.error && <p role="alert" className="w-full text-sm text-danger">{s.error}</p>}{s?.ok && <p role="status" className="w-full text-sm text-ok">{s.ok}</p>}</>;
}

export function TierForm({ tier }: { tier?: Tier }) {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminSaveTier, null);
  const id = tier?.code ?? "new";
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div><label htmlFor={`tc-${id}`} className="label">Tier</label>
        {tier ? <><input type="hidden" name="code" value={tier.code} /><p id={`tc-${id}`} className="grid h-11 w-14 place-items-center rounded-lg border border-line bg-card font-heading text-lg font-bold">{tier.code}</p></>
              : <input id={`tc-${id}`} name="code" required maxLength={3} placeholder="D" className="input w-16 uppercase" />}</div>
      <div className="min-w-40 flex-1"><label htmlFor={`tl-${id}`} className="label">Name</label><input id={`tl-${id}`} name="label" required maxLength={40} defaultValue={tier?.label} placeholder="e.g. Quarter sponsor" className="input" /></div>
      <div><label htmlFor={`tp-${id}`} className="label">School covers (%)</label><input id={`tp-${id}`} name="pct" type="number" required min={0} max={100} defaultValue={tier?.pct} className="input w-28" /></div>
      <button className="btn-secondary min-h-11" disabled={pending}>{pending ? "Saving…" : tier ? "Save" : "Add tier"}</button>
      <Msg s={s} />
    </form>
  );
}

// Used both to sponsor a new school (school picker) and to edit one that is already sponsored (school fixed).
export function SponsorForm({ tiers, schools, current }: {
  tiers: Tier[]; schools?: SchoolOption[];
  current?: { id: number; name: string; tier: string; sponsor: string | null; seat_cap: number | null };
}) {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminSetSponsorship, null);
  const id = current?.id ?? "new";
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {current ? <input type="hidden" name="school" value={current.id} /> : (
        <div className="min-w-56 flex-1"><label htmlFor={`ss-${id}`} className="label">School</label>
          <select id={`ss-${id}`} name="school" required defaultValue="" className="input">
            <option value="" disabled>Pick a school</option>
            {schools?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select></div>
      )}
      <div><label htmlFor={`st-${id}`} className="label">Tier</label>
        <select id={`st-${id}`} name="tier" required defaultValue={current?.tier ?? ""} className="input">
          <option value="" disabled>Pick</option>
          {tiers.map((t) => <option key={t.code} value={t.code}>{t.code}: {t.label} ({t.pct}%)</option>)}
        </select></div>
      <div className="min-w-40 flex-1"><label htmlFor={`sn-${id}`} className="label">Who is paying (optional)</label><input id={`sn-${id}`} name="sponsor" maxLength={80} defaultValue={current?.sponsor ?? ""} className="input" placeholder="School or company" /></div>
      <div><label htmlFor={`sc-${id}`} className="label">Tickets paid for</label><input id={`sc-${id}`} name="seat_cap" type="number" min={0} defaultValue={current?.seat_cap ?? ""} placeholder="No limit" className="input w-28" /></div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="whole_group" defaultChecked /> Shared-email campuses too</label>
      <button className="btn-primary min-h-11" disabled={pending}>{pending ? "Saving…" : current ? "Save" : "Sponsor school"}</button>
      <Msg s={s} />
    </form>
  );
}

// The usual way: type the email ending (umich.edu). Every school that uses it gets the tier.
export function DomainForm({ tiers }: { tiers: Tier[] }) {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminSponsorDomain, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1"><label htmlFor="dm-d" className="label">Email ending</label>
        <div className="flex items-center rounded-lg border border-line bg-card pl-3 focus-within:border-ink"><span aria-hidden className="text-muted">@</span>
          <input id="dm-d" name="domain" required maxLength={80} placeholder="umich.edu" autoCapitalize="none" spellCheck={false} className="w-full bg-transparent px-2 py-3 outline-none" /></div></div>
      <div><label htmlFor="dm-t" className="label">Tier</label>
        <select id="dm-t" name="tier" required defaultValue="" className="input">
          <option value="" disabled>Pick</option>
          {tiers.map((t) => <option key={t.code} value={t.code}>{t.code}: {t.label} ({t.pct}%)</option>)}
        </select></div>
      <div className="min-w-40 flex-1"><label htmlFor="dm-s" className="label">Who is paying (optional)</label><input id="dm-s" name="sponsor" maxLength={80} className="input" placeholder="School or company" /></div>
      <div><label htmlFor="dm-c" className="label">Tickets paid for</label><input id="dm-c" name="seat_cap" type="number" min={0} placeholder="No limit" className="input w-28" /></div>
      <button className="btn-primary min-h-11" disabled={pending}>{pending ? "Saving…" : "Apply"}</button>
      <Msg s={s} />
    </form>
  );
}
