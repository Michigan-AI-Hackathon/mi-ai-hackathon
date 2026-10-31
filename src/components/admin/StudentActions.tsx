"use client";
import { useState } from "react";
import ActionButton from "@/components/ActionButton";
import { adminAddToTeam, adminCheckIn, adminComp, adminRemoveFromTeam } from "@/app/admin/actions";

export type TeamOption = { id: string; name: string; open: number };

// One student's organizer buttons. Each calls a server action, which calls a logged database function.
export default function StudentActions({ id, paid, checkedIn, teamId, teams }: { id: string; paid: boolean; checkedIn: boolean; teamId: string | null; teams: TeamOption[] }) {
  const [target, setTarget] = useState("");
  const [force, setForce] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionButton variant="secondary" action={() => adminCheckIn(id, !checkedIn)}>{checkedIn ? "Undo check-in" : "Check in"}</ActionButton>
      {!paid && <ActionButton variant="secondary" confirm="Mark this student as paid without a Stripe charge? This is logged." action={() => adminComp(id, "marked paid by organizer")}>Mark paid</ActionButton>}
      {teamId && <ActionButton variant="danger" confirm="Remove this student from their team?" action={() => adminRemoveFromTeam(id)}>Remove from team</ActionButton>}
      <span className="inline-flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`mv-${id}`}>Move to team</label>
        <select id={`mv-${id}`} className="input w-auto py-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{teamId ? "Move to…" : "Add to team…"}</option>
          {teams.filter((t) => t.id !== teamId).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.open} open)</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-primary" />Ignore school rules</label>
        {target && <ActionButton action={() => adminAddToTeam(id, target, force)}>Place</ActionButton>}
      </span>
    </div>
  );
}
