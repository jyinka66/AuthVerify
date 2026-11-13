# AuthVerify — Production Deployment Guide

This guide covers deploying the Next.js app and the community-alert mini-service to production.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Caddy gateway (:81)                                │
│  ├─ /?XTransformPort=3003 → community-alert service │
│  └─ / → Next.js app (:3000)                          │
└─────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐     ┌──────────────────────┐
│ Next.js app     │     │ Community-alert svc  │
│ :3000           │     │ :3003 (socket.io)    │
│                 │     │ :3004 (HTTP internal)│
│ VLM + LLM via   │ ──> │ POST /broadcast      │
│ z-ai SDK/CLI    │     │ (server-to-server)   │
└─────────────────┘     └──────────────────────┘
         │
         ▼
┌─────────────────┐
│ Supabase        │
│ Postgres + Auth │
│ + Storage       │
└─────────────────┘
```

## 1. Environment variables

Create a `.env` file (NEVER commit it):

```bash
# Supabase (required for cloud persistence + auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Next.js
NODE_ENV=production
```

## 2. Database setup

1. Create a Supabase project at supabase.com
2. Run `src/lib/supabase/schema.sql` in the Supabase SQL editor
3. Verify the tables `devices`, `scans`, `scan_flags`, `reference_cache`, `community_reports` exist
4. Verify storage buckets `suspect-photos` and `reference-images` exist

## 3. Deploy the Next.js app

### Option A: Vercel (easiest)
```bash
# Push to GitHub, connect repo to Vercel, set env vars in dashboard.
# The app is auto-deployed on every push to main.
```

### Option B: Self-hosted with Docker
```bash
# Build the standalone production bundle
bun run build

# Run with Bun
NODE_ENV=production bun .next/standalone/server.js
```

### Option C: PM2 (process manager)
```bash
npm install -g pm2
pm2 start "bun run start" --name authverify-app
pm2 startup
pm2 save
```

## 4. Deploy the community-alert mini-service

### With Docker (recommended)
```bash
cd mini-services/community-alert-service
docker build -t authverify-alerts .
docker run -d \
  --name authverify-alerts \
  --restart unless-stopped \
  -p 3003:3003 \
  -p 3004:3004 \
  authverify-alerts
```

### With PM2 (no Docker)
```bash
cd mini-services/community-alert-service
pm2 start "bun index.ts" --name authverify-alerts
pm2 startup
pm2 save
```

### With systemd
```bash
# /etc/systemd/system/authverify-alerts.service
[Unit]
Description=AuthVerify Community Alert Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/mini-services/community-alert-service
ExecStart=/usr/local/bin/bun index.ts
Restart=always
RestartSec=5
User=authverify

[Install]
WantedBy=multi-user.target

# Then:
sudo systemctl daemon-reload
sudo systemctl enable authverify-alerts
sudo systemctl start authverify-alerts
```

## 5. Caddy gateway configuration

The existing `Caddyfile` routes:
- `?XTransformPort=3003` → the community-alert service
- Everything else → the Next.js app on :3000

In production, use a real domain with HTTPS:
```caddyfile
authverify.yourdomain.com {
    @transform_port_query {
        query XTransformPort=*
    }
    handle @transform_port_query {
        reverse_proxy localhost:{query.XTransformPort}
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

## 6. Error tracking (Sentry)

Add Sentry for production error monitoring:
```bash
bun add @sentry/nextjs
```
Then run `bunx @sentry/nextjs wizard` to configure. Replace the `/api/errors` route's `console.error` with `Sentry.captureException`.

## 7. Rate limiting (production scale)

The in-memory rate limiter in `src/lib/scan/rate-limit.ts` works for single-instance deployments.
For multi-instance (multiple replicas), swap to Redis/Upstash:
```bash
bun add @upstash/ratelimit @upstash/redis
```
Replace the `checkRateLimit` implementation with Upstash's sliding-window limiter.

## 8. Monitoring checklist

- [ ] Health check endpoint: `GET http://localhost:3004/health` (mini-service)
- [ ] Sentry configured for the Next.js app
- [ ] Uptime monitor on the app URL (e.g., UptimeRobot, Better Stack)
- [ ] Supabase database backups enabled (daily automatic on Pro plan)
- [ ] Log aggregation (Vercel logs, or `pm2 logs`, or Docker logs)
- [ ] Alert on 5xx error rate > 5%
- [ ] Alert on daily AI budget approaching the limit (2000 calls/day)

## 9. Security checklist

- [ ] HTTPS enforced (Caddy auto-provisions Let's Encrypt certs)
- [ ] `.env` file not committed to git (verify `.gitignore`)
- [ ] Supabase RLS policies tightened (see schema.sql comments)
- [ ] Service role key NEVER exposed to the browser
- [ ] CSP headers configured (add to `next.config.ts`)
- [ ] Rate limiting active on all POST endpoints
- [ ] Image validation (size, format, EXIF strip) active
- [ ] NDPR / GDPR compliance reviewed by legal

## 10. First-day production runbook

1. Verify the app loads at your production URL
2. Submit a test Quick Scan — confirm verdict returns
3. Submit a test Deep Compare — confirm SSE stream works
4. Submit a community report — confirm it broadcasts
5. Check Supabase dashboard — confirm the scan row was written
6. Check Sentry — confirm no errors
7. Check the mini-service health: `curl http://localhost:3004/health`
