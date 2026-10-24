import Link from "next/link";
import Countdown from "@/components/Countdown";
import Logo from "@/components/Logo";
import { EVENT, TRACKS } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

const exampleTeam = [
  { skill: "Machine learning", school: "Michigan State University", color: "bg-accent" },
  { skill: "Product design", school: "Kendall College of Art & Design", color: "bg-accent" },
  { skill: "Finance", school: "Wayne State University", color: "bg-accent" },
  { skill: "Backend", school: "Wayne State University", color: "bg-primary" },
];

const steps = [
  { title: "Sign up with your school email", body: "Any student at a Michigan college or university can join. Use your school address, not a personal one." },
  { title: "Build your profile and pay the deposit", body: "Tell people what you're good at and which track you want. The $15 deposit is refunded when you stay for the whole event." },
  { title: "Find teammates", body: "Search students by skill, track and school. Invite someone to your team or ask to join theirs, and message them right on the site." },
  { title: "Lock in your team", body: "Teams that lock in before the deadline are guaranteed a spot. Students without a team are matched at the event." },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="btn-primary whitespace-nowrap">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn whitespace-nowrap text-ink hover:text-primary">Sign in</Link>
              <Link href="/login" className="btn-primary hidden whitespace-nowrap sm:inline-flex">Create your account</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
          <p className="text-[15px] font-semibold text-primary">{EVENT.dateLabel} in Detroit</p>
          <h1 className="mt-3 max-w-4xl font-heading text-5xl font-bold leading-[1.02] sm:text-7xl">
            Build with students from across Michigan.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            One weekend, four tracks, and about 500 students from colleges and universities statewide.
            You&apos;ll build an AI product on a team of four, with people from at least three schools.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/dashboard" : "/login"} className="btn-primary px-5 py-3 text-[15px]">
              {user ? "Go to your dashboard" : "Create your account"}
            </Link>
            <a href="#teams" className="btn-secondary px-5 py-3 text-[15px]">How teams work</a>
          </div>

          <div className="hero-panel mt-12 px-6 py-8 text-on-hero sm:px-10 sm:py-10">
            <p className="text-[15px] font-semibold text-on-hero/85">The hackathon starts in</p>
            <div className="mt-4"><Countdown to={EVENT.startsAt} /></div>
            <dl className="mt-8 grid gap-4 border-t border-on-hero/25 pt-6 text-[15px] sm:grid-cols-3">
              <div><dt className="text-on-hero/70">When</dt><dd className="font-semibold">{EVENT.dateLabel}</dd></div>
              <div><dt className="text-on-hero/70">Where</dt><dd className="font-semibold">{EVENT.place}</dd></div>
              <div><dt className="text-on-hero/70">Deposit</dt><dd className="font-semibold">$15, refunded when you stay the whole event</dd></div>
            </dl>
          </div>
        </section>

        {/* Team rules */}
        <section id="teams" className="border-y border-line bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">Every team mixes schools.</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                You go home knowing people and resources on other campuses. The site checks these rules for you, so you can&apos;t end up on a team that doesn&apos;t count.
              </p>
              <ul className="mt-6 space-y-3 text-[16px]">
                <li className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />Teams of 4, from at least 3 schools</li>
                <li className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />No more than 2 people from the same school</li>
                <li className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />A team of 3 needs 3 different schools</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3" aria-label="Example team of four">
              {exampleTeam.map((m) => (
                <div key={m.skill} className="rounded-xl border border-line bg-paper p-4 sm:p-5">
                  <span aria-hidden className={`block h-2 w-10 rounded-full ${m.color}`} />
                  <p className="mt-4 font-heading text-xl font-semibold">{m.skill}</p>
                  <p className="mt-1 text-[15px] text-muted">{m.school}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works: a real sequence, so it's numbered */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="border-t-2 border-ink pt-4">
                <span className="font-heading text-sm font-bold text-primary">Step {i + 1}</span>
                <h3 className="mt-2 font-heading text-xl font-semibold leading-snug">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">Four tracks</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {TRACKS.map((t) => (
              <span key={t} className="rounded-full border border-ink/15 bg-card px-5 py-2.5 font-heading text-lg font-semibold">{t}</span>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-[15px] text-muted">
            About half the participants aren&apos;t computer science students. Designers, business students and future doctors are exactly who teams need.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <span>Hosted by {EVENT.host}</span>
          <span>Questions? Email aihackathonumich@gmail.com</span>
        </div>
      </footer>
    </div>
  );
}
