import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Security headers — CSP, CORS, XSS protection, etc.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy — restricts where scripts/styles/images can load from.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Allow inline styles (Next.js + shadcn use them) and style-src from self.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Allow scripts from self and Next.js dev/webpack.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Allow images from anywhere (web reference images, OpenFoodFacts, Supabase storage).
              "img-src 'self' data: https: blob:",
              // Allow fonts from Google Fonts.
              "font-src 'self' https://fonts.gstatic.com data:",
              // Allow connections to Supabase, the gateway, and websocket.
              "connect-src 'self' https: wss: ws:",
              // Allow media from self and data.
              "media-src 'self' data:",
              // Allow form submissions to self only.
              "form-action 'self'",
              // Block object/embed.
              "object-src 'none'",
              // Block base tags.
              "base-uri 'self'",
              // Frame ancestors blocked (no iframing).
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // XSS protection (legacy browsers).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Force HTTPS.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Control referrer information.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions policy — restrict camera to self only.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
