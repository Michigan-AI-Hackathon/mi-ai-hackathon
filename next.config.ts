import type { NextConfig } from "next";

// Browser-level protections on every response.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },                       // nobody can embed the site (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // organizer pages hold personal data: never cache them anywhere
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
