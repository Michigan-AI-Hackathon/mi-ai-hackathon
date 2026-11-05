// Reusable loading skeleton primitives (server-safe, no JS).
export function Sk({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`sk ${className}`} />;
}

export function SkHeader() {
  return (
    <div className="mb-8 space-y-3">
      <Sk className="h-3 w-24" />
      <Sk className="h-9 w-2/3 max-w-md" />
      <Sk className="h-4 w-1/2 max-w-sm" />
    </div>
  );
}

export function SkCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center gap-3">
        <Sk className="h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2"><Sk className="h-4 w-1/2" /><Sk className="h-3 w-1/3" /></div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => <Sk key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />)}
      </div>
    </div>
  );
}

export function SkGrid({ count = 6, cols = "sm:grid-cols-2 lg:grid-cols-3" }: { count?: number; cols?: string }) {
  return <div className={`grid gap-4 ${cols}`}>{Array.from({ length: count }).map((_, i) => <SkCard key={i} />)}</div>;
}

export function SkRows({ count = 8 }: { count?: number }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Sk className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Sk className="h-4 w-1/3" /><Sk className="h-3 w-1/2" /></div>
          <Sk className="hidden h-6 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function SkStats({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-card p-5"><Sk className="h-3 w-16" /><Sk className="mt-3 h-8 w-20" /></div>
      ))}
    </div>
  );
}

export function SkPage({ children }: { children: React.ReactNode }) {
  return <div role="status" aria-busy="true" aria-label="Loading">{children}</div>;
}
