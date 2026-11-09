import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl without locale-prefixed routes: locale comes from the `NEXT_LOCALE` cookie.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

// Basic CSP. 'unsafe-inline' is needed for Next's inline bootstrap scripts without a nonce setup;
// dev additionally needs 'unsafe-eval' (React Refresh) and websockets (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Lets parallel dev servers use separate build folders (NEXT_DIST_DIR=.next-d etc.).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Agent B owns the `headers()` section below (security headers).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
