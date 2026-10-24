import Logo from "@/components/Logo";
import Countdown from "@/components/Countdown";
import { EVENT } from "@/lib/config";

/*
  Style guide: every token and building block on one page.
  Edit src/styles/theme.css and refresh this page to see the change everywhere.
*/
const colors: [string, string][] = [
  ["--color-page-bg", "Page background"],
  ["--color-surface", "Cards, inputs, header"],
  ["--color-text", "Main text"],
  ["--color-text-muted", "Secondary text"],
  ["--color-border", "Borders"],
  ["--color-brand-primary", "Buttons, links, selected"],
  ["--color-brand-primary-hover", "Button hover"],
  ["--color-brand-accent", "Small highlights"],
  ["--color-hero-bg", "Countdown panel"],
  ["--color-success", "Success"],
  ["--color-warning", "Warning"],
  ["--color-error", "Error"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Logo />
      <h1 className="mt-10 text-4xl">Design system</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Every color, font and component the site uses. To change the look, edit <code className="chip">src/styles/theme.css</code> and refresh.
        Nothing on the pages needs to change.
      </p>

      <Section title="Colors">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {colors.map(([v, label]) => (
            <li key={v} className="flex items-center gap-3">
              <span className="h-12 w-12 shrink-0 rounded-md border border-line" style={{ background: `var(${v})` }} />
              <span><span className="block text-sm font-semibold">{label}</span><code className="text-xs text-muted">{v}</code></span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="space-y-4">
          <p className="text-5xl font-bold" style={{ fontFamily: "var(--font-family-heading)" }}>Page title, 48px</p>
          <p className="text-4xl" style={{ fontFamily: "var(--font-family-heading)", fontWeight: "var(--heading-weight)" }}>Section title, 36px</p>
          <p className="text-2xl" style={{ fontFamily: "var(--font-family-heading)", fontWeight: "var(--heading-weight)" }}>Card title, 24px</p>
          <p>Body text, 16px. Search students from every school and invite someone to your team.</p>
          <p className="text-muted">Secondary text, 16px muted.</p>
          <p className="text-sm text-muted">Small text, 14px. Hints and labels.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary">Primary action</button>
          <button className="btn-secondary">Secondary action</button>
          <button className="btn-danger">Leave team</button>
          <button className="btn-primary" disabled>Disabled</button>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-xl gap-4">
          <div><label className="label" htmlFor="d1">Label</label><input id="d1" className="input" placeholder="Placeholder text" /><p className="hint">Hint text explains the field.</p></div>
          <div><label className="label" htmlFor="d2">Dropdown</label><select id="d2" className="input"><option>Option</option></select></div>
          <p role="alert" className="text-sm text-danger">Error message: what went wrong and how to fix it.</p>
          <p className="text-sm text-ok">Success message.</p>
        </div>
      </Section>

      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          <span className="chip">Machine learning</span><span className="chip">FinTech</span>
          <span className="rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-on-primary">Selected</span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">3</span>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel">
            <div className="flex items-baseline justify-between"><p className="text-xl font-semibold">Student name</p><span className="text-sm text-ok">Looking for a team</span></div>
            <p className="text-muted">Wayne State University, Finance</p>
            <p className="mt-3">Looking for a designer and someone who knows healthcare.</p>
            <div className="mt-3 flex gap-2"><button className="btn-primary">Invite to my team</button><button className="btn-secondary">Message</button></div>
          </div>
          <div className="flex min-h-28 items-center justify-center rounded-lg border-2 border-dashed border-line text-muted">Empty team spot</div>
        </div>
      </Section>

      <Section title="Countdown panel">
        <div className="hero-panel px-6 py-8">
          <p className="text-sm font-semibold opacity-85">The hackathon starts in</p>
          <div className="mt-4"><Countdown to={EVENT.startsAt} /></div>
        </div>
      </Section>
    </div>
  );
}
