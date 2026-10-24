import "server-only";
import { Resend } from "resend";
import { EVENT } from "@/lib/config";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? `${EVENT.name} <onboarding@resend.dev>`;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function sendUnreadDigests(rows: { email: string; full_name: string | null; unread: number; conversations: number }[]) {
  if (!rows.length) return { sent: 0 };
  // Resend batch: up to 100 emails per call
  let sent = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map((r) => {
      const first = r.full_name?.split(" ")[0] ?? "there";
      const what = r.unread === 1 ? "1 unread message" : `${r.unread} unread messages`;
      return {
        from: FROM,
        to: r.email,
        subject: `You have ${what} on ${EVENT.name}`,
        text: `Hi ${first},\n\nYou have ${what} from possible teammates. Read and reply here:\n${SITE}/messages\n\nYou're getting this because a message sat unread for 15 minutes.`,
        html: `<p>Hi ${first},</p><p>You have <strong>${what}</strong> from possible teammates.</p><p><a href="${SITE}/messages">Read and reply</a></p><p style="color:#5a5e7a;font-size:13px">You're getting this because a message sat unread for 15 minutes.</p>`,
      };
    });
    const { error } = await resend.batch.send(batch);
    if (error) throw new Error(error.message);
    sent += batch.length;
  }
  return { sent };
}
