"use client";
import { useActionState } from "react";
import { createTeam, updateTeam, type ActionResult } from "@/app/actions";
import { TRACKS } from "@/lib/config";

export function TeamForm({ mode, initial }: { mode: "create" | "edit"; initial?: { name: string; track: string | null; needs: string | null } }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(mode === "create" ? createTeam : updateTeam, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="name" className="label">Team name</label>
        <input id="name" name="name" required minLength={2} maxLength={40} className="input" defaultValue={initial?.name} />
      </div>
      <div>
        <label htmlFor="track" className="label">Track</label>
        <select id="track" name="track" className="input" defaultValue={initial?.track ?? ""}>
          <option value="">Not decided yet</option>{TRACKS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="needs" className="label">Who you&apos;re looking for</label>
        <input id="needs" name="needs" maxLength={200} className="input" placeholder="e.g. A designer and someone with healthcare experience" defaultValue={initial?.needs ?? ""} />
        <p className="hint">Shown on the open teams page so students can ask to join.</p>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create team" : "Save changes"}</button>
        {state?.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
        {state?.ok && <span role="status" className="text-sm text-ok">{state.ok}</span>}
      </div>
    </form>
  );
}
