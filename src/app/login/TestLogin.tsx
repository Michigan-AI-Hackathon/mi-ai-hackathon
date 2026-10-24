"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// TEST MODE ONLY: password sign-in with no email. Shown only when
// NEXT_PUBLIC_ENABLE_TEST_LOGIN=true in Vercel. Turn it off before launch.
// Michigan-only emails are still enforced by the database.
export default function TestLogin() {
  const supabase = createClient();
  const router = useRouter();
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
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="panel mt-10 border-dashed">
      <p className="text-sm font-semibold text-warn">Test mode: sign in with a password, no email</p>
      <label htmlFor="t-email" className="label mt-4">School email</label>
      <input id="t-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="t-pass" className="label mt-3">Password</label>
      <input id="t-pass" type="password" minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <p className="hint">New email? This creates the account with that password.</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <button className="btn-secondary mt-4 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in (test mode)"}</button>
    </form>
  );
}
