import type { NextConfig } from "next";

async function getSentryConfig() {
  const { withSentryConfig } = await import("@sentry/nextjs");
  return withSentryConfig;
}

const nextConfig: NextConfig = {
  // Standalone output powers the Dockerfile. Vercel manages its own output
  // format — forcing standalone there breaks NFT tracing.
  ...(process.env["VERCEL"] ? {} : { output: "standalone" as const }),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            // Next.js App Router boots hydration from inline flight scripts,
            // so script-src must allow 'unsafe-inline' until a nonce
            // architecture lands. Locking to 'self' silently kills hydration.
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        source: "/api/health",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/board",
        permanent: false,
      },
    ];
  },
};

const sentryConfig = {
  silent: true,
  org: process.env["SENTRY_ORG"],
  project: process.env["SENTRY_PROJECT"],
  authToken: process.env["SENTRY_AUTH_TOKEN"],
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: true },
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default async function createConfig(): Promise<NextConfig> {
  if (!process.env["SENTRY_DSN"]) {
    return nextConfig;
  }
  const withSentryConfig = await getSentryConfig();
  return withSentryConfig(nextConfig, sentryConfig);
}