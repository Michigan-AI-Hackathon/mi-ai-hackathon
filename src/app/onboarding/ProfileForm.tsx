"use client";
import { useActionState, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import ChipPicker from "@/components/ChipPicker";
import { saveProfile, type ActionResult } from "@/app/actions";
import { AVATAR_PRESETS, avatarSrc, INTEREST_SUGGESTIONS, SKILL_SUGGESTIONS, TRACKS, YEARS } from "@/lib/config";
import type { Profile } from "@/lib/session";

function Private() {
  return <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">Private</span>;
}

export default function ProfileForm({ profile, schools, isNew }: { profile: Profile; schools: { id: number; name: string }[]; isNew: boolean }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveProfile, null);
  const multiCampus = schools.length > 1;
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [avatarError, setAvatarError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setAvatarError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setAvatarError("Use a PNG, JPG or WebP image.");
    if (file.size > 2 * 1024 * 1024) return setAvatarError("Pick an image under 2 MB.");
    setUploading(true);
    const supabase = createClient();
    const path = `${profile.id}/${Date.now()}.${file.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return setAvatarError("Couldn't upload that image. Try another.");
    setAvatar(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
  }

  return (
    <form action={action} className="mt-8 space-y-8">
      <section className="panel space-y-5">
        <h2 className="font-heading text-xl font-semibold">About you</h2>
        <fieldset>
          <legend className="label">Profile picture (optional)</legend>
          <input type="hidden" name="avatar_url" value={avatar} />
          <div className="flex flex-wrap items-center gap-3">
            <Avatar url={avatar} name={profile.full_name} size={64} />
            {AVATAR_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setAvatar(p)} aria-label={`Use picture ${p.slice(-1)}`} aria-pressed={avatar === p}
                className={`rounded-full ${avatar === p ? "ring-2 ring-primary ring-offset-2" : "opacity-80 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarSrc(p)!} alt="" width={44} height={44} className="rounded-full" />
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[15px]">
            <label className="btn-secondary cursor-pointer">
              {uploading ? "Uploading…" : "Upload your own"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading}
                onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {avatar && <button type="button" onClick={() => setAvatar("")} className="text-muted underline">Remove picture</button>}
          </div>
          {avatarError && <p role="alert" className="mt-2 text-danger">{avatarError}</p>}
          <p className="hint">Other students see this. Skip it and we show your initials.</p>
        </fieldset>
        <div>
          <label htmlFor="full_name" className="label">Your name</label>
          <input id="full_name" name="full_name" className="input" defaultValue={profile.full_name ?? ""} required maxLength={60} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="school_id" className="label">School</label>
          {multiCampus ? (
            <>
              <select id="school_id" name="school_id" className="input" defaultValue={profile.school_id ?? ""} required>
                <option value="" disabled>Pick your campus</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="hint">Your email is shared by more than one campus, so pick yours.</p>
            </>
          ) : (
            <p className="input bg-paper">{schools[0]?.name ?? "Unknown school"}<span className="sr-only"> (set from your email)</span></p>
          )}
        </div>
        <div>
          <label htmlFor="year" className="label">Year<Private /></label>
          <select id="year" name="year" className="input" defaultValue={profile.year ?? ""} required>
            <option value="" disabled>Pick your year</option>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
          <p className="hint">Only organizers see this. It isn&apos;t shown on your profile or used in search.</p>
        </div>
        <div>
          <label htmlFor="study_area" className="label">What you study</label>
          <input id="study_area" name="study_area" className="input" placeholder="e.g. Nursing, Finance, Computer science"
            defaultValue={profile.study_area ?? ""} required maxLength={80} />
        </div>
      </section>

      <section className="panel space-y-6">
        <h2 className="font-heading text-xl font-semibold">What you bring</h2>
        <fieldset>
          <legend className="label">Tracks you&apos;re interested in</legend>
          <div className="flex flex-wrap gap-2">
            {TRACKS.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-[15px] has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input type="checkbox" name="tracks" value={t} defaultChecked={profile.tracks.includes(t)} className="accent-primary" />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <p className="label">Skills</p>
          <ChipPicker name="skills" suggestions={SKILL_SUGGESTIONS} initial={profile.skills} placeholder="Add a skill" />
        </div>
        <div>
          <p className="label">Interests</p>
          <ChipPicker name="interests" suggestions={INTEREST_SUGGESTIONS} initial={profile.interests} placeholder="Add an interest" />
        </div>
        <div>
          <label htmlFor="bio" className="label">What you&apos;re looking for</label>
          <textarea id="bio" name="bio" rows={3} maxLength={500} className="input"
            placeholder="e.g. Looking for a designer and someone who knows healthcare. I can handle the backend."
            defaultValue={profile.bio ?? ""} />
        </div>
        <div>
          <label htmlFor="linkedin_url" className="label">LinkedIn (optional)</label>
          <input id="linkedin_url" name="linkedin_url" className="input" placeholder="https://linkedin.com/in/…" defaultValue={profile.linkedin_url ?? ""} />
        </div>
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" name="looking_for_team" defaultChecked={profile.looking_for_team} className="h-4 w-4 accent-primary" />
          Show me as looking for a team
        </label>
      </section>

      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-ok">{state.ok}</p>}
      <button className="btn-primary px-6 py-3 text-[15px]" disabled={pending}>
        {pending ? "Saving…" : isNew ? "Save and continue" : "Save changes"}
      </button>
    </form>
  );
}
