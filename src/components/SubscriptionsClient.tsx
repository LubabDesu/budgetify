'use client'

import { useState } from 'react'
import { RecurringRule, RecurringOccurrence, Category } from '@/types/database'
import { RecurringRuleCard } from '@/components/RecurringRuleCard'
import { UpcomingPaymentsList } from '@/components/UpcomingPaymentsList'
import { RecurringRuleForm } from '@/components/RecurringRuleForm'
import { RecurringDeleteDialog } from '@/components/RecurringDeleteDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, CreditCard, CalendarDays, TrendingDown } from 'lucide-react'
import { deleteRecurringRule } from '@/app/actions/recurring'
import { toast } from 'sonner'

interface SubscriptionsClientProps {
  initialRules: RecurringRule[]
  upcoming30: RecurringOccurrence[]
  upcoming90: RecurringOccurrence[]
  categories: Category[]
  yearlyCost: number
}

export function SubscriptionsClient({
  initialRules,
  upcoming30,
  upcoming90,
  categories,
  yearlyCost
}: SubscriptionsClientProps) {
  const [rules, setRules] = useState(initialRules)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<RecurringRule | null>(null)

  const handleEdit = (rule: RecurringRule) => {
    setEditingRule(rule)
  }

  const handleDelete = (rule: RecurringRule) => {
    setDeletingRule(rule)
  }

  const confirmDelete = async (mode: 'all' | 'future' | 'this') => {
    if (!deletingRule) return
    
    try {
      await deleteRecurringRule(deletingRule.id, mode)
      toast.success('Subscription deleted')
      setDeletingRule(null)
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete subscription')
    }
  }



  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Subscriptions</h1>
          <p className="text-zinc-500 mt-1">Manage your recurring payments and subscriptions.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-500 font-bold gap-2">
              <Plus className="w-4 h-4" />
              Add Subscription
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-900 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Subscription</DialogTitle>
            </DialogHeader>
            <RecurringRuleForm 
              categories={categories} 
              onSuccess={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Annual Overview Card */}
      <Card className="bg-zinc-900 border-zinc-800 border-t-4 border-t-emerald-500 shadow-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <TrendingDown className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Estimated Yearly Spend</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white tracking-tight">
                  ${yearlyCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 0}
                </span>
                <span className="text-zinc-500 text-sm font-medium">/ year</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-zinc-800">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Weekly</p>
              <p className="text-lg font-bold text-zinc-200">${(yearlyCost / 52).toFixed(2) ?? 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Monthly</p>
              <p className="text-lg font-bold text-zinc-200">${(yearlyCost / 12).toFixed(2) ?? 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Daily Avg</p>
              <p className="text-lg font-bold text-zinc-200">${(yearlyCost / 365).toFixed(2) ?? 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Active Rules</p>
              <p className="text-lg font-bold text-emerald-400">{initialRules.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Active Rules */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              Active Rules
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {initialRules.map((rule) => {
              const nextOcc = [...upcoming30, ...upcoming90].find(o => o.rule_id === rule.id && !o.is_paid)?.date
              
              return (
                <RecurringRuleCard 
                  key={rule.id} 
                  rule={rule} 
                  nextOccurrence={nextOcc}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )
            })}
            {initialRules.length === 0 && (
              <div className="col-span-full py-12 text-center bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl">
                <CreditCard className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-500">No active recurring rules yet.</p>
                <Button variant="link" className="text-emerald-500" onClick={() => setIsAddOpen(true)}>
                  Add your first subscription
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Upcoming Payments */}
        <div className="space-y-8">
          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="w-5 h-5 text-emerald-500" />
            <h2 className="text-xl font-bold text-white">Upcoming</h2>
          </div>

          <UpcomingPaymentsList 
            occurrences={upcoming30} 
            rules={initialRules}
            title="Next 30 Days" 
          />

          <UpcomingPaymentsList 
            occurrences={upcoming90.filter(occ => !upcoming30.some(occ30 => occ30.rule_id === occ.rule_id && occ30.date === occ.date))} 
            rules={initialRules}
            title="Next 90 Days" 
          />
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-900 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
          </DialogHeader>
          <RecurringRuleForm 
            categories={categories} 
            initialData={editingRule!} 
            onSuccess={() => setEditingRule(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      {deletingRule && (
        <RecurringDeleteDialog
          open={!!deletingRule}
          onOpenChange={(open) => !open && setDeletingRule(null)}
          onConfirm={confirmDelete}
          description={deletingRule.description}
        />
      )}
    </div>
  )
}
