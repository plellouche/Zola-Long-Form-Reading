// Browser-side Sentry init. Auto-loaded by @sentry/nextjs from this filename.
// Reads NEXT_PUBLIC_SENTRY_DSN (browser-exposed); silent no-op when unset.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'production',
    // Sample 10% of transactions; 100% of errors.
    tracesSampleRate: 0.1,
    // Replay is heavy at scale; off for now. Enable if a specific bug needs it.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Filter noisy/expected client errors (extension scripts, network blips).
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Network request failed',
      'Load failed',
    ],
  });
}
