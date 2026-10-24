"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";

// A button that runs a server action and shows its result inline.
export default function ActionButton({ action, children, variant = "primary", confirm, className = "" }: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  confirm?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>(null);
  const cls = variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary";
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={pending} className={`${cls} ${className}`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setResult(await action()));
        }}>
        {pending ? "Working…" : children}
      </button>
      {result?.error && <span role="alert" className="max-w-xs text-sm text-danger">{result.error}</span>}
      {result?.ok && <span role="status" className="text-sm text-ok">{result.ok}</span>}
    </span>
  );
}
