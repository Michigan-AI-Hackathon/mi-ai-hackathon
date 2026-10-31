// Event details shown on the site. Update these when Phil confirms.
export const EVENT = {
  name: "Michigan AI Hackathon",
  host: "Business+Tech at Michigan Ross",
  // Second weekend of April 2027 in Detroit (exact date and venue to confirm)
  startsAt: "2027-04-09T09:00:00-04:00",
  dateLabel: "April 9–10, 2027",
  place: "Detroit (venue to be announced)",
  feeCents: 2000,          // registration fee, non-refundable
  feeLabel: "$20",
};

// Early-bird price. Set to null to turn it off. Before `endsAt` the fee is `feeCents`.
export const EARLY_BIRD: { feeCents: number; endsAt: string; label: string } | null = null;
// e.g. { feeCents: 1500, endsAt: "2027-02-01T00:00:00-05:00", label: "$15" }

export function currentFee(now = new Date()) {
  if (EARLY_BIRD && now < new Date(EARLY_BIRD.endsAt)) return { cents: EARLY_BIRD.feeCents, label: EARLY_BIRD.label, earlyBird: true };
  return { cents: EVENT.feeCents, label: EVENT.feeLabel, earlyBird: false };
}

// Default pictures, one per kind of builder. Stored on the profile as "preset-<key>".
export const AVATAR_PRESETS = [
  { key: "preset-engineer", label: "Engineer" },
  { key: "preset-business", label: "Business" },
  { key: "preset-designer", label: "Designer" },
  { key: "preset-health", label: "Health" },
  { key: "preset-data", label: "Data & AI" },
  { key: "preset-hardware", label: "Hardware" },
  { key: "preset-founder", label: "Founder" },
  { key: "preset-researcher", label: "Researcher" },
] as const;
export const AVATAR_KEYS: string[] = AVATAR_PRESETS.map((p) => p.key);

// Older profiles used preset-1..4.
const LEGACY: Record<string, string> = { "preset-1": "engineer", "preset-2": "business", "preset-3": "designer", "preset-4": "health" };

// avatar_url is either a preset key or the full URL of an uploaded image.
export function avatarSrc(v: string | null | undefined) {
  if (!v) return null;
  if (v.startsWith("preset-")) return `/avatars/${LEGACY[v] ?? v.slice(7)}.svg`;
  return v;
}

// Shown as placeholders until organizers confirm.
export const LOCK_DEADLINE_LABEL = "To be announced";

export const TRACKS = ["FinTech", "HealthTech", "SportsTech", "Industry 4.0"] as const;

export const YEARS = [
  "First year",
  "Second year",
  "Third year",
  "Fourth year",
  "Fifth year or more",
  "Graduate student",
] as const;

// Suggestions only; students can add their own.
export const SKILL_SUGGESTIONS = [
  "Frontend", "Backend", "Mobile", "Machine learning", "Data analysis", "Product management",
  "UI/UX design", "Business strategy", "Finance", "Marketing", "Pitching", "Healthcare",
  "Hardware", "Research", "Writing",
];

export const INTEREST_SUGGESTIONS = [
  "Startups", "Social impact", "Sports", "Health", "Fintech", "Manufacturing", "Education",
  "Climate", "Gaming", "Creative tools",
];
