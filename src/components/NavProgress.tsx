"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

// Slim top progress bar: starts on internal link clicks, finishes when the URL changes.
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [w, setW] = useState(0);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const start = () => {
    if (hide.current) clearTimeout(hide.current);
    stop();
    setOn(true); setW(8);
    timer.current = setInterval(() => setW((x) => x + (90 - x) * 0.08), 200);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      let u: URL;
      try { u = new URL(a.href, location.href); } catch { return; }
      if (u.origin !== location.origin) return;
      if (u.pathname === location.pathname && u.search === location.search) return;
      (a.closest("[data-tap]") ?? a).setAttribute("data-pending", "");
      start();
    };
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stop();
    document.querySelectorAll("[data-pending]").forEach((el) => el.removeAttribute("data-pending"));
    setW(100);
    hide.current = setTimeout(() => { setOn(false); setW(0); }, 450);
    return () => { if (hide.current) clearTimeout(hide.current); };
  }, [pathname, search]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" style={{ opacity: on ? 1 : 0, transition: "opacity 200ms" }}>
      <div className="h-full bg-accent" style={{ width: `${w}%`, transition: w === 0 ? "none" : "width 200ms ease-out", boxShadow: "0 0 8px var(--color-accent, #e8431f)" }} />
    </div>
  );
}

export default function NavProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
