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

function Pill({ n }: { n: number }) {
  return <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{n}<span className="sr-only"> unread</span></span>;
}

// Two-pane inbox: conversation list on the left, the open thread on the right.
export default async function Inbox({ selected }: { selected: string | null }) {
  const { supabase, profile } = await requireStudent();
  const { data } = await supabase.rpc("my_conversations");
  const convs = (data ?? []) as Conv[];

  const ids = convs.map((c) => c.conversation_id);
  const { data: memberRows } = ids.length
    ? await supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", ids)
    : { data: [] as { conversation_id: string; user_id: string }[] };
  const membersOf = new Map<string, string[]>();
  for (const m of memberRows ?? []) membersOf.set(m.conversation_id, [...(membersOf.get(m.conversation_id) ?? []), m.user_id]);
  const personIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
  const { data: dir } = personIds.length
    ? await supabase.from("student_directory").select("id, full_name, school_name, study_area, looking_for_team, team_id, avatar_url").in("id", personIds)
    : { data: [] };
  const people = new Map(((dir ?? []) as Person[]).map((p) => [p.id, p]));
  const otherOf = (cid: string) => (membersOf.get(cid) ?? []).find((u) => u !== profile.id) ?? null;

  const team = convs.filter((c) => c.kind === "team");
  const system = convs.filter((c) => c.kind === "system");
  const direct = convs.filter((c) => c.kind === "direct");
  const pinned = [...team, ...system];

  const cur = selected ? convs.find((c) => c.conversation_id === selected) : null;
  if (selected && !cur) notFound();

  const row = (c: Conv) => {
    const oid = c.kind === "direct" ? otherOf(c.conversation_id) : null;
    const p = oid ? people.get(oid) : null;
    const name = c.kind === "system" ? "Organizers" : c.title ?? "Student";
    const active = c.conversation_id === selected;
    const avatar = c.kind === "system"
      ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-card">HQ</span>
      : <Avatar url={p?.avatar_url} name={name} size={40} />;
    return (
      <li key={c.conversation_id} className={`flex min-h-16 items-center gap-3 border-l-2 px-3 py-2.5 transition-colors ${active ? "border-accent bg-paper" : "border-transparent hover:bg-paper"}`}>
        {oid ? <Link href={`/people/${oid}`} aria-label={`View ${name}'s profile`} className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{avatar}</Link> : avatar}
        <Link href={`/messages/${c.conversation_id}`} aria-current={active ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className={`block truncate ${c.unread ? "font-bold" : "font-semibold"}`}>{name}</span>
            <span className={`block truncate text-sm ${c.unread ? "text-ink" : "text-muted"}`}>{(c.last_body ?? "").replace(/\s+/g, " ")}</span>
          </span>
          {c.unread > 0 && <Pill n={c.unread} />}
          <span aria-hidden className="text-lg text-muted lg:hidden">›</span>
        </Link>
      </li>
    );
  };

  // ---- thread pane
  let thread: React.ReactNode = null;
  if (cur) {
    const id = cur.conversation_id;
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

    thread = (
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

  if (convs.length === 0) {
    return <p className="max-w-md text-[15px] text-muted">No conversations. <Link href="/people" className="font-medium text-primary hover:underline">Find teammates</Link>.</p>;
  }

  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[26rem] lg:h-[calc(100dvh-12rem)] overflow-hidden rounded-lg border border-line bg-card lg:grid-cols-[minmax(18rem,1fr)_2fr]">
      <aside className={`${cur ? "hidden lg:block" : ""} overflow-y-auto border-line lg:border-r`}>
        {pinned.length > 0 && (<>
          <h2 className="sr-only">Pinned</h2>
          <ul className="mt-1">{pinned.map(row)}</ul>
        </>)}
        {direct.length > 0 && (<>
          <h2 className="sr-only">Direct</h2>
          <ul className="mt-1 pb-2">{direct.map(row)}</ul>
        </>)}
      </aside>
      <section className={`${cur ? "flex" : "hidden lg:flex"} min-h-0 flex-col`}>
        {thread}
      </section>
    </div>
  );
}
