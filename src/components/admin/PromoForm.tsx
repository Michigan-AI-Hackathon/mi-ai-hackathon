"use client";
import { useActionState } from "react";
import { adminCreatePromo } from "@/app/admin/promo/actions";
import type { ActionResult } from "@/app/actions";

export default function PromoForm() {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminCreatePromo, null);
  return (
    <form action={action} className="panel grid gap-4 sm:grid-cols-3">
      <div><label htmlFor="p-label" className="label">Who it&apos;s for</label><input id="p-label" name="label" maxLength={60} className="input" placeholder="e.g. Organizing team" /></div>
      <div><label htmlFor="p-uses" className="label">How many people can use it</label><input id="p-uses" name="max_uses" type="number" min={1} max={10000} className="input" placeholder="No limit" /></div>
      <div><label htmlFor="p-code" className="label">Code (optional)</label><input id="p-code" name="code" maxLength={24} className="input uppercase" placeholder="We make one if blank" autoCapitalize="characters" /></div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create code"}</button>
        {s?.error && <span role="alert" className="text-sm text-danger">{s.error}</span>}
        {s?.ok && <span role="status" className="text-sm text-ok">{s.ok}</span>}
      </div>
    </form>
  );
}
