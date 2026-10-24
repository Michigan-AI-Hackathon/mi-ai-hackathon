import { NextResponse } from "next/server";
import { sendUnreadDigests } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

// Called every 10 minutes by Supabase pg_cron (see supabase/migrations/0003_cron.sql).
// 1. Expires old invites. 2. Emails students with messages unread for 15+ minutes (once per batch).
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: expired } = await db.rpc("expire_old_invites");
  const { data: rows, error } = await db.rpc("unread_message_digest", { p_minutes: 15 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const list = (rows ?? []) as { user_id: string; email: string; full_name: string | null; unread: number; conversations: number }[];
  try {
    const { sent } = await sendUnreadDigests(list);
    if (list.length) await db.rpc("mark_digest_sent", { p_users: list.map((r) => r.user_id) });
    return NextResponse.json({ expired, emailed: sent });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
