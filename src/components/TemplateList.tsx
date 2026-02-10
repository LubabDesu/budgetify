'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Trash2, Edit } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function TemplateList({ templates }: { templates: any[] }) {
  const supabase = createClient()
  const router = useRouter()

  async function handleQuickAdd(template: any) {
    const loadingToast = toast.loading('Adding transaction...')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: template.amount || 0,
        description: template.description || template.name,
        category_id: template.category_id,
        date: new Date().toISOString().split('T')[0],
      })

      if (error) throw error

      toast.dismiss(loadingToast)
      toast.success(`${template.name} added!`)
      router.refresh()
    } catch (error: any) {
      toast.dismiss(loadingToast)
      toast.error(error.message || 'Failed to add transaction')
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('transaction_templates').delete().eq('id', id)
      if (error) throw error
      toast.success('Template deleted')
      router.refresh()
    } catch (error) {
      toast.error('Failed to delete template')
    }
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
        <p>No templates yet. Create one to quickly add recurring expenses.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all group">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base font-semibold text-white">{template.name}</CardTitle>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700 font-normal">
                {template.categories?.name || 'Uncategorized'}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500">{template.description || 'No description'}</p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white mb-4">
              {template.amount ? `$${template.amount.toFixed(2)}` : 'Variable'}
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => handleQuickAdd(template)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                size="sm"
              >
                <Play className="w-4 h-4 mr-2" /> Quick Add
              </Button>
              <Button 
                onClick={() => handleDelete(template.id)}
                variant="outline" 
                size="icon"
                className="border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
