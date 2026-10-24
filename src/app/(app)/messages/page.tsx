import Link from "next/link";
import { requireStudent } from "@/lib/session";

type Conv = { conversation_id: string; kind: string; title: string | null; last_body: string | null; last_at: string | null; unread: number };

export default async function MessagesPage() {
  const { supabase } = await requireStudent();
  const { data } = await supabase.rpc("my_conversations");
  const convs = (data ?? []) as Conv[];
  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-4xl font-bold">Messages</h1>
      <p className="mt-2 text-[16px] text-muted">If you don&apos;t read a message within 15 minutes, we&apos;ll email you so you don&apos;t miss it.</p>
      {convs.length === 0 ? (
        <p className="panel mt-6 text-[15px]">No conversations yet. Message someone from <Link href="/people" className="font-medium text-primary hover:underline">Find teammates</Link>. Your team chat shows up here once you join a team.</p>
      ) : (
        <ul className="panel mt-6 divide-y divide-line p-0 sm:p-0">
          {convs.map((c) => (
            <li key={c.conversation_id}>
              <Link href={`/messages/${c.conversation_id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper">
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-heading text-lg ${c.unread ? "font-bold" : "font-semibold"}`}>
                    {c.kind === "team" ? `Team chat: ${c.title}` : c.title ?? "Student"}
                  </p>
                  <p className={`truncate text-[15px] ${c.unread ? "text-ink" : "text-muted"}`}>{c.last_body ?? "No messages yet"}</p>
                </div>
                {c.unread > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-sm font-semibold text-on-primary">{c.unread}<span className="sr-only"> unread</span></span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
