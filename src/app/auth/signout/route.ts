import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { devScenario } from "@/lib/dev-preview";

export async function POST(request: NextRequest) {
  // In the dev preview there is no real session; signing out just leaves the preview.
  if (await devScenario()) return NextResponse.redirect(new URL("/dev/exit", request.url), { status: 303 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
