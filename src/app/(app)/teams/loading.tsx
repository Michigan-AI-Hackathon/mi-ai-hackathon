import { SkPage, SkHeader, SkGrid } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkGrid count={6} />
    </SkPage>
  );
}
