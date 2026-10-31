import { existsSync } from "node:fs";
import { join } from "node:path";

// A school's mark. Drop an official logo at public/schools/<slug>.svg (or .png) and it is used
// automatically; until then we show a monogram so the layout is already final.
export function hasLogo(slug: string) {
  return ["svg", "png", "webp"].some((e) => existsSync(join(process.cwd(), "public", "schools", `${slug}.${e}`)));
}

export default function SchoolBadge({ slug, abbr, name, size = 44, maxW = 150 }: { slug: string; abbr: string; name: string; size?: number; maxW?: number }) {
  const ext = ["svg", "png", "webp"].find((e) => existsSync(join(process.cwd(), "public", "schools", `${slug}.${e}`)));
  if (ext) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/schools/${slug}.${ext}`} alt={name} height={size} style={{ height: size, maxWidth: maxW }} className="w-auto object-contain" />;
  }
  return (
    <span aria-label={name} style={{ width: size, height: size, fontSize: size * 0.34 }}
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-card font-heading font-bold tracking-tight text-ink">
      {abbr}
    </span>
  );
}
