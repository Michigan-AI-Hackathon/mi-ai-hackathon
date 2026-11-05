import { SkPage, SkHeader, SkGrid, Sk } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <Sk className="mb-6 h-11 w-full max-w-md" />
      <SkGrid count={9} />
    </SkPage>
  );
}
