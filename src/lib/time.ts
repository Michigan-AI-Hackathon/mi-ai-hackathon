export function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `expires in ${h} ${h === 1 ? "hour" : "hours"}`;
  return `expires in ${Math.max(1, Math.floor(ms / 60_000))} min`;
}
