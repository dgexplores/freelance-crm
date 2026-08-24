import type { NextConfig } from "next";

async function getSentryConfig() {
  const { withSentryConfig } = await import("@sentry/nextjs");
  return withSentryConfig;
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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