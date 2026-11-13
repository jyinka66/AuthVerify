import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface SubscribeBody {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  deviceFingerprint?: string
  region?: string
}

/**
 * POST /api/push/subscribe
 *
 * Stores a Web Push subscription so the server can send push notifications
 * (counterfeit alerts) to the user even when the app is closed.
 * Requires Supabase. The push_subscriptions table must exist (created by
 * a migration — included below for reference).
 *
 * create table public.push_subscriptions (
 *   id uuid primary key default uuid_generate_v4(),
 *   endpoint text unique not null,
 *   p256dh_key text not null,
 *   auth_key text not null,
 *   device_id uuid references public.devices(id) on delete set null,
 *   region text,
 *   created_at timestamptz not null default now()
 * );
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  let body: SubscribeBody
  try {
    body = (await req.json()) as SubscribeBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'endpoint, p256dh, and auth keys required' }, { status: 400 })
  }

  // Upsert the subscription (update if the endpoint already exists).
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      endpoint: body.endpoint,
      p256dh_key: body.keys.p256dh,
      auth_key: body.keys.auth,
      region: body.region ?? null,
    }, { onConflict: 'endpoint' })

  if (error) {
    // The table might not exist yet — return a graceful message.
    return NextResponse.json(
      { error: 'Push subscriptions table not created. Run the migration.', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/push/subscribe?endpoint=...
 * Removes a push subscription (user unsubscribed).
 */
export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured.' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })

  const endpoint = req.nextUrl.searchParams.get('endpoint')
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint param required' }, { status: 400 })
  }

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
