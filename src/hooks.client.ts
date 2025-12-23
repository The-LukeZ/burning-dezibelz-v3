import { dev } from "$app/environment";
import { handleErrorWithSentry } from "@sentry/sveltekit";
import * as Sentry from "@sentry/sveltekit";

Sentry.init({
  dsn: "https://06efed1d6f63b2a8d08dd59c1d3bcaa9@o4508704165265408.ingest.de.sentry.io/4509417747316816",
  tracesSampleRate: 0.7,
  enableLogs: true,
  sendDefaultPii: true,
});

export const handleError = !dev ? handleErrorWithSentry() : () => {};
