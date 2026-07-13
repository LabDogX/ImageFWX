const internalApiUrl = (process.env.INTERNAL_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // FastAPI uses trailing slashes for a few collection endpoints. Do not
  // canonicalize /api paths before fallback rewrites, or Next.js (308) and
  // FastAPI (307) form a redirect loop through the reverse proxy.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '*',
      },
      {
        protocol: 'https',
        hostname: '*',
      },
    ],
    unoptimized: true,
  },
  async rewrites() {
    return {
      // Keep local Next.js API routes (health checks and the Google OAuth
      // callback page) intact. Requests without a matching local route fall
      // through to FastAPI, allowing reverse proxies that cannot route by
      // path (for example Lucky) to forward the entire site to port 3000.
      fallback: [
        {
          source: '/api/:path*',
          destination: `${internalApiUrl}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
