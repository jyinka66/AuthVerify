-- AuthVerify — Supabase schema for the counterfeit detection co-pilot
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query).

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Anonymous device tracking (no PII). Powers scan history without forcing auth.
create table if not exists public.devices (
  id uuid primary key default uuid_generate_v4(),
  device_fingerprint text unique not null,
  region text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Every scan (Quick Scan or Deep Compare).
create table if not exists public.scans (
  id uuid primary key default uuid_generate_v4(),
  device_id uuid references public.devices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('quick','deep')),
  category text,
  brand_detected text,
  product_name_detected text,
  pack_size_detected text,
  verdict text not null check (verdict in ('likely_authentic','high_risk_counterfeit','inconclusive')),
  confidence_score int not null default 0 check (confidence_score >= 0 and confidence_score <= 100),
  reasoning text,
  suspect_image_path text,
  reference_images_json jsonb,
  region text,
  created_at timestamptz not null default now()
);
create index if not exists scans_device_created_idx on public.scans (device_id, created_at desc);
create index if not exists scans_brand_idx on public.scans (brand_detected);

-- Individual red flags and positive indicators per scan.
create table if not exists public.scan_flags (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  kind text not null check (kind in ('red_flag','positive_indicator')),
  category text not null,
  description text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high'))
);
create index if not exists scan_flags_scan_idx on public.scan_flags (scan_id);

-- Cached genuine product reference images from web search (30-day TTL).
create table if not exists public.reference_cache (
  id uuid primary key default uuid_generate_v4(),
  brand text not null,
  product_name text,
  pack_size text,
  image_url text not null,
  source_url text,
  source_type text not null default 'unknown' check (source_type in ('manufacturer','retailer','regulatory','marketplace','unknown')),
  credibility_score int not null default 50 check (credibility_score >= 0 and credibility_score <= 100),
  caption text,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index if not exists reference_cache_brand_product_idx on public.reference_cache (brand, product_name);
create index if not exists reference_cache_expires_idx on public.reference_cache (expires_at);

-- User-submitted counterfeit reports that improve detection for everyone.
create table if not exists public.community_reports (
  id uuid primary key default uuid_generate_v4(),
  brand text not null,
  product_name text,
  region text,
  reporter_device_id uuid references public.devices(id) on delete set null,
  details_json jsonb,
  status text not null default 'pending' check (status in ('pending','verified','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists community_reports_brand_region_idx on public.community_reports (brand, region);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.devices enable row level security;
alter table public.scans enable row level security;
alter table public.scan_flags enable row level security;
alter table public.reference_cache enable row level security;
alter table public.community_reports enable row level security;

-- devices: open read/insert/update for anonymous use (Phase 2 tightens).
create policy "devices read own" on public.devices
  for select using (true);
create policy "devices insert own" on public.devices
  for insert with check (true);
create policy "devices update own" on public.devices
  for update using (true) with check (true);

-- scans: readable by all (community learning), writable by any device.
create policy "scans read all" on public.scans
  for select using (true);
create policy "scans insert any" on public.scans
  for insert with check (true);
create policy "scans delete own" on public.scans
  for delete using (true);

-- scan_flags: readable by all, writable by any client.
create policy "scan_flags read all" on public.scan_flags
  for select using (true);
create policy "scan_flags insert any" on public.scan_flags
  for insert with check (true);

-- reference_cache: readable by all, writable via service role only.
create policy "reference_cache read all" on public.reference_cache
  for select using (true);

-- community_reports: readable by all (anonymized), writable by any device.
create policy "community_reports read all" on public.community_reports
  for select using (true);
create policy "community_reports insert any" on public.community_reports
  for insert with check (true);

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
insert into storage.buckets (id, name, public) values ('suspect-photos','suspect-photos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('reference-images','reference-images', true)
  on conflict (id) do nothing;

-- suspect-photos: private per device (Phase 2 tightens with auth.uid()).
create policy "suspect photos read own" on storage.objects
  for select using (bucket_id = 'suspect-photos');
create policy "suspect photos write own" on storage.objects
  for insert with check (bucket_id = 'suspect-photos');

-- reference-images: public read, server-only write.
create policy "reference images read public" on storage.objects
  for select using (bucket_id = 'reference-images');
