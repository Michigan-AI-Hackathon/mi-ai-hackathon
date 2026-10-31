"use client";
import { useEffect, useRef } from "react";

// Fades and slides its children up the first time they scroll into view.
// `i` staggers siblings (each step is 80ms).
export default function Reveal({ children, i = 0, as: Tag = "div", className = "" }: {
  children: React.ReactNode; i?: number; as?: "div" | "li" | "section"; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const T = Tag as any;
  return <T ref={ref} className={`reveal ${className}`} style={{ "--i": i } as React.CSSProperties}>{children}</T>;
}
