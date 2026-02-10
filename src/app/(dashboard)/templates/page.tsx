import { createClient } from '@/lib/supabase-server'
import { TemplateList } from '@/components/TemplateList'
import { AddTemplateForm } from '@/components/AddTemplateForm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { data: templates } = await supabase
    .from('transaction_templates')
    .select(`
      *,
      categories (id, name, color)
    `)
    .eq('user_id', user.user?.id)
    .order('created_at', { ascending: false })

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.user?.id)

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Templates</h1>
          <p className="text-zinc-500 mt-1">
            Create templates for your regular expenses to add them with one click.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-900 text-white">
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
              <DialogDescription>
                Define a recurring transaction. You can leave amount blank if it varies.
              </DialogDescription>
            </DialogHeader>
            <AddTemplateForm categories={categories || []} />
          </DialogContent>
        </Dialog>
      </div>

      <TemplateList templates={templates || []} />
    </div>
  )
}
