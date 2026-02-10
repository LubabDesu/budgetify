'use server'

import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendBudgetNudgesForTransactions } from '@/lib/telegram-insights'
import { revalidatePath } from 'next/cache'
import type { Transaction, TransactionItem } from '@/types/database'


// Fetch all transactions (no limit)
export async function getAllTransactions() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
      
  const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (id, name, color),
        items:transaction_items (*)
      `)
      .eq('user_id', user.user?.id)
      .order('date', { ascending: false })

  return { transactions: transactions as Transaction[], error }
}

export async function createTransactionWithItems(
  header: Omit<Transaction, 'id' | 'user_id' | 'created_at'>,
  items: Omit<TransactionItem, 'id' | 'transaction_id' | 'created_at'>[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Insert the parent transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      ...header,
      user_id: user.id
    })
    .select()
    .single()

  if (txError) throw txError

  // 2. Insert the child items if any
  if (items.length > 0) {
    const itemsToInsert = items.map(item => ({
      ...item,
      transaction_id: transaction.id
    }))

    const { error: itemsError } = await supabase
      .from('transaction_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError
  }

  if (transaction.category_id) {
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', user.id)
      .single()

    if (profile?.telegram_chat_id) {
      await sendBudgetNudgesForTransactions(
        admin,
        user.id,
        Number(profile.telegram_chat_id),
        [{ category_id: transaction.category_id, date: transaction.date }],
      )
    }
  }

  revalidatePath('/transactions')
  revalidatePath('/')
  return { success: true, id: transaction.id }
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  // Refresh the page data automatically
  revalidatePath('/transactions') 
}

export async function editTransaction(transaction: Transaction, items?: (Omit<TransactionItem, 'transaction_id' | 'created_at' | 'id'> & { id?: string })[]) {
  const supabase = await createClient()

  // 1. Update the parent transaction
  // Remove the joined categories, items, and metadata before updating
  const updateData: Partial<Transaction> = { ...transaction }
  delete updateData.categories
  delete updateData.items
  delete updateData.created_at

  const { error: txError } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', transaction.id)

  if (txError) {
    console.error('Update error:', txError)
    throw new Error(txError.message)
  }

  // 2. Synchronize line items if provided
  if (items) {
    // A. Get current IDs from database for this transaction
    const { data: currentDbItems } = await supabase
      .from('transaction_items')
      .select('id')
      .eq('transaction_id', transaction.id)
    
    const dbIds = (currentDbItems || []).map(i => i.id)
    const incomingIds = items.filter(i => i.id).map(i => i.id)

    // B. Identify items to delete (in DB but not in incoming)
    const idsToDelete = dbIds.filter(id => !incomingIds.includes(id))
    if (idsToDelete.length > 0) {
      await supabase.from('transaction_items').delete().in('id', idsToDelete)
    }

    // C. Separate updates and inserts
    const toUpdate = items.filter(i => i.id)
    const toInsert = items.filter(i => !i.id).map(i => ({
      ...i,
      transaction_id: transaction.id
    }))

    // D. Perform updates
    for (const item of toUpdate) {
      const { id, ...itemData } = item
      await supabase.from('transaction_items').update(itemData).eq('id', id)
    }

    // E. Perform inserts
    if (toInsert.length > 0) {
      await supabase.from('transaction_items').insert(toInsert)
    }
  }

  revalidatePath('/transactions') 
  revalidatePath('/') 
}
