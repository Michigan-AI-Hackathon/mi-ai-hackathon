import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const SLUG = /^[a-z0-9-]{3,40}$/;

export async function middleware(request: NextRequest) {
  const res = await updateSession(request);
  // Remember which event QR code brought someone here, so their account can be credited after they sign up.
  const fromPath = request.nextUrl.pathname.match(/^\/join\/([a-z0-9-]{3,40})\/?$/i)?.[1];
  const src = (fromPath ?? request.nextUrl.searchParams.get("src") ?? "").toLowerCase();
  if (SLUG.test(src)) res.cookies.set("hk_src", src, { path: "/", maxAge: 60 * 60 * 24 * 14, sameSite: "lax", secure: request.nextUrl.protocol === "https:" });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/stripe|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
