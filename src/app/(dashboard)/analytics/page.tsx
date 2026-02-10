import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase-server'
import { format, subDays } from 'date-fns'
import { DollarSign, CalendarDays, TrendingUp, Layers } from 'lucide-react'
import { AnalyticsQueryBox } from '@/components/AnalyticsQueryBox'

function currency(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const today = new Date()
  const startDate = subDays(today, 29)

  const { data: rows } = await supabase
    .from('transactions')
    .select('amount, date, description, categories(name)')
    .eq('user_id', user.id)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(today, 'yyyy-MM-dd'))

  const transactions = rows || []
  const totalSpending = transactions.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const averageDailySpending = totalSpending / 30

  const largestTransaction = transactions.reduce<{
    amount: number
    description: string
    date: string
  } | null>((largest, row) => {
    const amount = Number(row.amount || 0)
    if (!largest || amount > largest.amount) {
      return {
        amount,
        description: row.description || 'No description',
        date: row.date,
      }
    }
    return largest
  }, null)

  const activeDays = new Set(transactions.map((row) => row.date)).size

  const categoryTotals = new Map<string, number>()
  for (const row of transactions) {
    const categoryName = (row.categories as { name?: string } | null)?.name || 'Uncategorized'
    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + Number(row.amount || 0))
  }

  const topCategoryEntry = Array.from(categoryTotals.entries()).sort(
    (first, second) => second[1] - first[1]
  )[0]
  const topCategoryName = topCategoryEntry?.[0] || 'N/A'
  const topCategoryAmount = topCategoryEntry?.[1] || 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-zinc-500 mt-1">Quick insights from your last 30 days.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Total Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{currency(totalSpending)}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              Avg Daily Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{currency(averageDailySpending)}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Largest Expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {largestTransaction ? currency(largestTransaction.amount) : '$0.00'}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              {largestTransaction
                ? `${largestTransaction.description} on ${largestTransaction.date}`
                : 'No transactions yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Top Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{topCategoryName}</div>
            <p className="text-xs text-zinc-500 mt-2">
              {currency(topCategoryAmount)} across {activeDays} active day{activeDays === 1 ? '' : 's'}
            </p>
          </CardContent>
        </Card>
      </div>

      <AnalyticsQueryBox />
    </div>
  )
}
