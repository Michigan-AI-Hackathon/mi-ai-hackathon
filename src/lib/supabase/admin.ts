import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses row-level security. ONLY for the Stripe
// webhook and the cron job. Never import this into a page or component.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
