import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env["NEXT_PUBLIC_SENTRY_DSN"] ?? process.env["SENTRY_DSN"];
const SENTRY_ENV = process.env["SENTRY_ENVIRONMENT"] ?? process.env["NEXT_PUBLIC_VERCEL_ENV"] ?? "development";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    tracesSampleRate: 0.1,
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event, hint) {
      // Filter out known non-actionable errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Ignore network errors from Gmail API rate limits
        if (error.message.includes("429") || error.message.includes("rate limit")) {
          return null;
        }
        // Ignore auth redirect errors
        if (error.message.includes("NEXT_REDIRECT")) {
          return null;
        }
      }
      return event;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;