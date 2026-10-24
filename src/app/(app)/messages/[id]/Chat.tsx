"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Msg = { id: number; sender_id: string; body: string; created_at: string };

export default function Chat({ conversationId, me, names, initial }: { conversationId: string; me: string; names: Record<string, string>; initial: Msg[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const add = (m: Msg) => setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

  useEffect(() => {
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => { add(payload.new as Msg); supabase.rpc("mark_read", { p_conversation: conversationId }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, conversationId]);

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
    <div className="mt-6 flex flex-col">
      <div className="panel h-[55vh] overflow-y-auto" aria-live="polite" aria-label="Messages">
        {msgs.length === 0 && <p className="text-[15px] text-muted">No messages yet. Say hi and mention what you&apos;d like to build.</p>}
        <ul className="space-y-4">
          {msgs.map((m) => {
            const mine = m.sender_id === me;
            return (
              <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="mb-1 text-xs text-muted">{names[m.sender_id] ?? "Student"}, {fmt(m.created_at)}</span>
                <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${mine ? "bg-primary text-on-primary" : "bg-paper text-ink ring-1 ring-line"}`}>{m.body}</p>
              </li>
            );
          })}
        </ul>
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <label htmlFor="msg" className="sr-only">Message</label>
        <textarea id="msg" rows={2} maxLength={2000} className="input resize-none" placeholder="Write a message"
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
        <button className="btn-primary self-end" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <p className="hint">Enter sends. Shift + Enter adds a new line.</p>
    </div>
  );
}
