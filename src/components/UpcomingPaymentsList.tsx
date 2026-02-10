'use client'

import { useState } from 'react'
import { RecurringOccurrence, RecurringRule } from '@/types/database'
import { format, isPast, isToday } from 'date-fns'
import { CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markOccurrenceAsPaid } from '@/app/actions/recurring'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface UpcomingPaymentsListProps {
  occurrences: RecurringOccurrence[]
  rules: RecurringRule[]
  title: string
}

export function UpcomingPaymentsList({ occurrences, rules, title }: UpcomingPaymentsListProps) {
  const [loadingIds, setLoadingIds] = useState<string[]>([])

  const handleMarkAsPaid = async (occurrence: RecurringOccurrence) => {
    const rule = rules.find(r => r.id === occurrence.rule_id)
    if (!rule) return

    const id = `${occurrence.rule_id}-${occurrence.date}`
    setLoadingIds(prev => [...prev, id])

    try {
      await markOccurrenceAsPaid(occurrence.rule_id, occurrence.date, rule)
      toast.success(`Marked ${occurrence.description} as paid`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark as paid')
    } finally {
      setLoadingIds(prev => prev.filter(i => i !== id))
    }
  }

  if (occurrences.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
        <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">No payments scheduled for this period.</p>
      </div>
    )
  }

  const totalAmount = occurrences.reduce((sum, occ) => sum + Number(occ.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">{title}</h3>
        <span className="text-xs font-semibold text-zinc-500">
          Total: <span className="text-white">${totalAmount.toFixed(2)}</span>
        </span>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800 overflow-hidden">
        {occurrences.map((occ) => {
          const occDate = new Date(occ.date)
          const isOverdue = isPast(occDate) && !isToday(occDate) && !occ.is_paid
          const id = `${occ.rule_id}-${occ.date}`
          const isLoading = loadingIds.includes(id)

          return (
            <div key={id} className="p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  occ.is_paid ? "bg-emerald-500/10 text-emerald-500" : 
                  isOverdue ? "bg-red-500/10 text-red-500" : "bg-zinc-800 text-zinc-400"
                )}>
                  {occ.is_paid ? <CheckCircle2 className="w-5 h-5" /> : 
                   isOverdue ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                      {occ.description}
                    </span>
                    {occ.is_modified && (
                      <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-700">
                        Modified
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {format(occDate, 'EEEE, MMM d')}
                    {isOverdue && <span className="text-red-500 ml-2 font-medium">Overdue</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="font-bold text-white">${Number(occ.amount).toFixed(2)}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">{occ.frequency}</div>
                </div>

                {!occ.is_paid ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-zinc-700 bg-zinc-900 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all font-semibold text-xs"
                    onClick={() => handleMarkAsPaid(occ)}
                    disabled={isLoading}
                  >
                    {isLoading ? '...' : 'Mark Paid'}
                  </Button>
                ) : (
                  <div className="w-[84px] text-right text-emerald-500 flex items-center justify-end gap-1 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Paid
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
