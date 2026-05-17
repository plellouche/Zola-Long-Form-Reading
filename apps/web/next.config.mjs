/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@longform/shared', '@longform/api-client'],
  reactStrictMode: true,
};

export default nextConfig;
