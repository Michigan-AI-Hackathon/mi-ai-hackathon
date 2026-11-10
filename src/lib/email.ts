import "server-only";
import { Resend } from "resend";
import { EVENT } from "@/lib/config";

const FROM = process.env.EMAIL_FROM ?? `${EVENT.name} <onboarding@resend.dev>`;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function sendUnreadDigests(rows: { email: string; full_name: string | null; unread: number; conversations: number }[]) {
  if (!rows.length) return { sent: 0 };
  // No Resend key yet (prototype): skip emails instead of crashing.
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: "RESEND_API_KEY not set" };
  const resend = new Resend(process.env.RESEND_API_KEY);
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

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Mail = { to: string; subject: string; text: string; html: string };
async function sendBatch(mails: Mail[]) {
  if (!mails.length) return { sent: 0 };
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: "RESEND_API_KEY not set" };
  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (let i = 0; i < mails.length; i += 100) {
    const batch = mails.slice(i, i + 100).map((m) => ({ from: FROM, ...m }));
    const { error } = await resend.batch.send(batch);
    if (error) throw new Error(error.message);
    sent += batch.length;
  }
  return { sent };
}

// Organizer announcement. The body is plain text; it is escaped, never treated as HTML.
export async function sendBroadcast(recipients: { email: string; full_name: string | null }[], subject: string, body: string) {
  return sendBatch(recipients.map((r) => {
    const first = r.full_name?.split(" ")[0] ?? "there";
    return {
      to: r.email, subject,
      text: `Hi ${first},\n\n${body}\n\n${SITE}/dashboard`,
      html: `<p>Hi ${esc(first)},</p><div style="white-space:pre-wrap">${esc(body)}</div><p><a href="${SITE}/dashboard">Open your dashboard</a></p>`,
    };
  }));
}

export async function sendPlacementEmails(rows: { email: string; full_name: string | null; team: string; mates: string[] }[]) {
  return sendBatch(rows.map((r) => {
    const first = r.full_name?.split(" ")[0] ?? "there";
    const mates = r.mates.length ? r.mates.join(", ") : "your teammates";
    return {
      to: r.email, subject: `You're on a team: ${r.team}`,
      text: `Hi ${first},\n\nThe organizers placed you on team "${r.team}" with ${mates}.\nOpen your team chat: ${SITE}/team\n\nIf this doesn't work for you, reply to this email.`,
      html: `<p>Hi ${esc(first)},</p><p>The organizers placed you on team <strong>${esc(r.team)}</strong> with ${esc(mates)}.</p><p><a href="${SITE}/team">Open your team</a></p><p style="color:#5b5f68;font-size:13px">If this doesn't work for you, reply to this email.</p>`,
    };
  }));
}

// Floating help button. Goes to the shared inbox in HELP_INBOX_EMAIL; reply-to is the student.
export async function sendHelpRequest(r: { name: string; email: string; team: string | null; topic: string; message: string }) {
  const to = process.env.HELP_INBOX_EMAIL;
  if (!to) return { sent: 0, skipped: "HELP_INBOX_EMAIL not set" };
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: "RESEND_API_KEY not set" };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const who = `${r.name || "Unknown"} <${r.email}>`;
  const subject = `Help request${r.topic ? ` (${r.topic})` : ""} from ${r.name || r.email}`.slice(0, 150);
  const { error } = await resend.emails.send({
    from: FROM, to, replyTo: r.email, subject,
    text: `From: ${who}\nTeam: ${r.team ?? "none"}\nTopic: ${r.topic || "none"}\n\n${r.message}`,
    html: `<p><strong>From:</strong> ${esc(r.name || "Unknown")} &lt;${esc(r.email)}&gt;<br><strong>Team:</strong> ${esc(r.team ?? "none")}<br><strong>Topic:</strong> ${esc(r.topic || "none")}</p><div style="white-space:pre-wrap">${esc(r.message)}</div>`,
  });
  if (error) throw new Error(error.message);
  return { sent: 1 };
}
