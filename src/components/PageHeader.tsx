export default function PageHeader({ eyebrow, title, children, className = "" }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-8 ${className}`}>
      {eyebrow && <p className="eyebrow rise text-primary">{eyebrow}</p>}
      <h1 className="rise mt-2 font-heading text-4xl font-bold sm:text-5xl" style={{ "--i": 1 } as React.CSSProperties}>{title}</h1>
      {children && <p className="rise mt-3 max-w-2xl text-[16px] leading-relaxed text-muted" style={{ "--i": 2 } as React.CSSProperties}>{children}</p>}
    </div>
  );
}
