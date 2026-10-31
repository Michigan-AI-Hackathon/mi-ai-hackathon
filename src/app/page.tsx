import Link from "next/link";
import Countdown from "@/components/Countdown";
import Faq, { type FaqItem } from "@/components/Faq";
import HostMark from "@/components/HostMark";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import SchoolBadge, { hasLogo } from "@/components/SchoolBadge";
import { EVENT, LOCK_DEADLINE_LABEL, TRACKS, currentFee } from "@/lib/config";
import { isDev } from "@/lib/dev-preview";
import { createClient } from "@/lib/supabase/server";

// Official logos: add public/schools/<slug>.svg and they replace the monogram automatically.
const SCHOOLS = [
  { slug: "umich", abbr: "UM", name: "University of Michigan" },
  { slug: "msu", abbr: "MSU", name: "Michigan State University" },
  { slug: "wayne", abbr: "WSU", name: "Wayne State University" },
  { slug: "mtu", abbr: "MTU", name: "Michigan Technological University" },
  { slug: "gvsu", abbr: "GV", name: "Grand Valley State University" },
  { slug: "wmu", abbr: "WMU", name: "Western Michigan University" },
  { slug: "oakland", abbr: "OU", name: "Oakland University" },
  { slug: "kettering", abbr: "KU", name: "Kettering University" },
  { slug: "ltu", abbr: "LTU", name: "Lawrence Technological University" },
  { slug: "emu", abbr: "EMU", name: "Eastern Michigan University" },
  { slug: "cmu", abbr: "CMU", name: "Central Michigan University" },
  { slug: "udm", abbr: "UDM", name: "University of Detroit Mercy" },
  { slug: "hope", abbr: "HC", name: "Hope College" },
  { slug: "calvin", abbr: "CU", name: "Calvin University" },
  { slug: "hfc", abbr: "HFC", name: "Henry Ford College" },
];

const roster = [
  { skill: "Machine learning", school: "Michigan State University", slug: "msu", abbr: "MSU" },
  { skill: "Product design", school: "Lawrence Technological University", slug: "ltu", abbr: "LTU" },
  { skill: "Finance", school: "Wayne State University", slug: "wayne", abbr: "WSU" },
  { skill: "Backend", school: "Wayne State University", slug: "wayne", abbr: "WSU" },
];

const steps = [
  { title: "Sign up with your school email", body: "Use your school address, not a personal one. We check it against Michigan colleges and universities." },
  { title: "Build your profile and register", body: `Tell people what you're good at and which track you want, then pay the ${currentFee().label} registration fee.` },
  { title: "Find teammates", body: "Search by skill, track and school. Invite someone to your team or ask to join theirs, and message them on the site." },
  { title: "Lock in your team", body: "Locked teams are guaranteed a spot. Students without a team are matched at the event." },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const fee = currentFee();
  const email = "aihackathonumich@gmail.com";

  const timeline = [
    { when: "Open now", title: "Registration", body: `Create your account, finish your profile and pay the ${fee.label} fee.`, state: "open" },
    { when: LOCK_DEADLINE_LABEL, title: "Team lock-in deadline", body: "Teams locked by this date are guaranteed a spot. We'll announce the date here and by email.", state: "tba" },
    { when: "Before the event", title: "Solo matching", body: "Students who still have no team are placed on a team by the organizers.", state: "tba" },
    { when: EVENT.dateLabel, title: "The hackathon", body: `Two days of building. ${EVENT.place}.`, state: "event" },
  ];

  const faqs: FaqItem[] = [
    { q: "Who can join?", a: <>Any student at a Michigan college or university: public universities, community colleges, tribal colleges, private colleges and graduate schools. You sign up with your school email, and we check it against our list of Michigan schools. You don&apos;t need to study computer science. About half of participants don&apos;t, and teams need designers, business students and future doctors.</> },
    { q: "How do I register and what does it cost?", a: <>Create an account with your school email, finish your profile, then pay the {EVENT.feeLabel} registration fee from your dashboard. The fee is non-refundable. Have a coupon code? Enter it at checkout.</> },
    { q: "How does payment work?", a: <>Payment is by card through Stripe, and we never see or store your card number. Once your payment goes through, your dashboard updates and you can search for teammates, send invites and start or join a team. If it doesn&apos;t update within a few minutes, email {email}.</> },
    { q: "What are the team rules?", a: <>A team has 4 people from at least 3 different schools, with no more than 2 from the same school. UM Ann Arbor, Dearborn and Flint count as different schools. The site checks all of this for you, so you can&apos;t end up on a team that doesn&apos;t count.</> },
    { q: "How do invites work?", a: <>Any member can invite students, and a team can have as many open invites as it has open spots. Invites expire after 48 hours. When a student asks to join your team, any one member can accept or decline.</> },
    { q: "When do teams lock?", a: <>The lock-in deadline is {LOCK_DEADLINE_LABEL.toLowerCase()}. A team can lock once it has all 4 people, and everyone has paid. Locked teams are guaranteed a spot. After locking, nobody can join or leave without emailing an organizer.</> },
    { q: "What if I don't have a team?", a: <>You can still register. Browse open teams, ask to join one, or wait to be invited. Students who are still without a team are matched by the organizers at the event.</> },
    { q: "Where and when is it?", a: <>{EVENT.dateLabel}. {EVENT.place}. We&apos;ll update this page and email everyone as soon as it&apos;s confirmed.</> },
    { q: "Who is running this?", a: <>{EVENT.host}. Questions? Email <a className="link-draw font-medium text-ink" href={`mailto:${email}`}>{email}</a>.</> },
  ];

  return (
    <div>
      <div className="bg-hero text-on-hero">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-[13px] sm:px-6">
          <span>An official <strong className="font-semibold">Business+Tech at Michigan Ross</strong> event</span>
          <span className="hidden text-on-hero/60 sm:inline">{EVENT.dateLabel} · Detroit</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-6">
            <div className="hidden items-center gap-6 text-[15px] font-medium text-muted md:flex">
              <a href="#rules" className="link-draw hover:text-ink">Teams</a>
              <a href="#timeline" className="link-draw hover:text-ink">Timeline</a>
              <a href="#register" className="link-draw hover:text-ink">Register</a>
              <a href="#faq" className="link-draw hover:text-ink">FAQ</a>
            </div>
            {isDev && (
              <a href="/dev/preview?as=team" className="btn whitespace-nowrap border border-dashed border-ink/40 text-ink hover:border-ink">Dev: preview app</a>
            )}
            {user ? (
              <Link href="/dashboard" className="btn-primary whitespace-nowrap">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn whitespace-nowrap text-ink">Sign in</Link>
                <Link href="/login" className="btn-primary hidden whitespace-nowrap sm:inline-flex">Create your account</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-20">
          <p className="rise eyebrow text-primary" style={{ "--i": 0 } as React.CSSProperties}>{EVENT.dateLabel} · Detroit, Michigan</p>
          <h1 className="rise mt-5 max-w-5xl font-heading text-[2.9rem] font-bold leading-[0.98] sm:text-7xl lg:text-[5.5rem]" style={{ "--i": 1 } as React.CSSProperties}>
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
            <a href="#faq" className="btn-secondary px-6 py-3.5 text-[15px]">Read the FAQ</a>
          </div>
        </section>

        {/* Schools banner */}
        <section aria-label="Schools represented" className="rise" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 sm:px-6">
            <p className="eyebrow text-muted">Open to students at every Michigan college and university</p>
            <p className="flex items-center gap-3 text-sm text-muted">Hosted by <HostMark /></p>
          </div>
          <div className="marquee mt-5 overflow-hidden border-y border-line bg-card py-6 [mask-image:linear-gradient(90deg,transparent,#000_3%,#000_92%,transparent)]">
            <div className="marquee-track flex w-max items-center gap-14 pl-[max(1rem,calc((100vw-72rem)/2+1.5rem))]">
              {[...SCHOOLS, ...SCHOOLS].map((s, i) => (
                <div key={i} className="flex h-12 items-center gap-3 whitespace-nowrap opacity-80 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0" aria-hidden={i >= SCHOOLS.length}>
                  <SchoolBadge slug={s.slug} abbr={s.abbr} name={s.name} size={44} />
                  {!hasLogo(s.slug) && <span className="font-heading text-[15px] font-semibold text-ink/80">{s.name}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Countdown */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <div className="hero-panel px-6 py-9 sm:px-12 sm:py-14">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="font-heading text-2xl font-semibold sm:text-3xl">The hackathon starts in</h2>
                <p className="text-sm text-on-hero/65">{EVENT.dateLabel} · {EVENT.place}</p>
              </div>
              <div className="mt-8 sm:mt-12"><Countdown to={EVENT.startsAt} /></div>
            </div>
          </Reveal>
        </section>

        {/* Team rules */}
        <section id="rules" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
            <Reveal>
              <p className="eyebrow text-primary">Team rules</p>
              <h2 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">Every team mixes schools.</h2>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                You go home knowing people and resources on other campuses. The site checks these rules for you, so you can&apos;t end up on a team that doesn&apos;t count.
              </p>
              <ul className="mt-8 divide-y divide-line border-y border-line text-[16px]">
                {["Teams of 4, from at least 3 schools", "No more than 2 people from the same school", "Every team has all 4 people before it locks in", "UM Ann Arbor, Dearborn and Flint count as different schools"].map((t) => (
                  <li key={t} className="flex items-center gap-3 py-3.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />{t}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal i={1}>
              <p className="eyebrow text-muted">An example team</p>
              <ul className="mt-4 divide-y divide-line border-y border-line" aria-label="Example team of four">
                {roster.map((m, i) => (
                  <li key={m.skill} className="group flex items-center gap-4 py-4 transition-[padding] duration-300 [transition-timing-function:var(--ease-out)] hover:pl-2">
                    <span className="flex w-32 shrink-0 justify-start sm:w-40"><SchoolBadge slug={m.slug} abbr={m.abbr} name={m.school} size={34} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-xl font-semibold">{m.skill}</span>
                      <span className="block text-[15px] text-muted">{m.school}</span>
                    </span>
                    <span className="font-heading text-sm text-muted">{i + 1}/4</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">Three schools, two people from Wayne State. That&apos;s a valid team.</p>
            </Reveal>
          </div>
        </section>

        {/* Timeline */}
        <section id="timeline" className="scroll-mt-20 border-t border-line bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal><p className="eyebrow text-primary">Timeline</p><h2 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">What happens, and when</h2></Reveal>
            <ol className="relative mt-12 grid gap-8 lg:grid-cols-4 lg:gap-6">
              <span aria-hidden className="absolute left-[5px] top-2 h-[calc(100%-1rem)] w-px bg-line lg:left-0 lg:top-[5px] lg:h-px lg:w-full" />
              {timeline.map((t, i) => (
                <Reveal as="li" key={t.title} i={i} className="relative pl-8 lg:pl-0 lg:pt-8">
                  <span aria-hidden className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full lg:top-0 ${t.state === "open" ? "bg-accent ring-4 ring-accent/25" : t.state === "event" ? "bg-ink" : "border-2 border-ink/40 bg-paper"}`} />
                  <p className={`text-sm font-semibold ${t.state === "tba" ? "text-muted" : "text-primary"}`}>{t.when}</p>
                  <h3 className="mt-1 font-heading text-xl font-semibold">{t.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{t.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Register + payment */}
        <section id="register" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <Reveal>
              <p className="eyebrow text-primary">Registration</p>
              <h2 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">Four steps to a team.</h2>
              <ol className="mt-8 divide-y divide-line border-y border-line">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex gap-5 py-5">
                    <span className="font-heading text-3xl font-semibold leading-none text-accent">{i + 1}</span>
                    <div><h3 className="font-heading text-lg font-semibold">{s.title}</h3><p className="mt-1 text-[15px] leading-relaxed text-muted">{s.body}</p></div>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal i={1}>
              <div className="panel sticky top-24 p-7 sm:p-9">
                <p className="eyebrow text-muted">Registration fee</p>
                <p className="mt-3 font-heading text-6xl font-bold tracking-tight">{fee.label}</p>
                <p className="mt-1 text-[15px] text-muted">per student · non-refundable{fee.earlyBird ? " · early-bird price" : ""}</p>
                <ul className="mt-6 space-y-3 border-t border-line pt-6 text-[15px]">
                  <li className="flex gap-3"><Check />Pay by card through Stripe. We never see your card number.</li>
                  <li className="flex gap-3"><Check />Have a coupon code? Enter it at checkout.</li>
                  <li className="flex gap-3"><Check />Paying unlocks search, invites, messages and team creation.</li>
                  <li className="flex gap-3"><Check />Each teammate pays their own fee before the team can lock.</li>
                </ul>
                <Link href={user ? "/dashboard" : "/login"} className="btn-primary mt-8 w-full py-3.5 text-[15px]">{user ? "Go to your dashboard" : "Create your account"} <span aria-hidden>→</span></Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Tracks */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal><p className="eyebrow text-primary">Tracks</p><h2 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">Pick a lane.</h2></Reveal>
            <ul className="mt-10 border-t border-line">
              {TRACKS.map((t, i) => (
                <Reveal as="li" key={t} i={i}>
                  <div className="group relative flex items-baseline gap-6 border-b border-line py-6 transition-[padding] duration-500 [transition-timing-function:var(--ease-out)] hover:pl-4">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-accent transition-transform duration-500 [transition-timing-function:var(--ease-out)] group-hover:scale-y-100" />
                    <span className="w-8 font-heading text-sm text-muted">0{i + 1}</span>
                    <span className="font-heading text-3xl font-semibold sm:text-5xl">{t}</span>
                    <span aria-hidden className="ml-auto -translate-x-2 text-2xl opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100">→</span>
                  </div>
                </Reveal>
              ))}
            </ul>
            <Reveal><p className="mt-8 max-w-2xl text-[15px] text-muted">
              About half the participants aren&apos;t computer science students. Designers, business students and future doctors are exactly who teams need.
            </p></Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-line bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <Reveal>
              <p className="eyebrow text-primary">FAQ</p>
              <h2 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">Questions, answered.</h2>
              <p className="mt-5 text-[16px] leading-relaxed text-muted">Can&apos;t find yours? Email <a className="link-draw font-medium text-ink" href={`mailto:${email}`}>{email}</a>.</p>
            </Reveal>
            <Reveal i={1}><Faq items={faqs} /></Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted">A statewide AI hackathon for Michigan college and university students. {EVENT.dateLabel}, Detroit.</p>
            <p className="mt-5 flex items-center gap-3 text-sm text-muted">Hosted by <HostMark size={36} /></p>
          </div>
          <div>
            <p className="eyebrow text-muted">Explore</p>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {[["#rules", "Team rules"], ["#timeline", "Timeline"], ["#register", "Registration"], ["#faq", "FAQ"]].map(([h, l]) => <li key={h}><a href={h} className="link-draw">{l}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="eyebrow text-muted">Contact</p>
            <p className="mt-4 text-[15px]"><a className="link-draw" href={`mailto:${email}`}>{email}</a></p>
            <p className="mt-2 text-[15px] text-muted">Registration is $20 and non-refundable.</p>
          </div>
        </div>
        <div className="border-t border-line"><p className="mx-auto max-w-6xl px-4 py-5 text-[13px] text-muted sm:px-6">© {new Date().getFullYear()} Business+Tech at Michigan Ross. School names and logos belong to their institutions.</p></div>
      </footer>
    </div>
  );
}

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>
  );
}
