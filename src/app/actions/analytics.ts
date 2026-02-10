'use server'

import { createClient } from '@/lib/supabase-server'
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns'

export type TimeRange = '30d' | '90d' | 'all' | 'custom'

export interface AnalyticsSummary {
  totalSpending: number
  transactionCount: number
  trend: number // percentage change compared to previous period
  chartData: { date: string; amount: number }[]
  categoryBreakdown: { name: string; amount: number; color: string }[]
}

export async function getDashboardAnalytics(timeRange: TimeRange, customMonth?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const now = new Date()
  let startDate: Date
  let prevStartDate: Date

  if (timeRange === '30d') {
    startDate = subDays(now, 30)
    prevStartDate = subDays(startDate, 30)
  } else if (timeRange === '90d') {
    startDate = subDays(now, 90)
    prevStartDate = subDays(startDate, 90)
  } else if (timeRange === 'custom' && customMonth) {
    startDate = parseISO(`${customMonth}-01`)
    const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    // For custom month, we compare to previous month
    prevStartDate = subDays(startDate, 1) // roughly
    prevStartDate.setDate(1)
  } else {
    // All time
    startDate = new Date(0)
    prevStartDate = new Date(0)
  }

  // 1. Fetch transactions for current period
  const { data: currentTxs, error: currentError } = await supabase
    .from('transactions')
    .select('*, categories(name, color)')
    .eq('user_id', user.id)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(now, 'yyyy-MM-dd'))

  if (currentError) throw currentError

  // 2. Fetch transactions for previous period (for trend)
  const { data: prevTxs, error: prevError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', user.id)
    .gte('date', format(prevStartDate, 'yyyy-MM-dd'))
    .lt('date', format(startDate, 'yyyy-MM-dd'))

  if (prevError) throw prevError

  // 3. Process Summary
  const currentTotal = currentTxs.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const prevTotal = prevTxs.reduce((sum, tx) => sum + Number(tx.amount), 0)
  
  let trend = 0
  if (prevTotal > 0) {
    trend = ((currentTotal - prevTotal) / prevTotal) * 100
  }

  // 4. chartData (Daily Aggregation)
  const chartDataMap = new Map<string, number>()
  
  // Initialize with all days in interval if range is not "all"
  if (timeRange !== 'all') {
    const interval = eachDayOfInterval({ start: startDate, end: now })
    interval.forEach(day => {
      chartDataMap.set(format(day, 'yyyy-MM-dd'), 0)
    })
  }

  currentTxs.forEach(tx => {
    const day = tx.date
    chartDataMap.set(day, (chartDataMap.get(day) || 0) + Number(tx.amount))
  })

  const chartData = Array.from(chartDataMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 5. Category Breakdown
  const catMap = new Map<string, { amount: number; color: string }>()
  currentTxs.forEach(tx => {
    const catName = tx.categories?.name || 'Uncategorized'
    const color = tx.categories?.color || '#71717a'
    const existing = catMap.get(catName) || { amount: 0, color }
    catMap.set(catName, { amount: existing.amount + Number(tx.amount), color })
  })

  const categoryBreakdown = Array.from(catMap.entries()).map(([name, data]) => ({
    name,
    amount: data.amount,
    color: data.color
  })).sort((a, b) => b.amount - a.amount)

  return {
    totalSpending: currentTotal,
    transactionCount: currentTxs.length,
    trend,
    chartData,
    categoryBreakdown
  } as AnalyticsSummary
}
