// Database types matching your Supabase schema

export interface Category {
  id: string
  user_id: string
  name: string
  icon?: string
  color?: string
  budget_limit?: number
  budget_period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  created_at: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  description: string
  amount: number
  category_id?: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  description?: string
  category_id?: string
  date: string
  receipt_url?: string
  created_at: string
  // Joined/Nested data
  categories?: Category
  items?: TransactionItem[]
}

export interface TransactionTemplate {
  id: string
  user_id: string
  name: string
  amount?: number
  description?: string
  category_id?: string
  created_at: string
}

// Forms and API responses
export interface TransactionFormData {
  amount: string | number
  description: string
  category_id: string
  date: string
  receipt_url?: string
}

export interface ReceiptScanResult {
  amount: number
  date: string
  description: string
  category: string
}

// Recurring Payments
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringRule {
  id: string
  user_id: string
  description: string
  amount: number
  category_id?: string
  frequency: RecurringFrequency
  interval: number
  start_date: string
  end_date?: string
  created_at: string
  // Joined data
  categories?: Category
}

export type RecurringExceptionAction = 'deleted' | 'modified' | 'paid'

export interface RecurringException {
  id: string
  rule_id: string
  occurrence_date: string
  action: RecurringExceptionAction
  modified_amount?: number
  modified_description?: string
  transaction_id?: string
  created_at: string
}

// Virtual occurrence (expanded from a rule)
export interface RecurringOccurrence {
  rule_id: string
  date: string
  description: string
  amount: number
  category_id?: string
  frequency: RecurringFrequency
  is_paid: boolean
  is_modified: boolean
  is_deleted: boolean
  linked_transaction_id?: string
}
