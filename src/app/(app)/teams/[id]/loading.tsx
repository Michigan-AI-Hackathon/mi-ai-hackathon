import { SkPage, Sk, SkCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <Sk className="h-4 w-24" />
      <div className="mt-6 space-y-3"><Sk className="h-10 w-2/3 max-w-md" /><Sk className="h-4 w-1/3" /></div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <SkCard key={i} />)}</div>
    </SkPage>
  );
}
