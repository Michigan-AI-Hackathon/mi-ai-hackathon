"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type Msg = { id: number; sender_id: string; body: string; created_at: string };

export default function Chat({ conversationId, me, names, initial, readOnly = false, locked = false, fallbackName = "Student" }: { conversationId: string; me: string; names: Record<string, string>; initial: Msg[]; readOnly?: boolean; locked?: boolean; fallbackName?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const add = (m: Msg) => setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  // Opening a conversation marks it read. Tell the nav so its badge clears right away.
  const markRead = useCallback(
    () => supabase.rpc("mark_read", { p_conversation: conversationId }).then(() => window.dispatchEvent(new Event("unread-changed"))),
    [supabase, conversationId],
  );
  useEffect(() => { markRead(); }, [markRead]);

  useEffect(() => {
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => { add(payload.new as Msg); markRead(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, conversationId, markRead]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const { data, error: err } = await supabase.from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body }).select("id, sender_id, body, created_at").single();
    setSending(false);
    if (err) return setError("Your message didn't send. Check your connection and try again.");
    add(data as Msg);
    setDraft("");
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4" aria-live="polite" aria-label="Messages">
        <ul className="space-y-2">
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            return (
              <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && <span className="mb-0.5 text-xs text-muted">{names[m.sender_id] ?? fallbackName}</span>}
                <p title={fmt(m.created_at)} className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] ${mine ? "rounded-br-md bg-ink text-card" : "rounded-bl-md bg-paper text-ink ring-1 ring-line"}`}>{m.body}</p>
              </li>
            );
          })}
        </ul>
        <div ref={bottom} />
      </div>
      <div className="border-t border-line p-3">
        {readOnly ? <p className="text-sm text-muted">Announcement</p>
          : locked ? <Link href="/dashboard" className="btn-primary">Pay to message</Link>
          : <form onSubmit={send} className="flex gap-2">
            <label htmlFor="msg" className="sr-only">Message</label>
            <input id="msg" maxLength={2000} className="input" placeholder="Write a message…" autoComplete="off"
              value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn-primary" disabled={sending || !draft.trim()}>Send</button>
          </form>}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
