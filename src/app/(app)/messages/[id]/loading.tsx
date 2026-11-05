import { SkPage, SkHeader, Sk } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <div className="space-y-3">
        {[60, 40, 70, 50].map((w, i) => <Sk key={i} className={`h-12 ${i % 2 ? "ml-auto" : ""}`} />)}
      </div>
    </SkPage>
  );
}
