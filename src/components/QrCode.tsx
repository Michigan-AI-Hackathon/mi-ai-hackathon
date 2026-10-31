import QRCode from "qrcode";

// Draws a QR code as inline SVG on the server (no image file, nothing to load). `value` is only ever our own URL.
export default async function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0e121a", light: "#0000" } });
  return <div role="img" aria-label={label} style={{ width: size, height: size }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
