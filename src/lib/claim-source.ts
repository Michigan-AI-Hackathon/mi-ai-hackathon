"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

// After signing in, credit the account to the event QR code it came from (a cookie set when /join/<code> was opened).
export async function claimSignupSource(supabase: SupabaseClient) {
  const m = document.cookie.match(/(?:^|; )hk_src=([a-z0-9-]{3,40})/);
  if (!m) return;
  await supabase.rpc("claim_signup_source", { p_slug: m[1] }); // ignored if invalid, switched off, or the account is old
  document.cookie = "hk_src=; Max-Age=0; path=/";
}
