import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 font-heading text-[18px] font-bold tracking-tight text-ink">
      {/* four squares = a team of four; they scatter and snap back on hover */}
      <span aria-hidden className="grid grid-cols-2 gap-[3px] transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:rotate-90">
        <span className="h-3 w-3 rounded-[3px] bg-ink" />
        <span className="h-3 w-3 rounded-[3px] bg-ink transition-transform duration-300 group-hover:translate-x-[2px]" />
        <span className="h-3 w-3 rounded-[3px] bg-ink transition-transform duration-300 group-hover:translate-y-[2px]" />
        <span className="h-3 w-3 rounded-[3px] bg-accent" />
      </span>
      Michigan AI Hackathon
    </Link>
  );
}
