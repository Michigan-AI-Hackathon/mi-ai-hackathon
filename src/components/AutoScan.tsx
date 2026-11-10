"use client";
import { useEffect, useRef, useState } from "react";
import { scanPoints, type ScanResult } from "@/app/points-actions";
import { StatusScreen } from "@/components/AutoCheckIn";

// Runs the scan the moment the page opens (as a POST, so a link alone never awards anything). The database decides.
export default function AutoScan({ token }: { token: string }) {
  const [r, setR] = useState<ScanResult | "working">("working");
  const ran = useRef(false);
  const run = async () => { setR("working"); setR(await scanPoints(token)); };
  useEffect(() => { if (!ran.current) { ran.current = true; run(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (r === "working" || !r) return <div className="grid place-items-center py-16"><span className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-ink" role="status" aria-label="Adding your points" /></div>;
  if (r.error) return <StatusScreen tone="bad" title="No points this time" text={r.error} cta="Try again" onClick={run} />;
  if (r.awarded) return <StatusScreen tone="ok" title={`+${r.points} points`} text={`${r.name}. You now have ${r.balance} points.`} href="/points" cta="See my points" />;
  return <StatusScreen tone="info" title="Already counted" text={`You already got the points for ${r.name}. You have ${r.balance} points.`} href="/points" cta="See my points" />;
}
