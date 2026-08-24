import * as Sentry from "@sentry/nextjs";

export function register() {
  const SENTRY_DSN = process.env["SENTRY_DSN"];
  
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env["SENTRY_ENVIRONMENT"] ?? process.env["NEXT_PUBLIC_VERCEL_ENV"] ?? "development",
      tracesSampleRate: 0.1,
    });
  }
  
  // Global error handler for unhandled promise rejections
  if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
      Sentry.captureException(event.reason);
    });
    
    window.addEventListener("error", (event) => {
      Sentry.captureException(event.error);
    });
  }
}