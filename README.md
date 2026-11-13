# AuthVerify — Counterfeit Detection Co-Pilot

A mobile-first web app that lets anyone scan a branded product or medicine with their phone camera and get an instant AI-powered verdict on whether it's authentic or counterfeit. Africa-first, global reach.

## Features

- **Quick Scan** — point the camera at a product, get instant VLM authenticity analysis with red flags and positive indicators
- **Deep Compare** — snap a photo, the app searches the web for genuine reference images and compares your photo side-by-side with the real thing
- **Manufacturer Registry** — manufacturers register their company, add products, upload official reference photos, and specify security features. Their data becomes the ground truth for verification (preferred over web-searched references)
- **Verification Badges** — verified manufacturers get a green checkmark badge that appears on their products and in verification results
- **Barcode Scanning** — scan a product barcode with the phone camera to look up the product via OpenFoodFacts + web search
- **NAFDAC Regulator Lookup** — searches for NAFDAC registration numbers for medicines (Nigeria-first, with generic fallbacks for Ghana FDA, PPB Kenya, SAHPRA, etc.)
- **Real-time Community Alerts** — when a user reports a counterfeit, nearby users get alerted instantly via socket.io
- **Offline Scan Queue** — capture photos while offline, scans process automatically when connectivity returns
- **PWA** — installable to the home screen, works offline, push notifications
- **Manufacturer Portal** — register your company, add products, upload reference images, specify security features and known counterfeit indicators
- **Regulator Dashboard** — counterfeit hotspot analytics, most-reported brands, community report moderation queue, manufacturer verification queue
- **Supabase Auth** — email magic link sign-in for cross-device sync and verified community reports

## Tech Stack

- **Framework**: Next.js 16 with App Router, TypeScript 5
- **Styling**: Tailwind CSS 4, shadcn/ui (New York), Lucide icons
- **Database**: Supabase (Postgres + Auth + Storage + Realtime)
- **AI**: z-ai-web-dev-sdk (VLM for image analysis, LLM for reasoning, web_search, image-search)
- **Barcode Scanning**: @zxing/browser
- **Real-time**: Socket.io (community-alert mini-service)
- **Image Processing**: Sharp (EXIF stripping, validation, resizing)
- **PWA**: Service Worker with Background Sync + Push Notifications

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. In Project Settings > API, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. In the SQL Editor, run:
   - `src/lib/supabase/schema.sql` (base tables)
   - `src/lib/supabase/schema-manufacturer.sql` (manufacturer registry + cost log + cache + feedback)

### 4. Run the dev server

```bash
bun run dev
```

The app runs on `http://localhost:3000`.

### 5. Start the community-alert service (optional, for real-time alerts)

```bash
cd mini-services/community-alert-service
bun install
bun run dev
```

Runs socket.io on port 3003 + HTTP broadcast on port 3004.

## Project Structure

```
src/
  app/
    page.tsx                    # Main app (single route)
    layout.tsx                  # Root layout
    api/
      scan/quick/route.ts       # Quick Scan endpoint
      scan/deep/route.ts        # Deep Compare (SSE stream)
      scan/history/route.ts     # Scan history
      scan/[id]/route.ts        # Single scan
      product/lookup/route.ts   # Barcode → product lookup
      product/registered/route.ts # Manufacturer registry lookup
      regulator/dashboard/route.ts # Regulator analytics
      regulator/verify-manufacturer/route.ts # Manufacturer verification
      community/report/route.ts # Community counterfeit report
      community/moderate/route.ts # Report moderation
      manufacturer/register/route.ts # Manufacturer registration
      manufacturer/products/route.ts # Manufacturer product list
      manufacturer/product/route.ts # Add product
      manufacturer/product/[id]/images/route.ts # Upload reference images
      feedback/route.ts         # Verdict feedback
      push/subscribe/route.ts   # Push notification subscription
      errors/route.ts           # Error logging
  components/
    scan/                       # Camera, barcode, verdict, flags, comparison
    manufacturer/               # Manufacturer dashboard + verified badge
    regulator/                  # Regulator dashboard
    auth/                       # Auth button + magic link
    legal/                      # Privacy policy + terms + disclaimer
    onboarding/                 # First-time onboarding
    pwa/                        # Service worker registration
  lib/
    scan/                       # AI helpers, types, prompts, rate limiting, image validation
    supabase/                   # Supabase clients + schema SQL
  hooks/                        # use-auth, use-community-alerts, use-connectivity, use-push-notifications
mini-services/
  community-alert-service/      # Socket.io real-time alerts (port 3003/3004)
scripts/
  validate-accuracy.ts          # Batch accuracy validation (precision/recall/F1)
```

## Deployment

See `DEPLOYMENT.md` for the full production deployment guide (Vercel, Docker, PM2/systemd, Caddy gateway, Sentry, monitoring, security checklist).

## Accuracy Validation

Before launching, run the accuracy validation script with a curated set of genuine and fake product images:

```bash
bun run scripts/validate-accuracy.ts ./genuine ./fake
```

This measures precision, recall, and F1 score. Production readiness threshold: F1 ≥ 0.85.

## License

Proprietary. All rights reserved.
