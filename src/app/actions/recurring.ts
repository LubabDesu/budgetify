'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { RecurringRule, RecurringException, RecurringOccurrence, RecurringFrequency } from '@/types/database'

import { getNextOccurrences } from '@/lib/recurring'

// ============ Server Actions: CRUD ============

// ============ Server Actions: CRUD ============

export async function getRecurringRules() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*, categories(id, name, color)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as RecurringRule[]
}

export async function createRecurringRule(rule: Omit<RecurringRule, 'id' | 'user_id' | 'created_at'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({ ...rule, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  revalidatePath('/subscriptions')
  return data as RecurringRule
}

export async function updateRecurringRule(id: string, updates: Partial<RecurringRule>) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('recurring_rules')
    .update(updates)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/subscriptions')
}

export async function deleteRecurringRule(
  id: string, 
  mode: 'all' | 'future' | 'this',
  occurrenceDate?: string
) {
  const supabase = await createClient()

  if (mode === 'all') {
    // Delete the entire rule (cascade deletes exceptions)
    const { error } = await supabase
      .from('recurring_rules')
      .delete()
      .eq('id', id)
    if (error) throw error
  } else if (mode === 'future' && occurrenceDate) {
    // Set end_date to day before the occurrence
    const endDate = new Date(occurrenceDate)
    endDate.setDate(endDate.getDate() - 1)
    const { error } = await supabase
      .from('recurring_rules')
      .update({ end_date: endDate.toISOString().split('T')[0] })
      .eq('id', id)
    if (error) throw error
  } else if (mode === 'this' && occurrenceDate) {
    // Insert a 'deleted' exception
    const { error } = await supabase
      .from('recurring_exceptions')
      .upsert({
        rule_id: id,
        occurrence_date: occurrenceDate,
        action: 'deleted'
      }, { onConflict: 'rule_id,occurrence_date' })
    if (error) throw error
  }

  revalidatePath('/subscriptions')
}

// ============ Server Actions: Exceptions ============

export async function getExceptionsForRule(ruleId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('recurring_exceptions')
    .select('*')
    .eq('rule_id', ruleId)

  if (error) throw error
  return data as RecurringException[]
}

export async function markOccurrenceAsPaid(ruleId: string, occurrenceDate: string, rule: RecurringRule) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Create a real transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      amount: rule.amount,
      description: rule.description,
      category_id: rule.category_id,
      date: occurrenceDate
    })
    .select()
    .single()

  if (txError) throw txError

  // 2. Create a 'paid' exception linked to the transaction
  const { error: exError } = await supabase
    .from('recurring_exceptions')
    .upsert({
      rule_id: ruleId,
      occurrence_date: occurrenceDate,
      action: 'paid',
      transaction_id: transaction.id
    }, { onConflict: 'rule_id,occurrence_date' })

  if (exError) throw exError

  revalidatePath('/subscriptions')
  revalidatePath('/transactions')
  return transaction
}

export async function editOccurrence(
  ruleId: string, 
  occurrenceDate: string, 
  data: { amount?: number; description?: string }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('recurring_exceptions')
    .upsert({
      rule_id: ruleId,
      occurrence_date: occurrenceDate,
      action: 'modified',
      modified_amount: data.amount,
      modified_description: data.description
    }, { onConflict: 'rule_id,occurrence_date' })

  if (error) throw error
  revalidatePath('/subscriptions')
}

// ============ Server Actions: Upcoming Occurrences ============

export async function getUpcomingOccurrences(days: number): Promise<RecurringOccurrence[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Get all active rules
  const { data: rules, error: rulesError } = await supabase
    .from('recurring_rules')
    .select('*, categories(id, name, color)')
    .eq('user_id', user.id)

  if (rulesError) throw rulesError
  if (!rules || rules.length === 0) return []

  // 2. Get all exceptions for these rules
  const ruleIds = rules.map(r => r.id)
  const { data: exceptions, error: exError } = await supabase
    .from('recurring_exceptions')
    .select('*')
    .in('rule_id', ruleIds)

  if (exError) throw exError

  // 3. Expand rules into occurrences
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + days)

  const allOccurrences: RecurringOccurrence[] = []

  for (const rule of rules) {
    const dates = getNextOccurrences(rule as RecurringRule, today, endDate)
    
    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0]
      const exception = exceptions?.find(
        e => e.rule_id === rule.id && e.occurrence_date === dateStr
      )

      // Skip deleted occurrences
      if (exception?.action === 'deleted') continue

      allOccurrences.push({
        rule_id: rule.id,
        date: dateStr,
        description: exception?.modified_description || rule.description,
        amount: exception?.modified_amount || rule.amount,
        category_id: rule.category_id,
        frequency: rule.frequency,
        is_paid: exception?.action === 'paid',
        is_modified: exception?.action === 'modified',
        is_deleted: false,
        linked_transaction_id: exception?.transaction_id
      })
    }
  }

  // Sort by date
  allOccurrences.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return allOccurrences
}
