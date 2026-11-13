-- AuthVerify — Manufacturer Registry Schema
-- Run this AFTER schema.sql in the Supabase SQL editor.
--
-- This creates the ground-truth data foundation: manufacturers register
-- their companies and products, upload official reference images, and
-- specify security features. The verification flow prefers this data
-- over web-searched references when available.

-- ============================================================================
-- TABLES
-- ============================================================================

-- Manufacturers (companies that register to provide ground-truth data)
create table if not exists public.manufacturers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  company_name text not null,
  country text not null,
  contact_email text not null,
  phone text,
  regulatory_license_number text,
  website text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists manufacturers_user_idx on public.manufacturers (user_id);
create index if not exists manufacturers_company_idx on public.manufacturers (company_name);

-- Products registered by manufacturers
create table if not exists public.manufacturer_products (
  id uuid primary key default uuid_generate_v4(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  product_name text not null,
  brand text not null,
  category text not null,
  barcode text,
  pack_size text,
  description text,
  security_features_json jsonb,
  known_fake_indicators_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists products_manufacturer_idx on public.manufacturer_products (manufacturer_id);
create index if not exists products_brand_idx on public.manufacturer_products (brand);
create index if not exists products_barcode_idx on public.manufacturer_products (barcode);

-- Official reference images for each product (ground truth)
create table if not exists public.product_reference_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.manufacturer_products(id) on delete cascade,
  storage_path text,
  image_url text not null,
  angle text check (angle in ('front','back','side','top','bottom','detail','other')),
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ref_images_product_idx on public.product_reference_images (product_id);

-- Cost tracking log (per AI call)
create table if not exists public.cost_log (
  id uuid primary key default uuid_generate_v4(),
  device_id uuid references public.devices(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  scan_id uuid,
  service text not null check (service in ('vlm','web_search','image_search','llm')),
  estimated_cost_usd numeric(10,4) not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cost_log_device_idx on public.cost_log (device_id, created_at desc);
create index if not exists cost_log_created_idx on public.cost_log (created_at desc);

-- VLM response cache (content-hash based — skip re-analysis of identical images)
create table if not exists public.vlm_cache (
  hash text primary key,
  result_json jsonb not null,
  prompt_version text not null default 'v1',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists vlm_cache_expires_idx on public.vlm_cache (expires_at);

-- User feedback on verdicts (for model improvement)
create table if not exists public.verdict_feedback (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid references public.scans(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  feedback text not null check (feedback in ('correct','incorrect','partially_correct')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_scan_idx on public.verdict_feedback (scan_id);

-- Web Push subscriptions (for sending counterfeit alert push notifications)
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  endpoint text unique not null,
  p256dh_key text not null,
  auth_key text not null,
  device_id uuid references public.devices(id) on delete set null,
  region text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_region_idx on public.push_subscriptions (region);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.manufacturers enable row level security;
alter table public.manufacturer_products enable row level security;
alter table public.product_reference_images enable row level security;
alter table public.cost_log enable row level security;
alter table public.vlm_cache enable row level security;
alter table public.verdict_feedback enable row level security;

-- manufacturers: public read, write only by the owning user.
create policy "manufacturers read all" on public.manufacturers
  for select using (true);
create policy "manufacturers insert own" on public.manufacturers
  for insert with check (auth.uid() = user_id);
create policy "manufacturers update own" on public.manufacturers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manufacturers delete own" on public.manufacturers
  for delete using (auth.uid() = user_id);

-- manufacturer_products: public read (verification flow needs to look them up),
-- write only by the owning manufacturer's user.
create policy "products read all" on public.manufacturer_products
  for select using (true);
create policy "products insert own" on public.manufacturer_products
  for insert with check (
    exists (
      select 1 from public.manufacturers m
      where m.id = manufacturer_id and m.user_id = auth.uid()
    )
  );
create policy "products update own" on public.manufacturer_products
  for update using (
    exists (
      select 1 from public.manufacturers m
      where m.id = manufacturer_id and m.user_id = auth.uid()
    )
  );
create policy "products delete own" on public.manufacturer_products
  for delete using (
    exists (
      select 1 from public.manufacturers m
      where m.id = manufacturer_id and m.user_id = auth.uid()
    )
  );

-- product_reference_images: public read, write only by the owning manufacturer.
create policy "ref images read all" on public.product_reference_images
  for select using (true);
create policy "ref images insert own" on public.product_reference_images
  for insert with check (
    exists (
      select 1 from public.manufacturer_products p
      join public.manufacturers m on m.id = p.manufacturer_id
      where p.id = product_id and m.user_id = auth.uid()
    )
  );
create policy "ref images delete own" on public.product_reference_images
  for delete using (
    exists (
      select 1 from public.manufacturer_products p
      join public.manufacturers m on m.id = p.manufacturer_id
      where p.id = product_id and m.user_id = auth.uid()
    )
  );

-- cost_log: readable by the owning device/user, writable via service role.
create policy "cost_log read own" on public.cost_log
  for select using (
    auth.uid() = user_id or device_id is not null
  );

-- vlm_cache: readable by all, writable via service role only.
create policy "vlm_cache read all" on public.vlm_cache
  for select using (true);

-- verdict_feedback: readable by all (community learning), writable by any authed user.
create policy "feedback read all" on public.verdict_feedback
  for select using (true);
create policy "feedback insert own" on public.verdict_feedback
  for insert with check (true);

-- push_subscriptions: readable via service role only, writable by any client (subscription is public).
create policy "push_subs insert any" on public.push_subscriptions
  for insert with check (true);
create policy "push_subs delete own" on public.push_subscriptions
  for delete using (true);
create policy "push_subs update own" on public.push_subscriptions
  for update using (true) with check (true);
