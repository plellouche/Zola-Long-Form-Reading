// Next 15 instrumentation hook — auto-called once per server runtime.
// @sentry/nextjs requires this file to wire up server + edge inits.
// See https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Sentry captures React Server Component render errors via this hook.
export const onRequestError = Sentry.captureRequestError;
