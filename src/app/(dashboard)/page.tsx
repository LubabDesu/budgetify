import { createClient } from '@/lib/supabase-server'
import { getDashboardAnalytics } from '@/app/actions/analytics'
import { DashboardClient } from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null // Should be handled by middleware but safety first

  // 1. Fetch initial analytics (defaults to 30d)
  const initialAnalytics = await getDashboardAnalytics('30d')

  // 2. Fetch recent transactions (limit 10 for dashboard)
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      *,
      categories (id, name, color)
    `)
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(10)

  // 3. Fetch categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)

  return (
    <DashboardClient 
      user={user}
      categories={categories || []}
      initialAnalytics={initialAnalytics}
      recentTransactions={transactions || []}
    />
  )
}
