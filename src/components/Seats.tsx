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
