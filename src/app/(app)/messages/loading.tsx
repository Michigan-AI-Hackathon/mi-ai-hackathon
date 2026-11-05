import { SkPage, SkHeader, SkRows } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkRows count={6} />
    </SkPage>
  );
}
