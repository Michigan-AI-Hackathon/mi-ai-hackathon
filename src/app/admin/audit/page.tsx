import PageHeader from "@/components/PageHeader";
import { requireAdmin } from "@/lib/admin";

type Entry = { id: number; action: string; details: Record<string, unknown>; created_at: string; profiles: { full_name: string | null; email: string } | null };

export default async function AuditPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("audit_log").select("id, action, details, created_at, profiles(full_name, email)").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as Entry[];
  return (
    <div>
      <PageHeader eyebrow="Audit log" title="Everything organizers have done">The newest 200 actions. Entries can&apos;t be edited or deleted from the site.</PageHeader>
      <div className="panel overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="border-b border-line text-muted"><tr><th className="sticky left-0 bg-card px-3 py-3 font-medium sm:px-5">When</th><th className="px-5 py-3 font-medium">Who</th><th className="px-5 py-3 font-medium">Action</th><th className="px-5 py-3 font-medium">Details</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="sticky left-0 whitespace-nowrap bg-card px-3 py-3 text-muted sm:px-5">{new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td className="px-5 py-3">{r.profiles?.full_name ?? r.profiles?.email ?? "Unknown"}</td>
                <td className="px-5 py-3 font-medium">{r.action.replace(/_/g, " ")}</td>
                <td className="max-w-md px-5 py-3 font-mono text-[12px] text-muted"><span className="line-clamp-2 break-all">{JSON.stringify(r.details)}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
