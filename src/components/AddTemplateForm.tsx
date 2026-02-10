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
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const templateSchema = z.object({
  name: z.string().min(2, { message: "Template name is required" }),
  amount: z.string().optional(), // Amount is optional for templates (can be variable)
  description: z.string().optional(),
  category_id: z.string().optional(),
})

export function AddTemplateForm({ categories, onSuccess }: { categories: any[], onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      amount: '',
      description: '',
      category_id: '',
    },
  })

  async function onSubmit(values: z.infer<typeof templateSchema>) {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('transaction_templates').insert({
        user_id: user.id,
        name: values.name,
        amount: values.amount ? parseFloat(values.amount) : null,
        description: values.description,
        category_id: values.category_id || null,
      })

      if (error) throw error

      toast.success('Template created successfully')
      form.reset()
      router.refresh()
      if (onSuccess) onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Monthly Rent" {...field} className="bg-zinc-900 border-zinc-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Amount (Optional)</FormLabel>
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
                <FormLabel>Default Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-400">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <FormLabel>Default Description</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Apartment 4B" {...field} className="bg-zinc-900 border-zinc-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold transition-all"
        >
          {loading ? 'Creating...' : 'Create Template'}
        </Button>
      </form>
    </Form>
  )
}
