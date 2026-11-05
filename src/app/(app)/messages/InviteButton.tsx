"use client";
import ActionButton from "@/components/ActionButton";
import { sendInvite } from "@/app/actions";

export default function InviteButton({ studentId }: { studentId: string }) {
  return <ActionButton action={() => sendInvite(studentId)}>Invite</ActionButton>;
}
