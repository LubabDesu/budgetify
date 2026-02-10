'use client'

import { RecurringRule } from '@/types/database'
import { format } from 'date-fns'
import { Calendar, MoreVertical, Edit2, Trash2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface RecurringRuleCardProps {
  rule: RecurringRule
  nextOccurrence?: string
  onEdit?: (rule: RecurringRule) => void
  onDelete?: (rule: RecurringRule) => void
}

export function RecurringRuleCard({ rule, nextOccurrence, onEdit, onDelete }: RecurringRuleCardProps) {
  const category = rule.categories

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: category?.color || '#3f3f46' }}
          >
            {category?.name?.[0]?.toUpperCase() || <Tag className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
              {rule.description}
            </h3>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
              <span className="capitalize">{rule.frequency}</span>
              <span>•</span>
              <span>Started {format(new Date(rule.start_date), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <div className="text-lg font-bold text-white">
              ${Number(rule.amount).toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              Per {rule.frequency.replace('ly', '')}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-400">
              <DropdownMenuItem onClick={() => onEdit?.(rule)} className="hover:bg-zinc-800 hover:text-white cursor-pointer">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Rule
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete?.(rule)} 
                className="hover:bg-red-500/10 hover:text-red-400 cursor-pointer text-red-500/80"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Rule
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
          <span>Next: <span className="text-zinc-200">{nextOccurrence ? format(new Date(nextOccurrence), 'MMM d, yyyy') : 'No upcoming'}</span></span>
        </div>
        {rule.end_date && (
          <div className="text-[10px] bg-zinc-800/50 text-zinc-500 px-2 py-0.5 rounded border border-zinc-800">
            Ends {format(new Date(rule.end_date), 'MMM d, yyyy')}
          </div>
        )}
      </div>
    </div>
  )
}
