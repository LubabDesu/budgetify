import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMessage } from '@/lib/telegram'

type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

type TransactionForNudge = {
  category_id?: string | null
  date: string
}

function periodRange(dateStr: string, period: BudgetPeriod) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const base = new Date(year, month - 1, day)
  let start = new Date(base)
  let end = new Date(base)

  if (period === 'daily') {
    end.setDate(end.getDate() + 1)
  } else if (period === 'weekly') {
    const weekday = start.getDay()
    const offset = (weekday + 6) % 7
    start.setDate(start.getDate() - offset)
    end = new Date(start)
    end.setDate(end.getDate() + 7)
  } else if (period === 'monthly') {
    start = new Date(base.getFullYear(), base.getMonth(), 1)
    end = new Date(base.getFullYear(), base.getMonth() + 1, 1)
  } else {
    start = new Date(base.getFullYear(), 0, 1)
    end = new Date(base.getFullYear() + 1, 0, 1)
  }

  const toStr = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return { start: toStr(start), end: toStr(end) }
}

function periodLabel(period: BudgetPeriod) {
  if (period === 'daily') return 'today'
  if (period === 'weekly') return 'this week'
  if (period === 'yearly') return 'this year'
  return 'this month'
}

export async function sendBudgetNudgesForTransactions(
  supabase: SupabaseClient,
  userId: string,
  chatId: number,
  transactions: TransactionForNudge[],
) {
  const categoryIds = Array.from(
    new Set(
      transactions
        .map((value) => value.category_id)
        .filter((value): value is string => Boolean(value)),
    ),
  )

  if (categoryIds.length === 0) return

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, budget_limit, budget_period')
    .eq('user_id', userId)
    .in('id', categoryIds)
    .not('budget_limit', 'is', null)

  if (!categories || categories.length === 0) return

  for (const category of categories) {
    const sampleTx = transactions.find((value) => value.category_id === category.id)
    const referenceDate = sampleTx?.date || new Date().toISOString().split('T')[0]
    const period = (category.budget_period || 'monthly') as BudgetPeriod
    const budgetLimit = Number(category.budget_limit)
    if (!Number.isFinite(budgetLimit) || budgetLimit <= 0) continue

    const { start, end } = periodRange(referenceDate, period)
    const { data: periodTransactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('category_id', category.id)
      .gte('date', start)
      .lt('date', end)

    const spent = (periodTransactions || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    )
    const progress = (spent / budgetLimit) * 100
    const thresholds = [80, 100].filter((level) => progress >= level)

    for (const threshold of thresholds) {
      const { data: existing } = await supabase
        .from('telegram_budget_nudges')
        .select('id')
        .eq('user_id', userId)
        .eq('category_id', category.id)
        .eq('period_start', start)
        .eq('nudge_level', threshold)
        .maybeSingle()

      if (existing) continue

      const { error: insertError } = await supabase
        .from('telegram_budget_nudges')
        .insert({
          user_id: userId,
          category_id: category.id,
          period_start: start,
          nudge_level: threshold,
        })

      if (insertError) continue

      const message =
        threshold === 100
          ? `🚨 Budget nudge: <b>${category.name}</b> is over budget ${periodLabel(period)}.\nSpent: <b>$${spent.toFixed(2)}</b> / Budget: <b>$${budgetLimit.toFixed(2)}</b>.`
          : `⚠️ Budget nudge: <b>${category.name}</b> hit ${threshold}% ${periodLabel(period)}.\nSpent: <b>$${spent.toFixed(2)}</b> / Budget: <b>$${budgetLimit.toFixed(2)}</b>.`
      await sendMessage(chatId, message)
    }
  }
}

export function buildWeeklyDigestMessage(
  rows: Array<{ amount: number; description: string | null; categoryName: string | null }>,
) {
  if (rows.length === 0) return ''

  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const byCategory = new Map<string, number>()
  const byMerchant = new Map<string, number>()

  for (const row of rows) {
    const category = row.categoryName || 'Uncategorized'
    byCategory.set(category, (byCategory.get(category) || 0) + Number(row.amount || 0))

    const merchant = row.description?.trim() || 'Unknown'
    byMerchant.set(merchant, (byMerchant.get(merchant) || 0) + Number(row.amount || 0))
  }

  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const topMerchants = Array.from(byMerchant.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const categoryLines = topCategories
    .map(([name, amount]) => `• ${name}: $${amount.toFixed(2)}`)
    .join('\n')
  const merchantLines = topMerchants
    .map(([name, amount]) => `• ${name}: $${amount.toFixed(2)}`)
    .join('\n')

  return [
    '📊 <b>Weekly Digest</b>',
    '',
    `Transactions: <b>${rows.length}</b>`,
    `Total spend: <b>$${total.toFixed(2)}</b>`,
    '',
    '<b>Top categories</b>',
    categoryLines || '• None',
    '',
    '<b>Top merchants</b>',
    merchantLines || '• None',
  ].join('\n')
}
