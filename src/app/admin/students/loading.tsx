import { SkPage, SkHeader, SkRows, SkStats } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkStats />
      <SkRows count={10} />
    </SkPage>
  );
}
