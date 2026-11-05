import { Sk } from "@/components/Skeleton";

// Thread pane only; the conversation list stays on screen.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="space-y-3 p-4">
      <Sk className="h-12 w-1/2" />
      {[0, 1, 2, 3].map((i) => <Sk key={i} className={`h-12 w-2/3 ${i % 2 ? "ml-auto" : ""}`} />)}
    </div>
  );
}
