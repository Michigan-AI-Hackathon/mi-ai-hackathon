import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-heading text-[17px] font-bold tracking-tight text-ink">
      {/* four squares = a team of four */}
      <span aria-hidden className="grid grid-cols-2 gap-[3px]">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
        <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" />
      </span>
      Michigan AI Hackathon
    </Link>
  );
}
