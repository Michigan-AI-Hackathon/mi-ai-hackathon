import { NextResponse, type NextRequest } from "next/server";

// DEV ONLY: start the clickable preview. /dev/preview?as=unpaid|solo|team
export function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return new NextResponse("Not found", { status: 404 });
  const as = req.nextUrl.searchParams.get("as") ?? "team";
  const next = req.nextUrl.searchParams.get("next") ?? "/dashboard";
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/dashboard", req.url));
  res.cookies.set("dev_preview", ["new", "unpaid", "solo", "team"].includes(as) ? as : "team", { path: "/" });
  return res;
}
