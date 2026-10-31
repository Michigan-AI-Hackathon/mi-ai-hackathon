import { NextResponse } from "next/server";

export function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete("dev_preview");
  return res;
}
