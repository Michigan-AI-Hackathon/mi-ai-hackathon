"use client";
import { useState } from "react";

// Pick from suggestions or type your own. Submits as repeated hidden inputs named `name`.
export default function ChipPicker({ name, suggestions, initial = [], max = 8, placeholder, onChange }: {
  name: string; suggestions: readonly string[]; initial?: string[]; max?: number; placeholder?: string; onChange?: (v: string[]) => void;
}) {
  const [selected, setSelectedRaw] = useState<string[]>(initial);
  const setSelected = (v: string[] | ((s: string[]) => string[])) => setSelectedRaw((s) => { const n = typeof v === "function" ? v(s) : v; onChange?.(n); return n; });
  const [draft, setDraft] = useState("");
  const options = Array.from(new Set([...suggestions, ...selected]));
  const toggle = (v: string) =>
    setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : s.length >= max ? s : [...s, v]));
  const add = () => {
    const v = draft.trim().slice(0, 30);
    if (v && !selected.some((s) => s.toLowerCase() === v.toLowerCase()) && selected.length < max) setSelected([...selected, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => toggle(o)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-ink bg-ink text-card" : "border-line bg-card text-ink hover:border-ink"}`}>
              {o}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input className="input max-w-xs" value={draft} placeholder={placeholder ?? "Add your own"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn-secondary" onClick={add}>Add</button>
      </div>
      <p className="hint">{selected.length}/{max} picked</p>
      {selected.map((s) => <input key={s} type="hidden" name={name} value={s} />)}
    </div>
  );
}
