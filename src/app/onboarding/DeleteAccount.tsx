"use client";
import { useState } from "react";
import ActionButton from "@/components/ActionButton";
import { deleteAccount } from "@/app/actions";

// Leave the hackathon entirely. Sits at the bottom of the profile page, behind a typed confirmation.
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <section className="mt-12 max-w-xl border-t border-line pb-10 pt-8" aria-labelledby="delete-h">
      <h2 id="delete-h" className="font-heading text-xl font-semibold">Leave the hackathon</h2>
      <p className="mt-1 text-[15px] text-muted">Deletes your account and profile, takes you off your team and removes your messages and points. Your registration fee is non-refundable. This can&apos;t be undone.</p>
      {!open ? (
        <button type="button" className="btn-danger mt-4" onClick={() => setOpen(true)}>Delete my account</button>
      ) : (
        <div className="mt-4 space-y-3">
          <label htmlFor="confirm-delete" className="label">Type DELETE to confirm</label>
          <input id="confirm-delete" className="input max-w-xs" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          <div className="flex flex-wrap items-start gap-3">
            <ActionButton action={() => deleteAccount(text)} variant="danger">Delete my account for good</ActionButton>
            <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setText(""); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
