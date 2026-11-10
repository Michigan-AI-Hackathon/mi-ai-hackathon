import PageHeader from "@/components/PageHeader";
import HelpReplyForm from "@/components/admin/HelpReplyForm";
import { requireAdmin } from "@/lib/admin";

type Row = {
  id: string; topic: string | null; message: string; created_at: string; reply: string | null; replied_at: string | null;
  profiles: { full_name: string | null; email: string } | null;
};

export default async function HelpInbox() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("help_requests")
    .select("id, topic, message, created_at, reply, replied_at, profiles!help_requests_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as Row[];
  const open = rows.filter((r) => !r.replied_at);
  const done = rows.filter((r) => r.replied_at);
  const when = (d: string) => new Date(d).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div>
      <PageHeader eyebrow="Help" title="Help requests">Questions from the ? button. Your reply goes to the student&apos;s Messages.</PageHeader>
      <h2 className="font-heading text-xl font-semibold">Needs a reply ({open.length})</h2>
      <div className="mt-3 space-y-4">
        {open.length === 0 && <p className="text-muted">Nothing waiting.</p>}
        {open.map((r) => (
          <div key={r.id} className="panel">
            <p className="text-sm text-muted">{r.profiles?.full_name ?? "Student"} · {r.profiles?.email} · {when(r.created_at)}{r.topic ? ` · ${r.topic}` : ""}</p>
            <p className="mt-2 whitespace-pre-wrap text-[16px]">{r.message}</p>
            <HelpReplyForm id={r.id} />
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <>
          <h2 className="mt-10 font-heading text-xl font-semibold">Answered</h2>
          <div className="mt-3 space-y-3">
            {done.map((r) => (
              <div key={r.id} className="panel">
                <p className="text-sm text-muted">{r.profiles?.full_name ?? "Student"} · {when(r.created_at)}{r.topic ? ` · ${r.topic}` : ""}</p>
                <p className="mt-1 whitespace-pre-wrap">{r.message}</p>
                {r.reply && <p className="mt-2 border-l-2 border-line pl-3 text-muted">{r.reply}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
