"use client";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { requestToJoin, sendInvite, type ActionResult } from "@/app/actions";
import { adminAddToTeam } from "@/app/admin/actions";

// Native HTML5 drag and drop, no libraries. Every drop runs the same server action as the matching button,
// so the 4 per team, open-spot and same-school rules are enforced on the server.
// Drag kinds: "person" (a student) and "team". Drop modes:
//   invite: person dropped on my team -> send invite
//   join:   team dropped on me        -> ask to join
//   admin:  person dropped on a team  -> organizer places the student
const DragCtx = createContext<{ drag: string | null; set: (k: string | null) => void }>({ drag: null, set: () => {} });

export function DragArea({ children }: { children: React.ReactNode }) {
  const [drag, set] = useState<string | null>(null);
  return <DragCtx.Provider value={{ drag, set }}>{children}</DragCtx.Provider>;
}

export function Drag({ kind, id, as: Tag = "div", disabled, tap, className = "", style, children }: {
  kind: "person" | "team"; id: string; as?: "div" | "li"; disabled?: boolean; tap?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const { set } = useContext(DragCtx);
  // Touch screens never get draggable: it fights page scrolling. They use the buttons instead.
  const [fine, setFine] = useState(false);
  useEffect(() => { setFine(window.matchMedia("(pointer: fine)").matches); }, []);
  const can = !disabled && fine;
  return (
    <Tag draggable={can} style={style} data-tap={tap ? "" : undefined}
      onDragStart={(e: React.DragEvent) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind, id })); e.dataTransfer.effectAllowed = "move"; set(kind); }}
      onDragEnd={() => set(null)}
      className={`${className} ${can ? "cursor-grab active:cursor-grabbing" : ""}`}>
      {children}
    </Tag>
  );
}

export function Drop({ accept, mode, targetId, disabled, className = "", style, children }: {
  accept: "person" | "team"; mode: "invite" | "join" | "admin"; targetId?: string; disabled?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const { drag, set } = useContext(DragCtx);
  const [over, setOver] = useState(false);
  const [res, setRes] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  const live = drag === accept && !disabled;

  function run(id: string) {
    start(async () => {
      setRes(mode === "invite" ? await sendInvite(id) : mode === "join" ? await requestToJoin(id) : await adminAddToTeam(id, targetId!, false));
    });
  }
  return (
    <div style={style}
      onDragOver={(e) => { if (live) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
      onDragEnter={() => live && setOver(true)}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); setOver(false); set(null);
        if (disabled) return;
        try {
          const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { kind: string; id: string };
          if (d.kind === accept && typeof d.id === "string") run(d.id);
        } catch { /* not ours */ }
      }}
      className={`${className} transition-all ${live ? "outline-dashed outline-2 outline-accent" : ""} ${over ? "scale-[1.01] bg-accent/10 ring-2 ring-accent" : ""} ${pending ? "opacity-60" : ""}`}>
      {children}
      {res?.error && <p role="alert" className="mt-2 text-sm text-danger">{res.error}</p>}
      {res?.ok && <p role="status" className="mt-2 text-sm text-ok">{res.ok}</p>}
    </div>
  );
}

// Keyboard / click fallback for organizers: pick a team, press Add.
export function AdminAssign({ studentId, teams }: { studentId: string; teams: { id: string; name: string; open: number }[] }) {
  const [team, setTeam] = useState("");
  const [res, setRes] = useState<ActionResult>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`as-${studentId}`}>Team</label>
      <select id={`as-${studentId}`} value={team} onChange={(e) => setTeam(e.target.value)} className="input !w-auto !py-1 text-sm">
        <option value="">Team…</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.open} open)</option>)}
      </select>
      <button type="button" className="btn-secondary !py-1 text-sm" disabled={!team || pending}
        onClick={() => start(async () => setRes(await adminAddToTeam(studentId, team, false)))}>{pending ? "Adding…" : "Add"}</button>
      {res?.error && <span role="alert" className="text-sm text-danger">{res.error}</span>}
      {res?.ok && <span role="status" className="text-sm text-ok">{res.ok}</span>}
    </span>
  );
}
