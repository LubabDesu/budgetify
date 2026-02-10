import type { RecurringRule, RecurringFrequency } from '@/types/database'

// ============ Helper: Expand Rule into Occurrences ============

export function getNextOccurrences(
  rule: RecurringRule,
  startDate: Date,
  endDate: Date
): Date[] {
  const occurrences: Date[] = []
  const ruleStart = new Date(rule.start_date)
  const ruleEnd = rule.end_date ? new Date(rule.end_date) : null

  // Start from the rule's start date or the query start, whichever is later
  let current = new Date(Math.max(ruleStart.getTime(), startDate.getTime()))
  
  // Align to the first occurrence on or after 'current'
  current = alignToNextOccurrence(ruleStart, current, rule.frequency, rule.interval)

  while (current <= endDate) {
    if (ruleEnd && current > ruleEnd) break
    occurrences.push(new Date(current))
    current = addInterval(current, rule.frequency, rule.interval)
  }

  return occurrences
}

function alignToNextOccurrence(
  ruleStart: Date,
  targetDate: Date,
  frequency: RecurringFrequency,
  interval: number
): Date {
  let current = new Date(ruleStart)
  while (current < targetDate) {
    current = addInterval(current, frequency, interval)
  }
  return current
}

function addInterval(date: Date, frequency: RecurringFrequency, interval: number): Date {
  const result = new Date(date)
  switch (frequency) {
    case 'daily':
      result.setDate(result.getDate() + interval)
      break
    case 'weekly':
      result.setDate(result.getDate() + (7 * interval))
      break
    case 'monthly':
      result.setMonth(result.getMonth() + interval)
      break
    case 'yearly':
      result.setFullYear(result.getFullYear() + interval)
      break
  }
  return result
}

// ============ Calculate Yearly Cost ============

export function calculateYearlyCost(rules: RecurringRule[]): number {
  return rules.reduce((total, rule) => {
    let occurrencesPerYear: number
    switch (rule.frequency) {
      case 'daily':
        occurrencesPerYear = 365 / rule.interval
        break
      case 'weekly':
        occurrencesPerYear = 52 / rule.interval
        break
      case 'monthly':
        occurrencesPerYear = 12 / rule.interval
        break
      case 'yearly':
        occurrencesPerYear = 1 / rule.interval
        break
    }
    return total + (rule.amount * occurrencesPerYear)
  }, 0)
}
