import Link from "next/link";
import Avatar from "@/components/Avatar";

// Four pips: filled = a person is on the team.
export function SeatPips({ filled, total = 4 }: { filled: number; total?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`${filled} of ${total} spots filled`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2.5 w-6 rounded-full transition-colors ${i < filled ? "bg-accent" : "bg-line"}`} />
      ))}
    </span>
  );
}

export function AvatarStack({ people, size = 32 }: { people: { id: string; full_name: string; avatar_url?: string | null }[]; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {people.map((p) => <span key={p.id} className="rounded-full ring-2 ring-card" title={p.full_name}><Avatar url={p.avatar_url} name={p.full_name} size={size} /></span>)}
    </span>
  );
}

// Overlapping member avatars (each links to the profile) plus dashed placeholders for open seats.
// Render inside a `relative` card whose title link stretches over it; these links sit above that layer.
export function TeamAvatars({ people, total = 4, size = 40 }: { people: { id: string; full_name: string; avatar_url?: string | null }[]; total?: number; size?: number }) {
  const empty = Math.max(0, total - people.length);
  return (
    <span className="relative z-10 flex -space-x-2">
      {people.map((p) => (
        <Link key={p.id} href={`/people/${p.id}`} title={p.full_name} aria-label={p.full_name}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-transform hover:z-10 hover:scale-110 active:scale-95">
          <span className="rounded-full ring-2 ring-card"><Avatar url={p.avatar_url} name={p.full_name} size={size} /></span>
        </Link>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span key={i} aria-hidden style={{ width: size, height: size }} className="my-auto inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-line bg-card text-muted ring-2 ring-card">+</span>
      ))}
    </span>
  );
}
