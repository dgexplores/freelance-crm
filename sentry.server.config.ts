import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env["SENTRY_DSN"];
const SENTRY_ENV = process.env["SENTRY_ENVIRONMENT"] ?? process.env["NEXT_PUBLIC_VERCEL_ENV"] ?? "development";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    tracesSampleRate: 0.1,
    debug: false,
  });
}