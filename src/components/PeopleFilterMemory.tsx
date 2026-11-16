"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "people-query";
const read = () => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };

// On Find teammates: remember the current search and filters for this tab.
export function RememberPeopleFilters() {
  useEffect(() => { try { sessionStorage.setItem(KEY, window.location.search); } catch { /* private mode: just don't remember */ } });
  return null;
}

// On a profile: "back" returns to the same filtered list instead of a fresh one.
export function BackToPeople() {
  const [q, setQ] = useState("");
  useEffect(() => setQ(read()), []);
  return <Link href={`/people${q}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">← Find teammates</Link>;
}
