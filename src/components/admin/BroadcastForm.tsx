"use client";
import { useActionState, useState } from "react";
import { sendAnnouncement, type Audience } from "@/app/admin/actions";
import type { ActionResult } from "@/app/actions";

const LABELS: Record<Audience, string> = {
  everyone: "Everyone who signed up", unpaid: "Students who haven't paid", "no-team": "Paid students with no team",
  "unlocked-teams": "Members of teams that aren't locked", "checked-in": "Students who are checked in",
};

export default function BroadcastForm({ counts }: { counts: Record<Audience, number> }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(sendAnnouncement, null);
  const [a, setA] = useState<Audience>("everyone");
  return (
    <form action={action} className="panel max-w-2xl space-y-5"
      onSubmit={(e) => { if (!window.confirm(`Send this to ${counts[a]} students? This can't be undone, and it's logged.`)) e.preventDefault(); }}>
      <div>
        <label htmlFor="audience" className="label">Send to</label>
        <select id="audience" name="audience" className="input" value={a} onChange={(e) => setA(e.target.value as Audience)}>
          {(Object.keys(LABELS) as Audience[]).map((k) => <option key={k} value={k}>{LABELS[k]} ({counts[k]})</option>)}
        </select>
      </div>
      <div><label htmlFor="subject" className="label">Subject</label><input id="subject" name="subject" className="input" maxLength={120} required /></div>
      <div><label htmlFor="body" className="label">Message</label><textarea id="body" name="body" rows={7} maxLength={1800} className="input" required />
        <p className="hint">Plain text, up to 1,800 characters. Emails greet each student by first name.</p></div>
      <fieldset className="space-y-2 text-[15px]">
        <legend className="label">How to send it</legend>
        <label className="flex items-center gap-2"><input type="checkbox" name="inbox" defaultChecked className="accent-primary" />In their Messages, from &quot;Organizers&quot; (shows as unread)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="email" defaultChecked className="accent-primary" />By email</label>
      </fieldset>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-ok">{state.ok}</p>}
      <button className="btn-primary" disabled={pending || counts[a] === 0}>{pending ? "Sending…" : `Send to ${counts[a]} students`}</button>
    </form>
  );
}
