import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createMockClient, devScenario } from "@/lib/dev-preview";

// Supabase client for server components, server actions and route handlers.
// Acts as the signed-in student, so row-level security applies.
export async function createClient(): Promise<SupabaseClient> {
  const scenario = await devScenario(); // dev preview only (null in production)
  if (scenario) return createMockClient(scenario) as unknown as SupabaseClient;
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a server component: middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
