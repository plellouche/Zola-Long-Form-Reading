import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withSentryConfig } from '@sentry/nextjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@longform/shared', '@longform/api-client'],
  reactStrictMode: true,
  // Anchor workspace root to the monorepo root so Next doesn't try inferring
  // it from unrelated lockfiles in the user's home directory.
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

// withSentryConfig wires the sentry.{client,server,edge}.config files into
// the right Next runtimes at build time. Source map upload is a no-op until
// SENTRY_AUTH_TOKEN is set in Vercel; runtime error capture still works the
// moment NEXT_PUBLIC_SENTRY_DSN is set, so we can ship this before Sentry
// credentials exist.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
});
