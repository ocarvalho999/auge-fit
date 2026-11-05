import * as Sentry from "@sentry/nextjs";
import { scrubEvent, SENTRY_DATA_COLLECTION } from "@/lib/sentry-scrub";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
}
