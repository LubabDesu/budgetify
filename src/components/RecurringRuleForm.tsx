'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
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
import { createRecurringRule, updateRecurringRule } from '@/app/actions/recurring'
import { RecurringRule, RecurringFrequency } from '@/types/database'

const formSchema = z.object({
  description: z.string().min(2, "Description must be at least 2 characters."),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  category_id: z.string().min(1, "Please select a category."),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Interval must be a positive number"),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
})

interface RecurringRuleFormProps {
  categories: any[]
  initialData?: RecurringRule
  onSuccess?: () => void
}

export function RecurringRuleForm({ categories, initialData, onSuccess }: RecurringRuleFormProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: initialData?.description || '',
      amount: initialData?.amount?.toString() || '',
      category_id: initialData?.category_id || '',
      frequency: initialData?.frequency || 'monthly',
      interval: initialData?.interval?.toString() || '1',
      start_date: initialData?.start_date || new Date().toISOString().split('T')[0],
      end_date: initialData?.end_date || '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    try {
      const data = {
        ...values,
        amount: parseFloat(values.amount),
        interval: parseInt(values.interval),
        end_date: values.end_date || null,
      }

      if (initialData) {
        await updateRecurringRule(initialData.id, data as any)
        toast.success('Subscription updated successfully')
      } else {
        await createRecurringRule(data as any)
        toast.success('Subscription created successfully')
      }
      
      if (onSuccess) onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save subscription')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Netflix, Rent" {...field} className="bg-zinc-900 border-zinc-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
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
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
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
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="interval"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Every X {form.watch('frequency')?.replace('ly', '') || 'period'}(s)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} className="bg-zinc-900 border-zinc-800" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-zinc-900 border-zinc-800" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date (Optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} className="bg-zinc-900 border-zinc-800" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold mt-2" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Subscription' : 'Add Subscription'}
        </Button>
      </form>
    </Form>
  )
}
