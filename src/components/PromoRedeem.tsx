"use client";
import { useActionState } from "react";
import { redeemPromo, type ActionResult } from "@/app/actions";

// "Have a code?" for people given a free-registration code by the organizers.
export default function PromoRedeem() {
  const [s, action, pending] = useActionState<ActionResult, FormData>(redeemPromo, null);
  return (
    <details className="mt-5 text-[15px]" open={!!s?.error}>
      <summary className="w-fit cursor-pointer text-muted underline-offset-4 hover:text-ink hover:underline">Have a code?</summary>
      <form action={action} className="mt-3 flex flex-wrap items-start gap-2">
        <div>
          <label htmlFor="promo" className="sr-only">Registration code</label>
          <input id="promo" name="code" required minLength={4} maxLength={24} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="input w-48 font-mono uppercase tracking-wider" placeholder="Enter code" />
        </div>
        <button className="btn-secondary" disabled={pending}>{pending ? "Checking…" : "Apply code"}</button>
        {s?.error && <p role="alert" className="basis-full text-sm text-danger">{s.error}</p>}
      </form>
    </details>
  );
}
