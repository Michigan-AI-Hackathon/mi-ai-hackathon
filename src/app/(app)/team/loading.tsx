import { SkPage, SkHeader, SkRows, SkCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <div className="grid gap-4 lg:grid-cols-3"><div className="lg:col-span-2"><SkCard lines={5} /></div><SkCard lines={3} /></div>
      <div className="mt-6"><SkRows count={4} /></div>
    </SkPage>
  );
}
