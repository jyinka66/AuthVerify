import { NextResponse } from 'next/server'
import { getBudgetStatus } from '@/lib/scan/budget-alert'

export const runtime = 'nodejs'

/**
 * GET /api/admin/budget
 *
 * Returns the current daily AI budget status. Used by monitoring
 * dashboards and alerting systems.
 */
export async function GET() {
  const status = await getBudgetStatus()
  return NextResponse.json(status)
}
