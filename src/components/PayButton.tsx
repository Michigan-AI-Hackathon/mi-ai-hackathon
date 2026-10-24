"use client";
import { useFormStatus } from "react-dom";

// Disables itself after the first click so nobody gets charged twice.
export default function PayButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Opening checkout…" : label}</button>;
}
