"use client";
import ActionButton from "@/components/ActionButton";
import { adminSetCheckin } from "@/app/admin/actions";

// Venue QR code plus its controls. The QR is drawn on the server and passed in as children.
// When printed, only the QR, event name and "Scan to check in" remain.
export default function CheckInPanel({ open, url, eventName, children }: { open: boolean; url: string; eventName: string; children: React.ReactNode }) {
  return (
    <section className="panel print:m-0 print:border-0 print:p-0 print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 className="font-heading text-2xl font-semibold">Check-in QR code</h2>
        <span className={`chip px-3 py-1.5 text-sm font-semibold ${open ? "border-ok text-ok" : "border-warn text-warn"}`}>{open ? "Open" : "Closed"}</span>
      </div>
      <div className="mt-5 flex flex-col items-center print:mt-0 print:min-h-screen print:justify-center">
        <p className="mb-4 hidden text-center font-heading text-4xl font-bold print:block">{eventName}</p>
        <div className="aspect-square w-full max-w-[22rem] rounded-2xl border border-line bg-white p-3 print:max-w-[26rem] print:border-0 [&>div]:!h-full [&>div]:!w-full">{children}</div>
        <p className="mt-4 hidden text-center font-heading text-3xl font-semibold print:block">Scan to check in</p>
        <p className="mt-3 max-w-full break-all text-center text-xs text-muted print:hidden">{url}</p>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3 print:hidden">
        <ActionButton className="min-h-11 w-full" variant={open ? "secondary" : "primary"} action={adminSetCheckin.bind(null, !open, false)}>{open ? "Close check-in" : "Open check-in"}</ActionButton>
        <ActionButton className="min-h-11 w-full" variant="secondary" confirm="Rotate the code? The printed one will stop working." action={adminSetCheckin.bind(null, open, true)}>Rotate code</ActionButton>
        <button type="button" className="btn-secondary min-h-11 w-full" onClick={() => window.print()}>Print</button>
      </div>
      <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-muted print:hidden">
        <li>The code works only while check-in is open.</li>
        <li>Students must be paid and have finished their profile.</li>
        <li>Close check-in after the event.</li>
      </ul>
    </section>
  );
}
