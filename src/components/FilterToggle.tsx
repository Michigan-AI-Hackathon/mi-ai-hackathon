"use client";
import { useState } from "react";

// Filters collapse behind a button on small screens; they are always visible from lg up.
export default function FilterToggle({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(active > 0);
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls="filters" onClick={() => setOpen((o) => !o)}
        className="btn-secondary w-full justify-between lg:hidden">
        <span>Filters{active > 0 ? ` (${active})` : ""}</span><span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      <div id="filters" className={`${open ? "grid" : "hidden"} mt-4 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid lg:grid-cols-5`}>{children}</div>
    </div>
  );
}
