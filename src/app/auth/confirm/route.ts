import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the link in the sign-in email, for students who click it instead of typing the code.
// Supports both link styles Supabase can send: ?code=... and ?token_hash=...&type=...
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const nextParam = searchParams.get("next");
  // only plain same-site paths: "//evil.com" and "/\\evil.com" are treated as other sites by browsers
  const next = nextParam && /^\/(?![/\\])[\w\-./?=&%]*$/.test(nextParam) ? nextParam : "/dashboard";
  const supabase = await createClient();

  // credit a brand-new account to the event QR code it came from, then forget the cookie
  const done = async () => {
    const src = request.cookies.get("hk_src")?.value;
    if (src && /^[a-z0-9-]{3,40}$/.test(src)) await supabase.rpc("claim_signup_source", { p_slug: src });
    const res = NextResponse.redirect(`${origin}${next}`);
    res.cookies.delete("hk_src");
    return res;
  };

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return done();
    console.error("Sign-in link (code) failed:", error.message); // visible in Vercel > Logs
  }
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return done();
    console.error("Sign-in link (token) failed:", error.message);
  }
  if (!code && !token_hash) console.error("Sign-in link had no code:", request.url);
  // Link opened in a different browser, or expired.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
