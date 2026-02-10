'use client'

import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFieldArray } from 'react-hook-form'
import * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { editTransaction } from '@/app/actions/transactions'
import { Switch } from '@/components/ui/switch'
import { createRecurringRule } from '@/app/actions/recurring'
import { CategoryDialog } from '@/components/CategoryDialog'

const formSchema = z.object({
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  description: z.string().min(2, {
    message: "Description must be at least 2 characters.",
  }),
  category_id: z.string().min(1, {
    message: "Please select a category.",
  }),
  date: z.string(),
  items: z.array(z.object({
    id: z.string().optional(),
    description: z.string().min(1, "Item description is required"),
    amount: z.string()
      .refine((val) => val.trim() !== '', "Amount is required")
      .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid positive number")
  })).optional(),
  is_recurring: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.string(),
})

interface AddTransactionFormProps {
  categories: any[]
  defaultValues?: Partial<z.infer<typeof formSchema>>
  onSuccess?: () => void
  editId?: string
}

export function AddTransactionForm({ categories: initialCategories, defaultValues, onSuccess, editId }: AddTransactionFormProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState(initialCategories)
  const supabase = createClient()
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: defaultValues?.amount || '',
      description: defaultValues?.description || '',
      category_id: defaultValues?.category_id || '',
      date: defaultValues?.date || new Date().toISOString().split('T')[0],
      items: defaultValues?.items || [],
      is_recurring: false,
      frequency: 'monthly',
      interval: '1',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  })

  // Update form when defaultValues change (e.g. after scanning)
  // We can use a useEffect or key-based reset in the parent, but key is better.
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (editId) {
        // Edit Mode
        console.log('📝 Updating transaction with items:', editId)
        await editTransaction({
          id: editId,
          amount: parseFloat(values.amount),
          description: values.description,
          category_id: values.category_id,
          date: values.date,
        } as any, values.items?.map(i => ({
          id: i.id,
          description: i.description,
          amount: parseFloat(i.amount),
          category_id: values.category_id // Default to parent category for now
        })))
      } else {
        // Add Mode
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          amount: parseFloat(values.amount),
          description: values.description,
          category_id: values.category_id,
          date: values.date,
        })
        if (error) throw error

        // Create Recurring Rule if toggled
        if (values.is_recurring && values.frequency) {
          await createRecurringRule({
            description: values.description,
            amount: parseFloat(values.amount),
            category_id: values.category_id,
            frequency: values.frequency,
            interval: parseInt(values.interval),
            start_date: values.date,
            end_date: undefined
          })
        }
      }

      toast.success(editId ? 'Transaction updated' : 'Transaction added successfully')
      form.reset()
      router.refresh()
      if (onSuccess) onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount ($)</FormLabel>
                <FormControl>
                  <Input placeholder="0.00" {...field} className="bg-zinc-900 border-zinc-800" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-zinc-900 border-zinc-800" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Weekly Groceries" {...field} className="bg-zinc-900 border-zinc-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <div className="flex gap-2">
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-400">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    {categories.length === 0 && (
                      <SelectItem value="none" disabled>No categories found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <CategoryDialog 
                  trigger={
                    <Button type="button" variant="outline" size="icon" className="shrink-0 bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20">
                      <Plus className="w-4 h-4" />
                    </Button>
                  }
                  onSuccess={(newCategory) => {
                    setCategories(prev => [...prev, newCategory])
                    form.setValue('category_id', newCategory.id)
                  }}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Line Items Section */}
        {editId && (
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Line Items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] border-zinc-800 bg-transparent"
                onClick={() => append({ description: '', amount: '0' })}
              >
                <Plus className="w-3 h-3 mr-1" /> Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-3 items-start group">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Item (e.g. Eggs)" className="bg-zinc-900 border-zinc-800 text-sm h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="w-24">
                    <FormField
                      control={form.control}
                      name={`items.${index}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="0.00" 
                              className="bg-zinc-900 border-zinc-800 text-sm h-9 text-right" 
                              onChange={(e) => {
                                field.onChange(e) // 1. Update the field as usual
                                // 2. 🎓 SOLUTION: Manually recalculate total on every change
                                // We need a timeout because the form state hasn't updated yet
                                setTimeout(() => {
                                  const items = form.getValues("items") || []
                                  const validItems = items.filter(item => {
                                    const amount = parseFloat(item.amount)
                                    return !isNaN(amount) && amount >= 0
                                  })
                                  const total = validItems.reduce((sum, item) => sum + (parseFloat(item.amount)), 0)
                                  form.setValue("amount", total.toFixed(2), { shouldValidate: true })
                                }, 0)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-zinc-500 hover:text-red-400"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              
              {fields.length === 0 && (
                <p className="text-xs text-zinc-500 italic text-center py-2">No line items for this transaction.</p>
              )}
            </div>
          </div>
        )}

        {/* Recurring Toggle Section */}
        {!editId && (
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium text-white">Make Recurring</FormLabel>
                <p className="text-[10px] text-zinc-500">Automatically repeat this transaction</p>
              </div>
              <FormField
                control={form.control}
                name="is_recurring"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {form.watch('is_recurring') && (
              <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 text-xs">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Every X {form.watch('frequency') === 'daily' ? 'day' : form.watch('frequency')?.replace('ly', '')}(s)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="bg-zinc-900 border-zinc-800 h-9 text-xs" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        )}

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold transition-all"
        >
          {loading ? (editId ? 'Updating...' : 'Adding...') : (editId ? 'Save Changes' : (form.watch('is_recurring') ? 'Add Recurring Transaction' : 'Add Transaction'))}
        </Button>
      </form>
    </Form>
  )
}
