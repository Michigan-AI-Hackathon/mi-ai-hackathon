import { existsSync } from "node:fs";
import { join } from "node:path";
import { EVENT } from "@/lib/config";

// "Business+Tech at Michigan Ross". Drop the official logo at public/hosts/business-tech.svg (or .png)
// and it replaces the text lockup automatically.
export default function HostMark({ size = 34, tone = "ink" }: { size?: number; tone?: "ink" | "light" }) {
  const ext = ["svg", "png", "webp"].find((e) => existsSync(join(process.cwd(), "public", "hosts", `business-tech.${e}`)));
  if (ext) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/hosts/business-tech.${ext}`} alt={EVENT.host} style={{ height: size }} className="w-auto" />;
  }
  return (
    <span className={`inline-flex items-baseline gap-1.5 font-heading ${tone === "light" ? "text-on-hero" : "text-ink"}`}>
      <span className="text-lg font-bold tracking-tight">Business<span className="text-accent">+</span>Tech</span>
      <span className="text-sm font-medium opacity-70">at Michigan Ross</span>
    </span>
  );
}
