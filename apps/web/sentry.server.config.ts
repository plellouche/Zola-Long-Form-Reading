// Server-side Sentry init for Node runtime (server components, route handlers).
// Auto-loaded by @sentry/nextjs; pairs with sentry.edge.config.ts for the edge runtime.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    tracesSampleRate: 0.1,
  });
}
