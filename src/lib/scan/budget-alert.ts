import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Budget monitoring and alerting.
 *
 * The in-memory rate limiter in rate-limit.ts already blocks AI calls when
 * the daily budget (2000 calls) is exhausted. This module adds:
 * - Database-backed budget checking (survives restarts, shared across instances)
 * - Threshold alerts (logs warnings at 80% and 90% of the daily budget)
 * - A status endpoint for monitoring dashboards
 */

const DAILY_AI_BUDGET = 2000
const WARNING_THRESHOLD = 0.8  // 80%
const CRITICAL_THRESHOLD = 0.9 // 90%

export interface BudgetStatus {
  budget: number
  used: number
  remaining: number
  percentUsed: number
  level: 'ok' | 'warning' | 'critical' | 'exhausted'
}

/**
 * Check today's AI spend from the cost_log table.
 * Falls back to 0 if Supabase isn't configured or the table doesn't exist.
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    return { budget: DAILY_AI_BUDGET, used: 0, remaining: DAILY_AI_BUDGET, percentUsed: 0, level: 'ok' }
  }

  // Sum today's costs from the cost_log table.
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  try {
    const { data, error } = await supabase
      .from('cost_log')
      .select('estimated_cost_usd')
      .gte('created_at', today.toISOString())

    if (error || !data) {
      return { budget: DAILY_AI_BUDGET, used: 0, remaining: DAILY_AI_BUDGET, percentUsed: 0, level: 'ok' }
    }

    // Count the number of AI calls (rows) as the budget metric.
    const used = data.length
    const remaining = Math.max(0, DAILY_AI_BUDGET - used)
    const percentUsed = used / DAILY_AI_BUDGET

    let level: BudgetStatus['level'] = 'ok'
    if (percentUsed >= 1) level = 'exhausted'
    else if (percentUsed >= CRITICAL_THRESHOLD) level = 'critical'
    else if (percentUsed >= WARNING_THRESHOLD) level = 'warning'

    return { budget: DAILY_AI_BUDGET, used, remaining, percentUsed, level }
  } catch {
    return { budget: DAILY_AI_BUDGET, used: 0, remaining: DAILY_AI_BUDGET, percentUsed: 0, level: 'ok' }
  }
}

/**
 * Log a warning if the budget is approaching its limit.
 * Called from scan routes before processing AI-heavy requests.
 */
export async function checkBudgetAlerts(): Promise<void> {
  const status = await getBudgetStatus()

  if (status.level === 'critical') {
    console.warn(`[budget] CRITICAL: ${status.used}/${status.budget} AI calls used today (${Math.round(status.percentUsed * 100)}%). Approaching budget limit.`)
  } else if (status.level === 'warning') {
    console.warn(`[budget] WARNING: ${status.used}/${status.budget} AI calls used today (${Math.round(status.percentUsed * 100)}%).`)
  }
}
