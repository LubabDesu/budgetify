'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Category } from '@/types/database'

const PRESET_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#d946ef', // fuchsia-500
  '#f43f5e', // rose-500
  '#71717a', // zinc-500
]

interface CategoryDialogProps {
  initialData?: Category
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: (category: Category) => void
}

export function CategoryDialog({ 
  initialData, 
  trigger, 
  open: controlledOpen, 
  onOpenChange: setControlledOpen,
  onSuccess 
}: CategoryDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // Form states
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [budgetLimit, setBudgetLimit] = useState<string>('')
  const [budgetPeriod, setBudgetPeriod] = useState<Category['budget_period']>('monthly')

  // Sync with controlled open state if provided
  const isDialogOpen = controlledOpen !== undefined ? controlledOpen : isOpen
  const setDialogOpen = setControlledOpen || setIsOpen

  useEffect(() => {
    if (isDialogOpen) {
      if (initialData) {
        setName(initialData.name)
        setColor(initialData.color || PRESET_COLORS[0])
        setBudgetLimit(initialData.budget_limit?.toString() || '')
        setBudgetPeriod(initialData.budget_period || 'monthly')
      } else {
        setName('')
        setColor(PRESET_COLORS[0])
        setBudgetLimit('')
        setBudgetPeriod('monthly')
      }
    }
  }, [isDialogOpen, initialData])

  const handleSave = async () => {
    if (!name.trim()) return
    setIsLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let result: Category
      const limit = budgetLimit.trim() ? parseFloat(budgetLimit) : null

      const payload = { 
        name, 
        color, 
        budget_limit: limit, 
        budget_period: budgetPeriod 
      }

      if (initialData) {
        // Update
        const { data, error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', initialData.id)
          .select()
          .single()

        if (error) throw error
        toast.success('Category updated')
        result = data
      } else {
        // Create
        const { data, error } = await supabase
          .from('categories')
          .insert({ ...payload, user_id: user.id })
          .select()
          .single()

        if (error) throw error
        toast.success('Category created')
        result = data
      }
      
      router.refresh()
      if (onSuccess) onSuccess(result)
      setDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save category')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Groceries"
              className="bg-zinc-900 border-zinc-800 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Budget Limit (Optional)</label>
              <Input 
                type="number"
                value={budgetLimit} 
                onChange={(e) => setBudgetLimit(e.target.value)} 
                placeholder="0.00"
                className="bg-zinc-900 border-zinc-800 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Budget Period</label>
              <Select value={budgetPeriod} onValueChange={(val: any) => setBudgetPeriod(val)}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-900 text-white">
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 mt-4 font-bold">
            {isLoading ? <span className="animate-spin mr-2">⏳</span> : null}
            {initialData ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
