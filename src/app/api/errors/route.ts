import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ErrorReport {
  message: string
  stack?: string
  url?: string
  userAgent?: string
  deviceFingerprint?: string
  timestamp?: string
}

/**
 * Client-side error logging endpoint. Accepts error reports from the
 * error boundary and logs them. In production, integrate with Sentry
 * or write to a Supabase `error_logs` table.
 */
export async function POST(req: NextRequest) {
  let body: ErrorReport
  try {
    body = (await req.json()) as ErrorReport
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 })
  }

  console.error('[client-error]', {
    message: body.message,
    stack: body.stack?.slice(0, 2000),
    url: body.url,
    userAgent: body.userAgent?.slice(0, 200),
    deviceFingerprint: body.deviceFingerprint,
    timestamp: body.timestamp ?? new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
