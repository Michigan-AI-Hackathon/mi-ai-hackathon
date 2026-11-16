"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";
import { claimSignupSource } from "@/lib/claim-source";

// TEST MODE ONLY: password sign-in with no email. Shown only when
// NEXT_PUBLIC_ENABLE_TEST_LOGIN=true in Vercel. Turn it off before launch.
// Michigan-only emails are still enforced by the database.
//
// Optional "demo accounts" shortcuts for testers: shown only when NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true and
// NEXT_PUBLIC_DEMO_PASSWORD is set (the accounts come from scripts/seed-demo.mjs). Use on a staging project only.
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
const DEMO_ON = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true" && DEMO_PASSWORD.length >= 6;
const DEMO_ACCOUNTS = [
  { email: "organizer@umich.edu", label: "Organizer", note: "Admin dashboard, banners, matching" },
  { email: "solo.omar@umich.edu", label: "Paid, no team", note: "Signed up for automated matching" },
  { email: "unpaid.tia@umich.edu", label: "Not paid yet", note: "Sees the pay / claim step" },
  { email: "ns.ava@umich.edu", label: "Team leader (locked)", note: "Northstar, 4 of 4" },
  { email: "ns.ben@msu.edu", label: "Teammate (locked)", note: "Not the leader" },
  { email: "bh.ivy@msu.edu", label: "Leader, 3 of 4", note: "Blue Heron, can invite" },
  { email: "newstudent@umich.edu", label: "Brand-new student", note: "Goes through onboarding" },
];

export default function TestLogin() {
  const supabase = createClient();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next")) ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const clean = email.trim().toLowerCase();
    let { error: err } = await supabase.auth.signInWithPassword({ email: clean, password });
    if (err && err.message.toLowerCase().includes("invalid")) {
      // No account yet: create one (no confirmation email when "Confirm email" is off in Supabase)
      const { data, error: signUpError } = await supabase.auth.signUp({ email: clean, password });
      err = signUpError ?? (data.session ? null : { message: "Account exists or needs confirming. Check the password, or turn off \"Confirm email\" in Supabase." } as typeof err);
      if (signUpError?.message.includes("Database error")) err = { message: "Only Michigan college and university emails can sign up." } as typeof err;
    }
    setBusy(false);
    if (err) return setError(err.message);
    await claimSignupSource(supabase);
    router.replace(next);
    router.refresh();
  }

  return (<>
    {DEMO_ON && (
      <div className="mt-8 rounded-xl border border-line bg-card p-4">
        <p className="text-sm font-semibold">Test accounts</p>
        <p className="mt-0.5 text-[13px] text-muted">Tap one to fill the form, then sign in. For testing only.</p>
        <ul className="mt-3 grid gap-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button type="button" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError(null); }}
                className={`flex w-full items-baseline justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-ink ${email === a.email ? "border-ink bg-ink/5" : "border-line"}`}>
                <span className="font-medium">{a.label}</span><span className="truncate text-[12px] text-muted">{a.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}
    <form onSubmit={submit} className="mt-8">
      <label htmlFor="t-email" className="label">School email</label>
      <input id="t-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="t-pass" className="label mt-3">Password</label>
      <input id="t-pass" type="password" minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <button className="btn-primary mt-5 w-full py-3" disabled={busy}>{busy ? "Signing in…" : "Sign in or create account"}</button>
    </form>
  </>);
}
