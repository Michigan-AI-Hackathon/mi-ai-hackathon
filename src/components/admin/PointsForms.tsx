"use client";
import { useActionState } from "react";
import { adminCreateActivity, adminRedeem, adminSavePrize } from "@/app/admin/points/actions";
import type { ActionResult } from "@/app/actions";

function Msg({ s }: { s: ActionResult }) {
  return <>{s?.error && <p role="alert" className="w-full text-sm text-danger">{s.error}</p>}{s?.ok && <p role="status" className="w-full text-sm text-ok">{s.ok}</p>}</>;
}

export function NewActivityForm() {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminCreateActivity, null);
  return (
    <form action={action} className="panel flex flex-wrap items-end gap-4">
      <div className="min-w-64 flex-1"><label htmlFor="act-name" className="label">Workshop or activity</label><input id="act-name" name="name" required minLength={2} maxLength={80} className="input" placeholder="e.g. Prompt engineering workshop" /></div>
      <div><label htmlFor="act-pts" className="label">Points</label><input id="act-pts" name="points" type="number" required min={1} max={1000} defaultValue={10} className="input w-28" /></div>
      <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create QR code"}</button>
      <Msg s={s} />
    </form>
  );
}

export function PrizeForm({ prize }: { prize?: { id: string; name: string; cost: number; active: boolean } }) {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminSavePrize, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {prize && <input type="hidden" name="id" value={prize.id} />}
      <div className="min-w-40 flex-1"><label className="label sr-only" htmlFor={`pn-${prize?.id ?? "new"}`}>Prize</label><input id={`pn-${prize?.id ?? "new"}`} name="name" required minLength={2} maxLength={80} defaultValue={prize?.name} placeholder="New prize" className="input" /></div>
      <div><label className="label sr-only" htmlFor={`pc-${prize?.id ?? "new"}`}>Cost</label><input id={`pc-${prize?.id ?? "new"}`} name="cost" type="number" required min={1} defaultValue={prize?.cost} placeholder="Cost" className="input w-24" /></div>
      {prize && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={prize.active} /> Available</label>}
      <button className="btn-secondary min-h-11" disabled={pending}>{pending ? "Saving…" : prize ? "Save" : "Add prize"}</button>
      <Msg s={s} />
    </form>
  );
}

export function RedeemForm({ people, prizes }: { people: { id: string; name: string; balance: number }[]; prizes: { id: string; name: string; cost: number }[] }) {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminRedeem, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1"><label htmlFor="rd-user" className="label">Person</label>
        <select id="rd-user" name="user" required className="input" defaultValue="">
          <option value="" disabled>Pick a person</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.balance} pts)</option>)}
        </select></div>
      <div className="min-w-48 flex-1"><label htmlFor="rd-prize" className="label">Prize</label>
        <select id="rd-prize" name="prize" required className="input" defaultValue="">
          <option value="" disabled>Pick a prize</option>
          {prizes.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.cost} pts)</option>)}
        </select></div>
      <div className="min-w-40 flex-1"><label htmlFor="rd-note" className="label">Note (optional)</label><input id="rd-note" name="note" maxLength={200} className="input" /></div>
      <button className="btn-primary min-h-11" disabled={pending}>{pending ? "Recording…" : "Redeem"}</button>
      <Msg s={s} />
    </form>
  );
}
