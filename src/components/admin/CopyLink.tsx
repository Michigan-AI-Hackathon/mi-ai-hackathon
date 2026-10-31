"use client";
import { useState } from "react";

export default function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ } }}>
      {done ? "Copied ✓" : "Copy link"}
    </button>
  );
}
