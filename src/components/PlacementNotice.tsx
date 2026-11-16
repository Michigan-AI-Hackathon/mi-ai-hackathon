"use client";
import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import { setPlacementPref } from "@/app/actions";

// Shown to students who asked organizers to put them on a team. They can still pick a team right now.
export default function PlacementNotice() {
  return (
    <div className="rounded-xl border border-line bg-card p-4 text-[15px]" role="status">
      <p className="font-semibold">You&apos;re signed up for automated team matching.</p>
      <p className="mt-1 text-muted">If you&apos;re still without a team when matching runs, we&apos;ll put you on one in your tracks. You can still look around and join a team yourself any time.</p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <Link href="/teams" className="btn-primary">Browse teams</Link>
        <Link href="/people" className="btn-secondary">Find teammates</Link>
        <ActionButton action={() => setPlacementPref("own_team")} variant="secondary">Turn off automated matching</ActionButton>
      </div>
    </div>
  );
}
