"use client";
import { useActionState } from "react";
import { adminCreateEvent } from "@/app/admin/actions";
import type { ActionResult } from "@/app/actions";

export default function NewEventForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(adminCreateEvent, null);
  return (
    <form action={action} className="panel flex flex-wrap items-end gap-4">
      <div className="min-w-64 flex-1"><label htmlFor="ev-name" className="label">Event name</label><input id="ev-name" name="name" required minLength={2} maxLength={80} className="input" placeholder="e.g. Ross Welcome Week table" /></div>
      <div><label htmlFor="ev-date" className="label">Date (optional)</label><input id="ev-date" name="date" type="date" className="input" /></div>
      <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create QR code"}</button>
      {state?.error && <p role="alert" className="w-full text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="w-full text-sm text-ok">{state.ok}</p>}
    </form>
  );
}
