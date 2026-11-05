"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import ChipPicker from "@/components/ChipPicker";
import { saveProfile, type ActionResult } from "@/app/actions";
import { AVATAR_PRESETS, INTEREST_SUGGESTIONS, SKILL_SUGGESTIONS, TRACKS, YEARS } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/session";

const STEPS = ["You", "Picture", "What you bring"] as const;

function Private() {
  return <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">Private</span>;
}

export default function ProfileForm({ profile, schools, isNew, next }: { profile: Profile; schools: { id: number; name: string }[]; isNew: boolean; next?: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveProfile, null);
  const router = useRouter();
  // Editing an existing profile: after a save, go back to the page the user came from.
  useEffect(() => {
    if (!state?.ok || isNew) return;
    if (window.history.length > 1) { router.back(); router.refresh(); } else router.replace("/dashboard");
  }, [state, isNew, router]);
  const multiCampus = schools.length > 1;
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(profile.full_name ?? "");
  const [schoolId, setSchoolId] = useState(String(profile.school_id ?? (multiCampus ? "" : schools[0]?.id ?? "")));
  const [year, setYear] = useState(profile.year ?? "");
  const [study, setStudy] = useState(profile.study_area ?? "");
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [avatarError, setAvatarError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tracks, setTracks] = useState<string[]>(profile.tracks);
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [looking, setLooking] = useState(profile.looking_for_team);

  const schoolName = schools.find((s) => String(s.id) === schoolId)?.name ?? "";

  function problem(s: number): string | null {
    if (s === 0) {
      if (name.trim().length < 2) return "Add your name.";
      if (multiCampus && !schoolId) return "Pick your campus.";
      if (!year) return "Pick your year.";
      if (!study.trim()) return "Add what you study.";
    }
    if (s === 2 && !tracks.length) return "Pick at least one track.";
    return null;
  }
  function go(to: number) {
    // moving forward needs every step before it to be valid
    for (let i = 0; i < to; i++) { const p = problem(i); if (p) { setStep(i); return setError(p); } }
    setError(null); setStep(to);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setAvatarError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setAvatarError("Use a PNG, JPG or WebP image.");
    if (file.size > 2 * 1024 * 1024) return setAvatarError("Pick an image under 2 MB.");
    setUploading(true);
    const supabase = createClient();
    const path = `${profile.id}/${Date.now()}.${file.type.split("/")[1]}`;
    const { error: err } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (err) return setAvatarError("Couldn't upload that image. Try another.");
    setAvatar(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
  }

  const last = STEPS.length - 1;
  const showSubmit = step === last || !isNew;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* ------------------------------ form side ------------------------------ */}
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <a href={isNew ? "/" : "/dashboard"} className="font-heading text-[17px] font-bold">Michigan AI Hackathon</a>
          {!isNew && <a href="/dashboard" className="link-draw text-sm text-muted hover:text-ink">Back to dashboard</a>}
        </div>

        <ol className="mt-8 flex gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined} className="group w-full text-left">
                <span className={`block h-1.5 rounded-full transition-all duration-500 ${i <= step ? "bg-ink" : "bg-line group-hover:bg-ink/30"}`} />
                <span className={`mt-2 block text-[13px] font-medium transition-colors ${i === step ? "text-ink" : "text-muted"}`}>{i + 1}. {s}</span>
              </button>
            </li>
          ))}
        </ol>

        <form action={action} className="max-w-xl flex-1 pt-8"
          onSubmit={(e) => {
            if (isNew && step < last) { e.preventDefault(); go(step + 1); return; }
            for (let i = 0; i <= last; i++) { const p = problem(i); if (p) { e.preventDefault(); setStep(i); return setError(p); } }
          }}>
          {/* hidden fields so every step is submitted even when not shown */}
          {next && <input type="hidden" name="next" value={next} />}
          <input type="hidden" name="avatar_url" value={avatar} />
          <input type="hidden" name="school_id" value={schoolId} />
          {tracks.map((t) => <input key={t} type="hidden" name="tracks" value={t} />)}

          {/* Step 1 */}
          <section hidden={step !== 0} className="rise">
            <h1 className="font-heading text-4xl font-bold sm:text-[2.75rem]">{isNew ? "Let’s set you up." : "Your profile"}</h1>
            <div className="mt-8 space-y-6">
              <div>
                <label htmlFor="full_name" className="label">Your name</label>
                <input id="full_name" name="full_name" className="input py-3 text-lg" value={name} onChange={(e) => setName(e.target.value)}
                  maxLength={60} autoComplete="name" placeholder="First and last name" autoFocus />
              </div>
              <div>
                <p className="label">School</p>
                {multiCampus ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-1" role="radiogroup" aria-label="Campus">
                      {schools.map((s) => (
                        <button type="button" key={s.id} role="radio" aria-checked={String(s.id) === schoolId} onClick={() => setSchoolId(String(s.id))}
                          className={`rounded-lg border px-4 py-3 text-left text-[15px] transition-all ${String(s.id) === schoolId ? "border-ink bg-card shadow-[3px_3px_0_var(--color-text)]" : "border-line bg-card hover:border-ink"}`}>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="input flex items-center justify-between bg-paper">{schools[0]?.name ?? "Unknown school"}</p>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="year" className="label">Year<Private /></label>
                  <select id="year" name="year" className="input" value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="" disabled>Pick your year</option>
                    {YEARS.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="study_area" className="label">What you study</label>
                  <input id="study_area" name="study_area" className="input" placeholder="e.g. Nursing, Finance" value={study} onChange={(e) => setStudy(e.target.value)} maxLength={80} />
                </div>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section hidden={step !== 1} className="rise">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">Choose a picture</h1>
            <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {AVATAR_PRESETS.map((p) => {
                const on = avatar === p.key;
                return (
                  <button type="button" key={p.key} onClick={() => setAvatar(p.key)} aria-pressed={on}
                    className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-300 [transition-timing-function:var(--ease-spring)] ${on ? "-translate-y-1 border-ink bg-card shadow-[3px_3px_0_var(--color-text)]" : "border-line bg-card hover:-translate-y-0.5 hover:border-ink"}`}>
                    <Avatar url={p.key} size={72} />
                    <span className="text-[13px] font-medium">{p.label}</span>
                    {on && <span aria-hidden className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-ink text-card"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg></span>}
                  </button>
                );
              })}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink/40 bg-card/50 p-3 text-center transition-all hover:-translate-y-0.5 hover:border-ink hover:bg-card">
                <span className="grid h-[72px] w-[72px] place-items-center rounded-full border border-line bg-paper text-2xl">{uploading ? "…" : "↑"}</span>
                <span className="text-[13px] font-medium">{uploading ? "Uploading" : "Upload photo"}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => setAvatar("")} aria-pressed={!avatar}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all ${!avatar ? "-translate-y-1 border-ink bg-card shadow-[3px_3px_0_var(--color-text)]" : "border-line bg-card hover:-translate-y-0.5 hover:border-ink"}`}>
                <Avatar name={name || "You"} size={72} />
                <span className="text-[13px] font-medium">Initials</span>
              </button>
            </div>
            {avatarError && <p role="alert" className="mt-3 text-sm text-danger">{avatarError}</p>}
          </section>

          {/* Step 3 */}
          <section hidden={step !== 2} className="rise">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">What do you bring?</h1>
            <div className="mt-8 space-y-7">
              <fieldset>
                <legend className="label">Tracks</legend>
                <div className="flex flex-wrap gap-2">
                  {TRACKS.map((t) => {
                    const on = tracks.includes(t);
                    return (
                      <button type="button" key={t} aria-pressed={on} onClick={() => setTracks(on ? tracks.filter((x) => x !== t) : [...tracks, t])}
                        className={`rounded-lg border px-4 py-2.5 text-[15px] font-medium transition-all ${on ? "border-ink bg-ink text-card" : "border-line bg-card hover:border-ink"}`}>{t}</button>
                    );
                  })}
                </div>
              </fieldset>
              <div><p className="label">Skills</p><ChipPicker name="skills" suggestions={SKILL_SUGGESTIONS} initial={profile.skills} placeholder="Add a skill" onChange={setSkills} /></div>
              <div><p className="label">Interests (optional)</p><ChipPicker name="interests" suggestions={INTEREST_SUGGESTIONS} initial={profile.interests} placeholder="Add an interest" /></div>
              <div>
                <label htmlFor="bio" className="label">What you&apos;re looking for</label>
                <textarea id="bio" name="bio" rows={2} maxLength={100} className="input" value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Need a designer. I can do the backend." />
                <p className="hint text-right">{bio.length}/100</p>
              </div>
              <div>
                <label htmlFor="linkedin_url" className="label">LinkedIn (optional)</label>
                <input id="linkedin_url" name="linkedin_url" className="input" placeholder="https://linkedin.com/in/…" defaultValue={profile.linkedin_url ?? ""} />
              </div>
              <label className="flex items-center gap-3 text-[15px]">
                <input type="checkbox" name="looking_for_team" checked={looking} onChange={(e) => setLooking(e.target.checked)} className="h-4 w-4 accent-primary" />
                Show me as looking for a team
              </label>
            </div>
          </section>

          {(error || state?.error) && <p role="alert" className="mt-6 text-danger">{error ?? state?.error}</p>}
          {!error && state?.ok && <p role="status" className="mt-6 text-ok">{state.ok}</p>}

          <div className="sticky bottom-0 -mx-5 mt-10 flex items-center gap-3 border-t border-line bg-paper/90 px-5 py-4 backdrop-blur-md sm:-mx-10 sm:px-10 lg:-mx-16 lg:px-16">
            {step > 0 && <button type="button" className="btn-secondary px-5 py-3" onClick={() => go(step - 1)}>Back</button>}
            {step < last && <button type="button" className={`${isNew ? "btn-primary" : "btn-secondary"} px-6 py-3 text-[15px]`} onClick={() => go(step + 1)}>Continue <span aria-hidden>→</span></button>}
            {showSubmit && <button className="btn-primary px-6 py-3 text-[15px]" disabled={pending}>{pending ? "Saving…" : isNew ? "Finish" : "Save changes"}</button>}
          </div>
        </form>
      </div>

      {/* ----------------------------- live preview ----------------------------- */}
      <aside className="hero-panel sticky top-0 hidden h-screen items-center justify-center self-start rounded-none p-12 lg:flex" aria-label="Profile preview">
        <div className="w-full max-w-sm">
          <p className="text-sm text-on-hero/60">Preview</p>
          <div className="mt-5 -rotate-1 rounded-2xl bg-card p-7 text-ink shadow-2xl transition-transform duration-500 [transition-timing-function:var(--ease-out)] hover:rotate-0">
            <div className="flex items-center gap-4">
              <Avatar url={avatar} name={name || "You"} size={72} />
              <div className="min-w-0">
                <p className={`truncate font-heading text-2xl font-bold ${name ? "" : "text-muted"}`}>{name || "Your name"}</p>
                <p className="truncate text-[15px] text-muted">{schoolName || "Your school"}{study ? `, ${study}` : ""}</p>
              </div>
            </div>
            {bio && <p className="mt-5 line-clamp-3 text-[15px] leading-relaxed">{bio}</p>}
            {(tracks.length > 0 || skills.length > 0) ? (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {tracks.map((t) => <span key={t} className="chip border-ink/30 bg-paper font-medium">{t}</span>)}
                {skills.slice(0, 5).map((k) => <span key={k} className="chip">{k}</span>)}
              </div>
            ) : null}
            <p className={`mt-6 border-t border-line pt-4 text-sm font-medium ${looking ? "text-ok" : "text-muted"}`}>{looking ? "● Looking for a team" : "Not looking for a team"}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
