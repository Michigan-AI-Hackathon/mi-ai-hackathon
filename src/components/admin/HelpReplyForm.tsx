"use client";
import { useActionState } from "react";
import { adminReplyHelp, adminResolveHelp } from "@/app/admin/help/actions";
import type { ActionResult } from "@/app/actions";

export default function HelpReplyForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState<ActionResult, FormData>(adminReplyHelp, null);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`rp-${id}`} className="sr-only">Reply</label>
      <textarea id={`rp-${id}`} name="reply" required minLength={2} maxLength={1800} rows={3} className="input" placeholder="Reply. It shows up in their Messages." />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary min-h-11" disabled={pending}>{pending ? "Sending…" : "Send reply"}</button>
        <button type="button" className="btn-secondary min-h-11" onClick={() => adminResolveHelp(id)}>Mark done</button>
        {s?.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
        {s?.ok && <p role="status" className="text-sm text-ok">{s.ok}</p>}
      </div>
    </form>
  );
}
