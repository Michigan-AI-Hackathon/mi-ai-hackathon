import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { judgeLabel, tabulate, type JudgingData } from "@/lib/judging";

// A spreadsheet can run =formulas pasted into a comment. Prefix anything that looks like one.
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const { supabase } = await requireAdmin();
  const track = new URL(req.url).searchParams.get("track") ?? undefined;
  const { data, error } = await supabase.rpc("admin_judging_data");
  if (error || !data) return new NextResponse("Could not load results.", { status: 500 });
  const d = data as JudgingData;
  const crit = d.criteria.filter((c) => c.active);
  const rows = tabulate(d, track || undefined);
  const head = ["Rank", "Team #", "Team", "Track", "Judge", "Company", ...crit.map((c) => `${c.name} (/${c.max_score})`), "Judge total", "Complete", "Team average", "Comment"];
  const lines = [head.map(cell).join(",")];
  for (const r of rows) {
    const base = [r.rank, r.team.number, r.team.name, r.team.track];
    if (r.perJudge.length === 0) lines.push([...base, "", "", ...crit.map(() => ""), "", "", "", ""].map(cell).join(","));
    for (const p of r.perJudge)
      lines.push([...base, judgeLabel(p.judge), p.judge.org, ...crit.map((c) => p.byCriterion[c.id]), p.total, p.complete ? "yes" : "no", r.average != null ? Math.round(r.average * 100) / 100 : "", p.comment].map(cell).join(","));
  }
  await supabase.rpc("admin_log_event", { p_action: "export_judging", p_details: { track: track ?? "all", rows: rows.length } });
  return new NextResponse(lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="judging-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
