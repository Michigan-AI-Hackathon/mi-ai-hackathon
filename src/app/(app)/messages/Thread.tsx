import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import { requireStudent } from "@/lib/session";
import Chat, { type Msg } from "./[id]/Chat";
import InviteButton from "./InviteButton";

type Conv = { conversation_id: string; kind: string; title: string | null; last_body: string | null; last_at: string | null; unread: number };
type Person = {
  id: string; full_name: string; school_name: string | null; study_area: string | null;
  looking_for_team: boolean; team_id: string | null; avatar_url: string | null;
};

const TEAM_SIZE = 4;

// Thread pane only; the conversation list lives in layout.tsx so it persists between chats.
export default async function Thread({ id }: { id: string }) {
  const { supabase, profile } = await requireStudent();
  const { data } = await supabase.rpc("my_conversations");
  const convs = (data ?? []) as Conv[];
  const cur = convs.find((c) => c.conversation_id === id);
  if (!cur) notFound();

  const { data: memberRows } = await supabase.from("conversation_members").select("conversation_id, user_id").eq("conversation_id", id);
  const membersOf = new Map<string, string[]>([[id, (memberRows ?? []).map((m) => m.user_id)]]);
  const personIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
  const { data: dir } = personIds.length
    ? await supabase.from("student_directory").select("id, full_name, school_name, study_area, looking_for_team, team_id, avatar_url").in("id", personIds)
    : { data: [] };
  const people = new Map(((dir ?? []) as Person[]).map((p) => [p.id, p]));
  const otherOf = (cid: string) => (membersOf.get(cid) ?? []).find((u) => u !== profile.id) ?? null;

  const isSystem = cur.kind === "system";
  const { data: msgs } = await supabase.from("messages").select("id, sender_id, body, created_at")
    .eq("conversation_id", id).order("created_at", { ascending: false }).limit(200);
  await supabase.rpc("mark_read", { p_conversation: id });
  const memberIds = membersOf.get(id) ?? [];
  const names: Record<string, string> = {};
  for (const m of memberIds) names[m] = people.get(m)?.full_name ?? "Student";
  names[profile.id] = "You";
  if (isSystem) for (const m of msgs ?? []) names[m.sender_id] = "Organizers";

  const oid = cur.kind === "direct" ? otherOf(id) : null;
  const o = oid ? people.get(oid) : null;
  const name = isSystem ? "Organizers" : cur.title ?? "Student";

  let canInvite = false;
  if (o && !o.team_id) {
    const { data: mine } = await supabase.from("team_members").select("team_id, teams(locked_at)").eq("user_id", profile.id).maybeSingle();
    if (mine?.team_id && !(mine.teams as unknown as { locked_at: string | null } | null)?.locked_at) {
      const { count } = await supabase.from("team_members").select("user_id", { count: "exact", head: true }).eq("team_id", mine.team_id);
      canInvite = (count ?? 0) < TEAM_SIZE;
    }
  }
  const sub = o ? [o.school_name, o.study_area, o.team_id ? "On a team" : o.looking_for_team ? "Looking for a team" : null].filter(Boolean).join(" · ") : "";
  const teamMates = cur.kind === "team" ? memberIds.filter((m) => m !== profile.id).map((m) => people.get(m)).filter((p): p is Person => !!p) : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/messages" className="btn-secondary shrink-0 lg:hidden" aria-label="Back to conversations">&larr; Back</Link>
        {oid && o ? (
          <>
            <Link href={`/people/${oid}`} className="group flex min-w-0 flex-1 items-center gap-3" aria-label={`View ${name}'s profile`}>
              <span className="transition-opacity group-hover:opacity-80"><Avatar url={o.avatar_url} name={name} size={44} /></span>
              <span className="min-w-0">
                <span className="block truncate font-heading text-lg font-bold group-hover:text-primary group-hover:underline">{name}</span>
                {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
              </span>
            </Link>
            <div className="flex flex-wrap items-start gap-2">
              <Link href={`/people/${oid}`} className="btn-secondary">View profile</Link>
              {canInvite && <InviteButton studentId={oid} />}
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-lg font-bold">{name}</p>
            {teamMates.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {teamMates.map((p) => (
                  <li key={p.id}>
                    <Link href={`/people/${p.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full pr-2 text-sm text-primary hover:bg-paper hover:underline">
                      <Avatar url={p.avatar_url} name={p.full_name} size={24} />{p.full_name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <Chat key={id} conversationId={id} me={profile.id} names={names} initial={((msgs ?? []) as Msg[]).reverse()}
        readOnly={isSystem} locked={!isSystem && !profile.paid_at} fallbackName={isSystem ? "Organizers" : "Student"} />
    </>
  );
}
