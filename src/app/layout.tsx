import type { Metadata } from "next";
import "@fontsource-variable/public-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Michigan AI Hackathon",
  description: "Build with students from colleges across Michigan. Find teammates, form a team, and get ready for Detroit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
