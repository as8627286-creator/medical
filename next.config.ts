import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally disabled: almost every page in this
  // application depends on live session state, live prices and live stock, and
  // the classic dynamic rendering model makes the freshness rules explicit.
  // See docs/ARCHITECTURE.md.
  cacheComponents: false,
  partialPrefetching: false,

  poweredByHeader: false,

  // Never let the framework expose the user agent of the server.
  generateEtags: true,

  experimental: {
    serverActions: {
      // Server Action payloads are small (forms only).
      bodySizeLimit: "1mb",
    },
  },

  images: {
    // Product photos are pre-resized at upload time and served from the
    // application's own media route, so the built-in optimiser is replaced by
    // a loader that maps a requested width onto the generated variants.
    loader: "custom",
    loaderFile: "./src/lib/media/image-loader.ts",
    qualities: [75],
    minimumCacheTTL: 3600,
    dangerouslyAllowLocalIP: false,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Admin and account pages must never be cached by a proxy.
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/login",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
