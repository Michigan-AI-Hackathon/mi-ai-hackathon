"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import ChipPicker from "@/components/ChipPicker";
import { saveProfile, type ActionResult } from "@/app/actions";
import { AVATAR_PRESETS, HEARD_FROM, INTEREST_SUGGESTIONS, SKILL_SUGGESTIONS, STUDY_AREAS, TRACKS, YEARS } from "@/lib/config";
import DeleteAccount from "./DeleteAccount";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/session";

const STEPS = ["You", "Picture", "About you", "Team"] as const;
const PRONOUN_OPTIONS = ["she/her", "he/him", "they/them"] as const;
const RESUME_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function Req() {
  return <span aria-hidden className="ml-0.5 text-danger">*</span>;
}

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
  const initStudy = profile.study_area ?? "";
  const [studyChoice, setStudyChoice] = useState(!initStudy ? "" : (STUDY_AREAS as readonly string[]).includes(initStudy) ? initStudy : "other");
  const [studyOther, setStudyOther] = useState((STUDY_AREAS as readonly string[]).includes(initStudy) ? "" : initStudy);
  const study = studyChoice === "other" ? studyOther.trim() : studyChoice;
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [avatarError, setAvatarError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tracks, setTracks] = useState<string[]>(profile.tracks);
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [bio, setBio] = useState(profile.bio ?? "");
  // One question: how will you get a team? "have" = they already have teammates in mind (so not looking).
  const [teamChoice, setTeamChoice] = useState<"place_me" | "own_team" | "have" | "">(
    !profile.looking_for_team ? "have" : profile.placement_pref ?? "");
  const looking = teamChoice !== "have";
  const placement = teamChoice === "place_me" || teamChoice === "own_team" ? teamChoice : "";
  const initPron = profile.pronouns ?? "";
  const [pronChoice, setPronChoice] = useState(!initPron ? "" : (PRONOUN_OPTIONS as readonly string[]).includes(initPron) ? initPron : "other");
  const [pronOther, setPronOther] = useState((PRONOUN_OPTIONS as readonly string[]).includes(initPron) ? "" : initPron);
  const pronouns = pronChoice === "other" ? pronOther.trim() : pronChoice;
  const [heard, setHeard] = useState(profile.heard_from ?? "");
  const [heardDetail, setHeardDetail] = useState(profile.heard_detail ?? "");
  const [resume, setResume] = useState(profile.resume_path ?? "");
  const [resumeError, setResumeError] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);

  const schoolName = schools.find((s) => String(s.id) === schoolId)?.name ?? "";

  function problem(s: number): string | null {
    if (s === 0) {
      if (name.trim().length < 2) return "Add your name.";
      if (multiCampus && !schoolId) return "Pick your campus.";
      if (!year) return "Pick your year.";
      if (!studyChoice) return "Pick what you study.";
      if (!study) return "Tell us what you study.";
      if (isNew && !heard) return "Pick how you heard about us.";
      if (heard === "organization" && !heardDetail.trim()) return "Tell us which club or organization.";
    }
    if (s === 2 && !tracks.length) return "Pick at least one track.";
    if (s === 3 && !teamChoice) return "Pick how you want to get a team.";
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

  async function uploadResume(file: File | undefined) {
    if (!file) return;
    setResumeError("");
    if (!RESUME_TYPES.includes(file.type)) return setResumeError("Use a PDF or Word document.");
    if (file.size > 5 * 1024 * 1024) return setResumeError("Pick a file under 5 MB.");
    setResumeBusy(true);
    const ext = file.type === "application/pdf" ? "pdf" : file.type === "application/msword" ? "doc" : "docx";
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const { error: err } = await createClient().storage.from("resumes").upload(path, file, { contentType: file.type });
    setResumeBusy(false);
    if (err) return setResumeError("Couldn't upload that file. Try again.");
    setResume(path);
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
          <input type="hidden" name="pronouns" value={pronouns} />
          <input type="hidden" name="resume_path" value={resume} />
          {looking && <input type="hidden" name="looking_for_team" value="on" />}
          <input type="hidden" name="placement_pref" value={looking ? placement : ""} />
          {tracks.map((t) => <input key={t} type="hidden" name="tracks" value={t} />)}

          {/* Step 1 */}
          <section hidden={step !== 0} className="rise">
            <h1 className="font-heading text-4xl font-bold sm:text-[2.75rem]">{isNew ? "Let’s set you up." : "Your profile"}</h1>
            <div className="mt-8 space-y-6">
              <div>
                <label htmlFor="full_name" className="label">Your name<Req /></label>
                <input id="full_name" name="full_name" className="input py-3 text-lg" value={name} onChange={(e) => setName(e.target.value)}
                  maxLength={60} autoComplete="name" placeholder="First and last name" autoFocus />
              </div>
              <div>
                <p className="label">School<Req /></p>
                {multiCampus ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-1" role="radiogroup" aria-label="Campus">
                      {schools.map((s) => (
                        <button type="button" key={s.id} role="radio" aria-checked={String(s.id) === schoolId} onClick={() => setSchoolId(String(s.id))}
                          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-[15px] transition-all ${String(s.id) === schoolId ? "border-ink bg-ink font-semibold text-card shadow-[3px_3px_0_var(--color-accent)]" : "border-line bg-card hover:border-ink"}`}>
                          {s.name}
                          {String(s.id) === schoolId && <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-card text-ink"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg></span>}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="input flex items-center justify-between bg-paper">{schools[0]?.name ?? "Unknown school"}</p>
                )}
              </div>
              <div>
                <label htmlFor="pronouns" className="label">Pronouns (optional)</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select id="pronouns" className="input" value={pronChoice} onChange={(e) => setPronChoice(e.target.value)}>
                    <option value="">Prefer not to say</option>
                    {PRONOUN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    <option value="other">Self-describe…</option>
                  </select>
                  {pronChoice === "other" && <input className="input" aria-label="Your pronouns" value={pronOther} onChange={(e) => setPronOther(e.target.value)} maxLength={30} placeholder="e.g. she/they" />}
                </div>
                <p className="hint mt-1">Shown next to your name.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="year" className="label">Year<Req /><Private /></label>
                  <select id="year" name="year" className="input" value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="" disabled>Pick your year</option>
                    {YEARS.map((y) => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="study_choice" className="label">What you study<Req /></label>
                  <select id="study_choice" className="input" value={studyChoice} onChange={(e) => setStudyChoice(e.target.value)}>
                    <option value="" disabled>Pick your field</option>
                    {STUDY_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    <option value="other">Other…</option>
                  </select>
                  {studyChoice === "other" && <input className="input mt-2" aria-label="What you study" value={studyOther} onChange={(e) => setStudyOther(e.target.value)} maxLength={80} placeholder="e.g. Linguistics" />}
                  <input type="hidden" name="study_area" value={study} />
                </div>
              </div>
              <div>
                <label htmlFor="heard_from" className="label">How did you hear about us?{isNew && <Req />}</label>
                <select id="heard_from" name="heard_from" className="input" value={heard} onChange={(e) => setHeard(e.target.value)}>
                  <option value="" disabled={isNew}>{isNew ? "Pick one" : "Prefer not to say"}</option>
                  {HEARD_FROM.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {heard === "organization" && (
                  <div className="mt-3">
                    <label htmlFor="heard_detail" className="label">Which club or organization?<Req /></label>
                    <input id="heard_detail" name="heard_detail" className="input" value={heardDetail} onChange={(e) => setHeardDetail(e.target.value)} maxLength={80} placeholder="e.g. Michigan Data Science Team" />
                  </div>
                )}
              </div>
              <p className="hint"><span className="text-danger">*</span> Required</p>
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
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">What are you passionate about?</h1>
            <div className="mt-8 space-y-7">
              <fieldset>
                <legend className="label">Tracks<Req /></legend>
                <p className="hint mb-2">Pick the ones you like. We use them to match you with a team.</p>
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
              <div><p className="label">What intrigues you? (optional)</p><p className="hint mb-1">Topics, problems or ideas you get excited about.</p><ChipPicker name="interests" suggestions={INTEREST_SUGGESTIONS} initial={profile.interests} placeholder="Add an interest" /></div>
              <div>
                <label htmlFor="bio" className="label">About you</label>
                <p className="hint mb-1">A one-line intro other students will see: what you like building and the kind of teammate you want.</p>
                <textarea id="bio" name="bio" rows={2} maxLength={100} className="input" value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="e.g. Pre-med who codes on the side. Looking for a designer to build a health app with." />
                <p className="hint text-right">{bio.length}/100</p>
              </div>
              <div>
                <label htmlFor="linkedin_url" className="label">LinkedIn (optional)</label>
                <input id="linkedin_url" name="linkedin_url" className="input" placeholder="https://linkedin.com/in/…" defaultValue={profile.linkedin_url ?? ""} />
              </div>
              <div>
                <p className="label">Resume (optional)</p>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-ink/40 bg-card/50 px-4 py-3 text-[15px] hover:border-ink">
                  <span aria-hidden>↑</span>
                  <span className="font-medium">{resumeBusy ? "Uploading…" : resume ? "Replace resume" : "Upload a PDF or Word file"}</span>
                  <input type="file" accept=".pdf,.doc,.docx,application/pdf" className="sr-only" disabled={resumeBusy} onChange={(e) => uploadResume(e.target.files?.[0])} />
                </label>
                {resume && !resumeBusy && <p className="mt-1 text-sm text-ok">Resume attached. <button type="button" className="underline" onClick={() => setResume("")}>Remove</button></p>}
                {resumeError && <p role="alert" className="mt-1 text-sm text-danger">{resumeError}</p>}
                <p className="hint mt-1">Only organizers can see this. By uploading, you agree that some resumes may be shared with our industry partners.</p>
              </div>
            </div>
          </section>

          {/* Step 4 */}
          <section hidden={step !== 3} className="rise">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">How will you get a team?<Req /></h1>
            <p className="mt-3 text-[15px] text-muted">Teams are 4 people from at least 3 schools. You can change this any time from your profile.</p>
            <div className="mt-8 space-y-3" role="radiogroup" aria-label="How you will get a team">
              {([
                ["place_me", "Automated team matching", "I don't have a team. Match me with people who fit.", "You can still browse and join a team yourself."],
                ["own_team", "I'll find my own team", "I don't have a team yet, but I want to browse teams and invite people myself.", ""],
                ["have", "I already have teammates", "I have people in mind. I'll create a team and invite them, or join theirs.", ""],
              ] as const).map(([v, title, body, note]) => {
                const on = teamChoice === v;
                return (
                  <button type="button" key={v} role="radio" aria-checked={on} onClick={() => setTeamChoice(v)}
                    className={`flex w-full items-start gap-4 rounded-xl border px-5 py-4 text-left transition-all ${on ? "border-ink bg-ink text-card shadow-[3px_3px_0_var(--color-accent)]" : "border-line bg-card hover:border-ink"}`}>
                    <span aria-hidden className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-card bg-card text-ink" : "border-ink/40"}`}>
                      {on && <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>}
                    </span>
                    <span>
                      <span className="block font-heading text-lg font-semibold">{title}</span>
                      <span className={`mt-0.5 block text-[15px] ${on ? "text-card/80" : "text-muted"}`}>{body}</span>
                      {note && <span className={`mt-1 block text-sm font-medium ${on ? "text-accent" : "text-primary"}`}>{note}</span>}
                    </span>
                  </button>
                );
              })}
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
        {!isNew && !profile.is_admin && <DeleteAccount />}
      </div>

      {/* ----------------------------- live preview ----------------------------- */}
      <aside className="hero-panel sticky top-0 hidden h-screen items-center justify-center self-start rounded-none p-12 lg:flex" aria-label="Profile preview">
        <div className="w-full max-w-sm">
          <p className="text-sm text-on-hero/60">Preview</p>
          <div className="mt-5 -rotate-1 rounded-2xl bg-card p-7 text-ink shadow-2xl transition-transform duration-500 [transition-timing-function:var(--ease-out)] hover:rotate-0">
            <div className="flex items-center gap-4">
              <Avatar url={avatar} name={name || "You"} size={72} />
              <div className="min-w-0">
                <p className={`truncate font-heading text-2xl font-bold ${name ? "" : "text-muted"}`}>{name || "Your name"}{pronouns && <span className="ml-2 font-body text-sm font-normal text-muted">({pronouns})</span>}</p>
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
            <p className={`mt-6 border-t border-line pt-4 text-sm font-medium ${looking ? "text-ok" : "text-muted"}`}>{teamChoice === "place_me" ? "● Automated matching" : teamChoice === "own_team" ? "● Finding a team" : teamChoice === "have" ? "Has teammates in mind" : "Team: not chosen yet"}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
