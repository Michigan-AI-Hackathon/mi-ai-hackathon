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
