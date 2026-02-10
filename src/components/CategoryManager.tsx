'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { CategoryDialog } from '@/components/CategoryDialog'
import type { Category } from '@/types/database'

export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleCreated = (newCat: Category) => {
    setCategories(prev => [...prev, newCat])
  }

  const handleUpdated = (updatedCat: Category) => {
    setCategories(prev => prev.map(c => c.id === updatedCat.id ? updatedCat : c))
    setEditingCategory(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will affect tasks/transactions linked to this category.')) return

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      
      toast.success('Category deleted')
      setCategories(prev => prev.filter(c => c.id !== id))
      router.refresh()
    } catch (error: any) {
      toast.error('Failed to delete category')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Your Categories</h2>
        <CategoryDialog 
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          trigger={
            <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          }
          onSuccess={handleCreated}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div 
            key={cat.id} 
            className="group flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <div>
                <span className="font-medium text-zinc-200 block">{cat.name}</span>
                {cat.budget_limit && (
                  <span className="text-[10px] text-zinc-500 font-medium">
                    ${cat.budget_limit.toLocaleString()} / {cat.budget_period}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <CategoryDialog
                initialData={cat}
                trigger={
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white">
                    <Pencil className="w-4 h-4" />
                  </Button>
                }
                onSuccess={handleUpdated}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-red-400" onClick={() => handleDelete(cat.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800">
            No categories yet. Create one to get started!
          </div>
        )}
      </div>
    </div>
  )
}
