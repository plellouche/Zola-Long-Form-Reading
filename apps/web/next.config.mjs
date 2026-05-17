import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@longform/shared', '@longform/api-client'],
  reactStrictMode: true,
  // Anchor workspace root to the monorepo root so Next doesn't try inferring
  // it from unrelated lockfiles in the user's home directory.
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
