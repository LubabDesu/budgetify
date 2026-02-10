import { createClient } from '@/lib/supabase-server'
import { getRecurringRules, getUpcomingOccurrences } from '@/app/actions/recurring'
import { calculateYearlyCost } from '@/lib/recurring'
import { RecurringRuleCard } from '@/components/RecurringRuleCard'
import { UpcomingPaymentsList } from '@/components/UpcomingPaymentsList'
import { SubscriptionsClient } from '@/components/SubscriptionsClient'
import { RecurringRuleForm } from '@/components/RecurringRuleForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, CreditCard, CalendarDays, TrendingDown } from 'lucide-react'

export default async function SubscriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch data
  const rules = await getRecurringRules()
  const upcoming30 = await getUpcomingOccurrences(30)
  const upcoming90 = await getUpcomingOccurrences(90)
  
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)

  const yearlyCost = calculateYearlyCost(rules)

  return (
    <SubscriptionsClient
      initialRules={rules}
      upcoming30={upcoming30}
      upcoming90={upcoming90}
      categories={categories || []}
      yearlyCost={yearlyCost}
    />
  )
}
