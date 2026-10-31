import Link from "next/link";
import Countdown from "@/components/Countdown";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { EVENT, currentFee, TRACKS } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

const exampleTeam = [
  { skill: "Machine learning", school: "Michigan State University" },
  { skill: "Product design", school: "Kendall College of Art & Design" },
  { skill: "Finance", school: "Wayne State University" },
  { skill: "Backend", school: "Wayne State University" },
];

const schoolsTicker = ["University of Michigan", "Michigan State", "Wayne State", "Michigan Tech", "Grand Valley", "Western Michigan",
  "Oakland University", "Kettering", "Lawrence Tech", "Hope College", "Calvin", "Eastern Michigan", "Central Michigan", "Ferris State",
  "Washtenaw CC", "Henry Ford College", "Albion", "Kalamazoo College"];

const steps = [
  { title: "Sign up with your school email", body: "Any student at a Michigan college or university can join. Use your school address, not a personal one." },
  { title: "Build your profile and register", body: `Tell people what you're good at and which track you want, then pay the ${currentFee().label} registration fee.` },
  { title: "Find teammates", body: "Search students by skill, track and school. Invite someone to your team or ask to join theirs, and message them right on the site." },
  { title: "Lock in your team", body: "Teams that lock in before the deadline are guaranteed a spot. Students without a team are matched at the event." },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const fee = currentFee();

  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="btn-primary whitespace-nowrap">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn whitespace-nowrap text-ink">Sign in</Link>
              <Link href="/login" className="btn-primary hidden whitespace-nowrap sm:inline-flex">Create your account</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
          <p className="rise eyebrow text-primary" style={{ "--i": 0 } as React.CSSProperties}>{EVENT.dateLabel} / Detroit, MI</p>
          <h1 className="rise mt-4 max-w-5xl font-heading text-[2.9rem] font-bold leading-[0.98] sm:text-7xl lg:text-[5.5rem]" style={{ "--i": 1 } as React.CSSProperties}>
            Build with students from <span className="relative whitespace-nowrap">across Michigan.
              <span aria-hidden className="absolute -bottom-1 left-0 h-[6px] w-full origin-left bg-accent [animation:draw_900ms_var(--ease-out)_700ms_both]" />
            </span>
          </h1>
          <p className="rise mt-7 max-w-2xl text-lg leading-relaxed text-muted" style={{ "--i": 2 } as React.CSSProperties}>
            One weekend, four tracks, and about 500 students from colleges and universities statewide.
            You&apos;ll build an AI product on a team of four, with people from at least three schools.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
            <Link href={user ? "/dashboard" : "/login"} className="btn-primary px-6 py-3.5 text-[15px]">
              {user ? "Go to your dashboard" : "Create your account"} <span aria-hidden>→</span>
            </Link>
            <a href="#teams" className="btn-secondary px-6 py-3.5 text-[15px]">How teams work</a>
          </div>

          <div className="hero-panel rise mt-14 px-5 py-8 sm:px-10 sm:py-10" style={{ "--i": 4 } as React.CSSProperties}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-volt/10 to-transparent [animation:scan_5s_linear_infinite]" />
            <Countdown to={EVENT.startsAt} />
            <dl className="mt-9 grid gap-5 border-t border-on-hero/15 pt-6 sm:grid-cols-3">
              {[["When", EVENT.dateLabel], ["Where", EVENT.place], ["Registration", `${fee.label}, non-refundable`]].map(([k, v]) => (
                <div key={k}><dt className="eyebrow text-on-hero/55">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        {/* Schools ticker */}
        <div className="marquee overflow-hidden border-y border-line bg-card py-4" aria-label="Students from schools across Michigan">
          <div className="marquee-track flex w-max gap-10 whitespace-nowrap font-mono text-sm uppercase tracking-[0.12em] text-muted">
            {[...schoolsTicker, ...schoolsTicker].map((n, i) => (
              <span key={i} className="flex items-center gap-10" aria-hidden={i >= schoolsTicker.length}>{n}<span className="text-accent">✦</span></span>
            ))}
          </div>
        </div>

        {/* Team rules */}
        <section id="teams" className="scroll-mt-4">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <Reveal>
              <p className="eyebrow text-primary">Team rules</p>
              <h2 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">Every team mixes schools.</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                You go home knowing people and resources on other campuses. The site checks these rules for you, so you can&apos;t end up on a team that doesn&apos;t count.
              </p>
              <ul className="mt-7 space-y-3.5 text-[16px]">
                {["Teams of 4, from at least 3 schools", "No more than 2 people from the same school", "Every team has all 4 people before it locks in"].map((t, i) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink font-mono text-xs text-card">{i + 1}</span>{t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <div className="grid grid-cols-2 gap-3" aria-label="Example team of four">
              {exampleTeam.map((m, i) => (
                <Reveal key={m.skill} i={i}>
                  <div className="panel panel-hover h-full">
                    <span aria-hidden className={`block h-1.5 w-10 rounded-full ${i === 3 ? "bg-ink" : "bg-accent"}`} />
                    <p className="eyebrow mt-5 text-muted">Seat 0{i + 1}</p>
                    <p className="mt-1 font-heading text-xl font-semibold">{m.skill}</p>
                    <p className="mt-1 text-[15px] text-muted">{m.school}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-line bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal><p className="eyebrow text-primary">The path</p><h2 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">How it works</h2></Reveal>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <Reveal as="li" key={s.title} i={i}>
                  <div className="panel panel-hover h-full">
                    <span className="font-mono text-4xl font-semibold text-accent">0{i + 1}</span>
                    <h3 className="mt-4 font-heading text-xl font-semibold leading-snug">{s.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal><p className="eyebrow text-primary">Pick a lane</p><h2 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">Four tracks</h2></Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map((t, i) => (
              <Reveal key={t} i={i}>
                <div className="group panel panel-hover h-full overflow-hidden">
                  <span className="eyebrow text-muted">Track 0{i + 1}</span>
                  <p className="mt-10 font-heading text-2xl font-semibold">{t}</p>
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 origin-left scale-x-0 bg-accent transition-transform duration-500 [transition-timing-function:var(--ease-out)] group-hover:scale-x-100" />
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal><p className="mt-8 max-w-2xl text-[15px] text-muted">
            About half the participants aren&apos;t computer science students. Designers, business students and future doctors are exactly who teams need.
          </p></Reveal>
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
