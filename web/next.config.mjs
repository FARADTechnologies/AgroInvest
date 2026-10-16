// The browser only ever talks to this origin. API calls under /api are proxied
// to the backend, so cookies stay first-party and no CORS is needed. The target
// is fixed at build time (Docker build arg API_INTERNAL_URL).
// `npm run dev:live` develops the UI against the deployed API, which always runs
// the newest backend, so no local backend or mock is needed.
const LIVE_API = "https://farad-agro-api-o8bw.onrender.com";
const apiInternalUrl =
  process.env.API_INTERNAL_URL ??
  (process.env.npm_lifecycle_event === "dev:live" ? LIVE_API : "http://localhost:8000");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker images use the standalone server; hosts that run "next start"
  // (Render, Vercel) leave NEXT_OUTPUT unset.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  reactStrictMode: true,
  // The free API sleeps when idle and needs up to a minute to wake; the default 30 s proxy
  // timeout turned that into a 500 on sign-in.
  experimental: { proxyTimeout: 120_000 },
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInternalUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
