import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createManufacturerProfile, getManufacturerByUser } from '@/lib/scan/manufacturer-store'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RegisterBody {
  companyName: string
  country: string
  contactEmail: string
  phone?: string
  regulatoryLicenseNumber?: string
  website?: string
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Add credentials to .env to enable manufacturer registration.' },
      { status: 503 }
    )
  }

  const supabase = await createServerClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
  }

  // Get the authenticated user.
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Sign in required to register a manufacturer profile.' }, { status: 401 })
  }

  let body: RegisterBody
  try {
    body = (await req.json()) as RegisterBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.companyName?.trim() || !body.country?.trim() || !body.contactEmail?.trim()) {
    return NextResponse.json(
      { error: 'Company name, country, and contact email are required.' },
      { status: 400 }
    )
  }

  // Check if the user already has a manufacturer profile.
  const existing = await getManufacturerByUser(user.id)
  if (existing) {
    return NextResponse.json({ error: 'You already have a manufacturer profile.', manufacturer: existing }, { status: 409 })
  }

  const id = await createManufacturerProfile({
    userId: user.id,
    companyName: body.companyName.trim(),
    country: body.country.trim(),
    contactEmail: body.contactEmail.trim(),
    phone: body.phone?.trim() || undefined,
    regulatoryLicenseNumber: body.regulatoryLicenseNumber?.trim() || undefined,
    website: body.website?.trim() || undefined,
  })

  if (!id) {
    return NextResponse.json({ error: 'Failed to create manufacturer profile.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, manufacturerId: id })
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ manufacturer: null, configured: false })
  }

  const supabase = await createServerClient()
  if (!supabase) return NextResponse.json({ manufacturer: null, configured: false })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ manufacturer: null, configured: true })

  const manufacturer = await getManufacturerByUser(user.id)
  return NextResponse.json({ manufacturer, configured: true })
}
