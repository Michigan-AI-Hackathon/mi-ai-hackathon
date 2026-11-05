import { SkPage, SkHeader, SkStats, SkCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkStats />
      <div className="grid gap-4 lg:grid-cols-2"><SkCard lines={4} /><SkCard lines={4} /></div>
    </SkPage>
  );
}
