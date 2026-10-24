"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return setError("Enter a full email address, like you@school.edu.");
    setBusy(true);
    const { data: schools, error: lookupError } = await supabase.rpc("schools_for_email", { p_email: clean });
    if (lookupError) {
      console.error("School lookup failed:", lookupError); // shows the real cause in the browser console
      setBusy(false);
      return setError("We couldn't check your email right now. Try again in a minute.");
    }
    if (!schools?.length) {
      setBusy(false);
      return setError(`@${clean.split("@")[1]} isn't on our list of Michigan schools. Use your school email. If your school is missing, email aihackathonumich@gmail.com.`);
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (otpError) console.error("Sending code failed:", otpError);
    if (otpError) return setError(otpError.message.includes("rate") ? "Too many codes requested. Wait a minute and try again." : "We couldn't send the code. Try again in a minute.");
    setEmail(clean);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (verifyError) return setError("That code didn't work. Check the latest email we sent, or request a new code.");
    router.replace(next);
    router.refresh();
  }

  return step === "email" ? (
    <form onSubmit={sendCode} className="mt-8" noValidate>
      <label htmlFor="email" className="label">School email</label>
      <input id="email" type="email" autoComplete="email" required className="input" placeholder="you@school.edu"
        value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={error ? "err" : undefined} />
      {error && <p id="err" role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <button className="btn-primary mt-5 w-full py-3" disabled={busy}>{busy ? "Sending code…" : "Send me a code"}</button>
    </form>
  ) : (
    <form onSubmit={verify} className="mt-8">
      <p className="text-[15px]">We sent a code to <strong>{email}</strong>. It can take a minute to arrive.</p>
      <label htmlFor="code" className="label mt-5">6-digit code</label>
      <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="input text-center font-heading text-2xl tracking-[0.4em]"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <button className="btn-primary mt-5 w-full py-3" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
      <button type="button" className="btn mt-2 w-full text-muted hover:text-ink" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
        Use a different email
      </button>
    </form>
  );
}
