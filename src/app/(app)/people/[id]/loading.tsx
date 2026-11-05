import { SkPage, SkHeader, SkCard } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <div className="max-w-2xl"><SkCard lines={6} /></div>
    </SkPage>
  );
}
