import Link from "next/link";
import { requireStudent } from "@/lib/session";
import ConvList, { type Row } from "./ConvList";

type Conv = { conversation_id: string; kind: string; title: string | null; last_body: string | null; unread: number };

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStudent();
  const { data } = await supabase.rpc("my_conversations");
  const convs = (data ?? []) as Conv[];
  if (convs.length === 0) {
    return <p className="max-w-md text-[15px] text-muted">No conversations. <Link href="/people" className="font-medium text-primary hover:underline">Find teammates</Link>.</p>;
  }

  const direct = convs.filter((c) => c.kind === "direct").map((c) => c.conversation_id);
  const { data: memberRows } = direct.length
    ? await supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", direct)
    : { data: [] as { conversation_id: string; user_id: string }[] };
  const otherOf = new Map<string, string>();
  for (const m of memberRows ?? []) if (m.user_id !== profile.id) otherOf.set(m.conversation_id, m.user_id);
  const ids = [...new Set(otherOf.values())];
  const { data: dir } = ids.length ? await supabase.from("student_directory").select("id, avatar_url").in("id", ids) : { data: [] };
  const avatars = new Map((dir ?? []).map((p: { id: string; avatar_url: string | null }) => [p.id, p.avatar_url]));

  const order = (k: string) => (k === "team" ? 0 : k === "system" ? 1 : 2);
  const rows: Row[] = [...convs].sort((a, b) => order(a.kind) - order(b.kind)).map((c) => {
    const oid = otherOf.get(c.conversation_id) ?? null;
    return {
      id: c.conversation_id, kind: c.kind, oid, unread: c.unread,
      name: c.kind === "system" ? "Organizers" : c.title ?? "Student",
      last: (c.last_body ?? "").replace(/\s+/g, " "),
      avatar: oid ? avatars.get(oid) ?? null : null,
    };
  });
  return <ConvList rows={rows}>{children}</ConvList>;
}
