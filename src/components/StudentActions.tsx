"use client";
import ActionButton from "@/components/ActionButton";
import { messageStudent, requestToJoin, sendInvite } from "@/app/actions";

// Buttons shown on a student: invite them, ask to join their team, or message them.
export default function StudentActions({ studentId, theirTeamId, myTeamId, myTeamLocked, canAct }: {
  studentId: string; theirTeamId: string | null; myTeamId: string | null; myTeamLocked: boolean; canAct: boolean;
}) {
  if (!canAct) return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {myTeamId && !myTeamLocked && !theirTeamId && (
        <ActionButton action={() => sendInvite(studentId)}>Invite to my team</ActionButton>
      )}
      {!myTeamId && theirTeamId && (
        <ActionButton action={() => requestToJoin(theirTeamId)} variant="secondary">Ask to join their team</ActionButton>
      )}
      <ActionButton action={() => messageStudent(studentId)} variant="secondary">Message</ActionButton>
    </div>
  );
}
