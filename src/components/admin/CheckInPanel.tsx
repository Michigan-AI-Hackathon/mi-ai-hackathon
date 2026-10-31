"use client";
import ActionButton from "@/components/ActionButton";
import { adminSetCheckin } from "@/app/admin/actions";

// Controls for the venue QR code. The QR itself is drawn on the server and passed in as children.
export default function CheckInPanel({ open, url, children }: { open: boolean; url: string; children: React.ReactNode }) {
  return (
    <section className="panel print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Self check-in QR code</h2>
          <p className="mt-2 max-w-xl text-[15px] text-muted">Show or print this at the door. Students scan it with their phone camera while signed in, and they&apos;re checked in. Only paid students with a finished profile can use it, and only while check-in is open.</p>
        </div>
        <span className={`chip px-3 py-1.5 text-sm font-semibold ${open ? "border-ok text-ok" : "border-warn text-warn"}`}>{open ? "Open" : "Closed"}</span>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-8">
        <div className="rounded-2xl border border-line bg-white p-4">{children}</div>
        <div className="min-w-0 flex-1 space-y-3 print:hidden">
          <p className="break-all text-sm text-muted">{url}</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton variant={open ? "secondary" : "primary"} action={adminSetCheckin.bind(null, !open, false)}>{open ? "Close check-in" : "Open check-in"}</ActionButton>
            <ActionButton variant="secondary" confirm="Make a new code? The printed one will stop working." action={adminSetCheckin.bind(null, open, true)}>Make a new code</ActionButton>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>Print</button>
          </div>
          <p className="text-sm text-muted">If the code leaks (for example a photo gets shared), press &quot;Make a new code&quot; and reprint.</p>
        </div>
      </div>
    </section>
  );
}
