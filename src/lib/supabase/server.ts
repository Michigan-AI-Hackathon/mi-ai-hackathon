import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for server components, server actions and route handlers.
// Acts as the signed-in student, so row-level security applies.
export async function createClient() {
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
