"use client";
import { useActionState } from "react";
import { adminCreateBanner } from "@/app/admin/banners/actions";
import type { ActionResult } from "@/app/actions";

export const AUDIENCE_LABELS: Record<string, string> = {
  all: "Everyone", unpaid: "Haven't paid", paid: "Have paid", no_team: "Not on a team", on_team: "On a team", unfinished: "Profile unfinished",
};

export default function BannerForm() {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminCreateBanner, null);
  return (
    <form action={action} className="panel grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor="b-msg" className="label">Message</label>
        <input id="b-msg" name="message" required maxLength={240} className="input" placeholder="e.g. Doors open at 8am. Bring your laptop and charger." /></div>
      <div><label htmlFor="b-link" className="label">Link (optional)</label><input id="b-link" name="link_url" className="input" placeholder="https://… or /teams" /></div>
      <div><label htmlFor="b-label" className="label">Link text</label><input id="b-label" name="link_label" maxLength={30} className="input" placeholder="Learn more" /></div>
      <div><label htmlFor="b-aud" className="label">Who sees it</label>
        <select id="b-aud" name="audience" className="input" defaultValue="all">{Object.entries(AUDIENCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="b-tone" className="label">Style</label><select id="b-tone" name="tone" className="input"><option value="info">Normal</option><option value="warn">Important</option></select></div>
        <div><label htmlFor="b-days" className="label">Show for (days)</label><input id="b-days" name="days" type="number" min={0} max={365} className="input" placeholder="No end" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Publishing…" : "Publish banner"}</button>
        {s?.error && <span role="alert" className="text-sm text-danger">{s.error}</span>}
        {s?.ok && <span role="status" className="text-sm text-ok">{s.ok}</span>}
      </div>
    </form>
  );
}
