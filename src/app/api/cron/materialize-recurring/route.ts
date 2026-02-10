import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getNextOccurrences } from '@/lib/recurring'
import { RecurringRule } from '@/types/database'

export async function GET(request: Request) {
  // Verify Cron Auth (standard Vercel Cron header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = await createClient()

  // 1. Get all active rules
  const { data: rules, error: rulesError } = await supabase
    .from('recurring_rules')
    .select('*')
  
  if (rulesError || !rules) {
    return NextResponse.json({ error: rulesError?.message || 'No rules found' }, { status: 500 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const createdTransactions = []

  // 2. Process each rule
  for (const rule of rules as RecurringRule[]) {
    // Check if today is an occurrence date
    const occurrences = getNextOccurrences(rule, today, today)
    
    if (occurrences.length > 0) {
      // 3. Check if already materialized or deleted
      const { data: exception } = await supabase
        .from('recurring_exceptions')
        .select('*')
        .eq('rule_id', rule.id)
        .eq('occurrence_date', todayStr)
        .single()

      if (exception) {
        // Already handled (paid, deleted, or modified)
        continue
      }

      // 4. Materialize!
      // First create the transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: rule.user_id,
          amount: rule.amount,
          description: rule.description,
          category_id: rule.category_id,
          date: todayStr
        })
        .select()
        .single()

      if (txError) {
        console.error(`Error materializing rule ${rule.id}:`, txError)
        continue
      }

      // Then mark as paid in exceptions
      await supabase
        .from('recurring_exceptions')
        .insert({
          rule_id: rule.id,
          occurrence_date: todayStr,
          action: 'paid',
          transaction_id: transaction.id
        })

      createdTransactions.push({ rule_id: rule.id, transaction_id: transaction.id })
    }
  }

  return NextResponse.json({
    message: 'Cron job completed',
    processed: rules.length,
    created: createdTransactions.length,
    transactions: createdTransactions
  })
}
