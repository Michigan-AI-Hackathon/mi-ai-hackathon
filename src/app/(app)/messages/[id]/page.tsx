import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/session";
import Chat, { type Msg } from "./Chat";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStudent();
  const { data: conv } = await supabase.from("conversations").select("id, kind, team_id, teams(name)").eq("id", id).maybeSingle();
  if (!conv) notFound(); // RLS: only members can see it
  const [{ data: memberRows }, { data: msgs }] = await Promise.all([
    supabase.from("conversation_members").select("user_id").eq("conversation_id", id),
    supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(200),
  ]);
  const memberIds = (memberRows ?? []).map((m) => m.user_id);
  const { data: people } = await supabase.from("student_directory").select("id, full_name").in("id", memberIds);
  const names: Record<string, string> = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]));
  names[profile.id] = "You";
  await supabase.rpc("mark_read", { p_conversation: id });

  const other = memberIds.find((m) => m !== profile.id);
  const title = conv.kind === "team"
    ? `Team chat: ${(conv.teams as unknown as { name: string } | null)?.name ?? ""}`
    : names[other ?? ""] ?? "Student";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/messages" className="text-sm font-medium text-primary hover:underline">All messages</Link>
      <h1 className="mt-3 font-heading text-3xl font-bold">
        {conv.kind === "direct" && other ? <Link href={`/people/${other}`} className="hover:text-primary">{title}</Link> : title}
      </h1>
      <Chat conversationId={id} me={profile.id} names={names} initial={((msgs ?? []) as Msg[]).reverse()} />
    </div>
  );
}
