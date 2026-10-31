import { avatarSrc } from "@/lib/config";

// Round profile picture: an uploaded image, one of the four presets, or initials.
export default function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const src = avatarSrc(url);
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full bg-paper object-cover ring-1 ring-line" />;
  }
  const initials = (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <span aria-hidden style={{ ...style, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-line">
      {initials}
    </span>
  );
}
