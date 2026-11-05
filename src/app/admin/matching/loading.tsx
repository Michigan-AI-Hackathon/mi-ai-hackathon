import { SkPage, SkHeader, SkStats, SkRows } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkStats count={4} />
      <SkRows count={6} />
    </SkPage>
  );
}
