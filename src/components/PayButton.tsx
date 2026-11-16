"use client";
import { useFormStatus } from "react-dom";

// Disables itself after the first click so nobody gets charged twice.
export default function PayButton({ label, pendingLabel }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? <><span className="spinner" aria-hidden />{pendingLabel ?? "Opening checkout…"}</> : label}</button>;
}
