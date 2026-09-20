import type { NextConfig } from "next";

async function getSentryConfig() {
  const { withSentryConfig } = await import("@sentry/nextjs");
  return withSentryConfig;
}

const nextConfig: NextConfig = {
  // Standalone output powers the Dockerfile. Vercel manages its own output
  // format — forcing standalone there breaks NFT tracing.
  ...(process.env["VERCEL"] ? {} : { output: "standalone" as const }),
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { hostname: "picsum.photos" },
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
  
  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  
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
      // Cache static assets aggressively
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
  async redirects() {
    return [];
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