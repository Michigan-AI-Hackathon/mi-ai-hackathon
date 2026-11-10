"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitHelp } from "@/app/points-actions";
import type { ActionResult } from "@/app/actions";

const TOPICS = ["", "Payment", "Check-in", "My team", "Rules", "Something is broken", "Other"];

// Floating "?" button, bottom-right, above the phone tab bar. Opens a small form that goes to the organizers.
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(submitHelp, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) formRef.current?.reset(); }, [state]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <div className="pointer-events-none fixed right-4 z-50 flex flex-col items-end bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 print:hidden">
      {open && (
        <form ref={formRef} action={action} role="dialog" aria-label="Ask for help"
          className="panel pointer-events-auto mb-3 w-[min(22rem,calc(100vw-2rem))] space-y-3 shadow-xl">
          <div className="flex items-center justify-between"><p className="font-heading text-lg font-semibold">Need help?</p>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 min-w-11 text-muted hover:text-ink" aria-label="Close"><svg viewBox="0 0 20 20" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 4l12 12M16 4L4 16" /></svg></button></div>
          <div><label htmlFor="help-topic" className="label">Topic (optional)</label>
            <select id="help-topic" name="topic" className="input">{TOPICS.map((t) => <option key={t} value={t}>{t || "Pick one"}</option>)}</select></div>
          <div><label htmlFor="help-msg" className="label">Message</label>
            <textarea id="help-msg" name="message" required minLength={3} maxLength={2000} rows={4} className="input" placeholder="What do you need?" /></div>
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send to organizers"}</button>
          {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          {state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
        </form>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Help"
        className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full bg-ink font-heading text-xl font-bold text-card shadow-lg transition-transform hover:scale-105 active:scale-95"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 9a3 3 0 115 2c-1 .8-2 1.2-2 2.5M12 17.5v.01" /></svg></button>
    </div>
  );
}
