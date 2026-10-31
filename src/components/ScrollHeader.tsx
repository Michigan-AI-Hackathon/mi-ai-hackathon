"use client";
import { useEffect, useState } from "react";

// A full header that stays hidden while the hero has the stage, then slides in once you scroll past it.
export default function ScrollHeader({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const on = () => setShown(window.scrollY > window.innerHeight * 0.6);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header aria-hidden={!shown} inert={!shown}
      className={`fixed inset-x-0 top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md transition-transform duration-500 [transition-timing-function:var(--ease-out)] ${shown ? "translate-y-0" : "-translate-y-full"}`}>
      {children}
    </header>
  );
}
