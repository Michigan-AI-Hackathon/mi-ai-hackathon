import { SkPage, SkHeader, SkRows } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkRows count={8} />
    </SkPage>
  );
}
