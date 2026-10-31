import type { Metadata } from "next";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Michigan AI Hackathon",
  description: "A 24-hour AI hackathon for Michigan college students. Find teammates from other schools, form a team, and build in Detroit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
